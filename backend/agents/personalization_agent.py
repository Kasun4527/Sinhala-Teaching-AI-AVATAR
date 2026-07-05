"""
Personalization Agent — Hybrid PC-BKT + BKT-LSTM Orchestrator

This agent coordinates all personalization services after quiz evaluation.
It is called as a LangGraph node within the supervisor pipeline.

Flow:
  1. Build skill_id from subject/lesson/topic
  2. Convert quiz answers to binary correctness list
  3. Process via bkt_service.process_quiz_session()
  4. Update problem difficulty via difficulty_service
  5. Check/update student cluster via clustering_service
  6. Run LSTM prediction if model available
  7. Compute hybrid mastery (BKT + LSTM fusion) — Bug #2 fix
  8. Apply LSTM→BKT feedback correction — Bug #6 fix
  9. Return unified result with hybrid mastery, level, params, prediction
"""

import numpy as np
from typing import Dict, List, Optional

from services.bkt_service import (
    make_skill_id,
    process_quiz_session,
    mastery_to_level,
    get_mastery,
    get_subject_transfer_L0
)
from services.difficulty_service import (
    update_difficulty_batch,
    get_difficulty,
    get_difficulty_one_hot
)
from services.clustering_service import (
    maybe_update_cluster,
    get_student_cluster,
    get_cluster_one_hot,
    assign_new_student_cluster
)
from services.lstm_service import (
    predict_next_mastery,
    is_available as lstm_is_available
)

# ── Bug #2 Fix: BKT-LSTM fusion weights ──────────────────────
BKT_WEIGHT  = 0.7    # Weight for BKT mastery in hybrid fusion
LSTM_WEIGHT = 0.3    # Weight for LSTM prediction in hybrid fusion

# ── Bug #6 Fix: LSTM→BKT feedback threshold ─────────────────
LSTM_BKT_DIVERGENCE_THRESHOLD = 0.20  # If LSTM < BKT by this much, apply correction


def personalize_after_quiz(
    student_id:      str,
    subject:         str,
    lesson:          str,
    topic:           str,
    student_answers: list,
    correct_answers: list,
    quiz_type:       str = "pre",
    quiz_questions:  Optional[List[dict]] = None
) -> Dict:
    """
    Full personalization pipeline executed after each quiz evaluation.

    Args:
        student_id:      The student's unique identifier
        subject:         e.g. "Sinhala"
        lesson:          e.g. "බුද්ධ චරිතය"
        topic:           e.g. "සිදුහත් කුමාරයා"
        student_answers: The student's raw answers (list of strings or ints)
        correct_answers: The correct answers (matching order)
        quiz_type:       "pre" or "post"
        quiz_questions:  Optional list of question dicts with "text" key

    Returns:
        {
          "mastery":           float,      # raw BKT mastery
          "hybrid_mastery":    float,      # BKT + LSTM fused mastery
          "level":             str,        # Beginner / Intermediate / Advanced (from hybrid)
          "params":            dict,       # {L0, T, G, S}
          "predicted_score":   float,
          "lstm_prediction":   float|None,
          "cluster_id":        int,
          "cluster_label":     str,
          "is_uncertain":      bool,
          "confidence_warning": bool
        }
    """
    print(f"\n🧠 [PersonalizationAgent] Processing quiz for student={student_id}")

    # ── 1. Build composite skill ID ─────────────────────────────────────────
    skill_id = make_skill_id(subject, lesson, topic)
    print(f"   Skill ID: {skill_id}")

    # ── 2. Convert answers to binary correctness ──────────────────────────────
    quiz_answers_binary = []
    for sa, ca in zip(student_answers, correct_answers):
        quiz_answers_binary.append(1 if str(sa).strip() == str(ca).strip() else 0)

    print(f"   Binary correctness: {quiz_answers_binary}")

    # ── 3. Extract question texts for difficulty tracking ─────────────────────
    question_texts = []
    if quiz_questions:
        question_texts = [q.get("text", q.get("question", "")) for q in quiz_questions]

    # ── 4. Get difficulties for current questions ─────────────────────────────
    difficulties = [get_difficulty(qt) for qt in question_texts] if question_texts else None

    # ── 5. Process through PC-BKT engine ──────────────────────────────────
    # Priority 2: Pass cluster_id so BKT uses cluster-driven priors
    # Priority 3: Pass subject for cross-lesson knowledge transfer
    current_cluster = get_student_cluster(student_id)
    bkt_result = process_quiz_session(
        student_id=student_id,
        skill_id=skill_id,
        quiz_answers=quiz_answers_binary,
        quiz_type=quiz_type,
        question_ids=question_texts,
        difficulties=difficulties,
        cluster_id=current_cluster,
        subject=subject
    )
    bkt_mastery = bkt_result["mastery"]
    print(f"   BKT result: mastery={bkt_mastery:.4f}, "
          f"level={bkt_result['level']}, uncertain={bkt_result['is_uncertain']}")

    # ── 6. Update problem difficulty scores ───────────────────────────────────
    if quiz_questions and len(quiz_questions) == len(student_answers):
        difficulty_input = []
        for i, q in enumerate(quiz_questions):
            difficulty_input.append({
                "text":           q.get("text", q.get("question", "")),
                "student_answer": student_answers[i],
                "correct_answer": correct_answers[i]
            })
        update_difficulty_batch(difficulty_input, skill_id)
        print(f"   Updated difficulty for {len(difficulty_input)} questions.")

    # ── 7. Update student cluster ─────────────────────────────────────────────
    cluster_updated = maybe_update_cluster(student_id)
    cluster_id      = get_student_cluster(student_id)
    if cluster_id == 3:   # cold-start → try assign
        cluster_id = assign_new_student_cluster(student_id)
    print(f"   Cluster: {cluster_id} (updated={cluster_updated})")

    # ── 8. LSTM prediction ────────────────────────────────────────────────────
    lstm_prediction = None
    if lstm_is_available():
        try:
            cluster_oh    = get_cluster_one_hot(cluster_id)
            avg_difficulty = int(np.mean(difficulties)) if difficulties else 5
            difficulty_oh  = get_difficulty_one_hot(avg_difficulty)

            lstm_prediction = predict_next_mastery(
                mastery=bkt_mastery,
                cluster_one_hot=cluster_oh,
                difficulty_one_hot=difficulty_oh
            )
            if lstm_prediction is not None:
                print(f"   LSTM prediction: {lstm_prediction:.4f}")
        except Exception as e:
            print(f"   LSTM prediction failed: {e}")

    # ── 9. Bug #2 Fix: Compute hybrid mastery (BKT + LSTM fusion) ────────────
    confidence_warning = False
    if lstm_prediction is not None:
        hybrid_mastery = BKT_WEIGHT * bkt_mastery + LSTM_WEIGHT * lstm_prediction

        # Bug #6 Fix: LSTM→BKT feedback loop
        # If LSTM predicts significantly lower than BKT, the LSTM suspects
        # guessing or inconsistency → reduce hybrid mastery further
        if bkt_mastery - lstm_prediction > LSTM_BKT_DIVERGENCE_THRESHOLD:
            correction = (bkt_mastery - lstm_prediction) * 0.5
            hybrid_mastery -= correction
            confidence_warning = True
            print(f"   ⚠️ LSTM→BKT feedback: LSTM diverges by "
                  f"{bkt_mastery - lstm_prediction:.4f}, "
                  f"applying correction of -{correction:.4f}")

        hybrid_mastery = float(np.clip(hybrid_mastery, 0.0, 0.99))
        print(f"   Hybrid mastery: {hybrid_mastery:.4f} "
              f"(BKT={bkt_mastery:.4f}, LSTM={lstm_prediction:.4f})")
    else:
        hybrid_mastery = bkt_mastery
        print(f"   Hybrid mastery: {hybrid_mastery:.4f} (LSTM unavailable, using BKT only)")

    # ── 10. Build unified result ──────────────────────────────────────────────
    from services.clustering_service import CLUSTER_LABELS

    hybrid_level = mastery_to_level(hybrid_mastery)

    # ── Priority 1 & 5: Adaptive learning signals ───────────────────────
    # These signals tell the frontend/content system to adapt:
    #   - hint_required: student needs help (mastery < 0.40 or LSTM predicts drop)
    #   - adapt_difficulty: "easier" / "harder" / "maintain"
    #   - remediation_needed: student is regressing
    hint_required = False
    adapt_difficulty = "maintain"
    remediation_needed = False

    if hybrid_mastery < 0.30:
        hint_required = True
        adapt_difficulty = "easier"
        remediation_needed = True
        print(f"   🎯 [Adaptive] Remediation triggered: mastery={hybrid_mastery:.3f}")
    elif hybrid_mastery < 0.40:
        hint_required = True
        adapt_difficulty = "easier"
        print(f"   🎯 [Adaptive] Hints enabled, easier questions recommended")
    elif hybrid_mastery > 0.70:
        adapt_difficulty = "harder"
        print(f"   🎯 [Adaptive] Challenge mode: harder questions recommended")

    # If LSTM predicts a mastery DROP (negative slope), trigger remediation
    if lstm_prediction is not None and lstm_prediction < bkt_mastery - 0.10:
        hint_required = True
        remediation_needed = True
        print(f"   ⚠️ [Adaptive] LSTM predicts mastery drop: "
              f"current={bkt_mastery:.3f}, predicted={lstm_prediction:.3f}")

    result = {
        "mastery":              bkt_mastery,
        "hybrid_mastery":       hybrid_mastery,
        "level":                hybrid_level,
        "params":               bkt_result["params"],
        "predicted_score":      bkt_result["predicted_score"],
        "lstm_prediction":      lstm_prediction,
        "cluster_id":           cluster_id,
        "cluster_label":        CLUSTER_LABELS.get(cluster_id, "Medium"),
        "correct_count":        bkt_result["correct_count"],
        "total_count":          bkt_result["total_count"],
        "is_uncertain":         bkt_result["is_uncertain"],
        "confidence_warning":   confidence_warning,
        # Priority 1 & 5: Adaptive learning signals
        "hint_required":        hint_required,
        "adapt_difficulty":     adapt_difficulty,
        "remediation_needed":   remediation_needed
    }

    print(f"   ✅ Personalization complete: level={result['level']}, "
          f"hybrid_mastery={result['hybrid_mastery']:.4f}, "
          f"adapt={adapt_difficulty}, hints={hint_required}")
    return result


def personalize_single_answer(
    student_id:   str,
    subject:      str,
    lesson:       str,
    topic:        str,
    is_correct:   int,
    quiz_type:    str = "pre",
    question_text: Optional[str] = None
) -> Dict:
    """
    Online learning (single-answer) personalization pipeline.
    Runs BKT update, cluster check, and LSTM prediction for real-time adaptation.
    """
    print(f"\n🧠 [PersonalizationAgent] Online learning update for student={student_id}")

    from services.bkt_service import process_single_answer

    skill_id = make_skill_id(subject, lesson, topic)
    difficulty = get_difficulty(question_text) if question_text else 5

    # 1. Cluster
    cluster_id = get_student_cluster(student_id)
    if cluster_id == 3:
        cluster_id = assign_new_student_cluster(student_id)

    # 2. Single BKT step
    bkt_result = process_single_answer(
        student_id=student_id,
        skill_id=skill_id,
        is_correct=is_correct,
        quiz_type=quiz_type,
        question_id=question_text,
        difficulty=difficulty,
        cluster_id=cluster_id,
        subject=subject
    )
    bkt_mastery = bkt_result["mastery"]

    # 3. LSTM Prediction
    lstm_prediction = None
    if lstm_is_available():
        try:
            cluster_oh = get_cluster_one_hot(cluster_id)
            difficulty_oh = get_difficulty_one_hot(difficulty)
            lstm_prediction = predict_next_mastery(
                mastery=bkt_mastery,
                cluster_one_hot=cluster_oh,
                difficulty_one_hot=difficulty_oh
            )
        except Exception as e:
            print(f"   LSTM prediction failed: {e}")

    # 4. Hybrid Mastery
    confidence_warning = False
    if lstm_prediction is not None:
        hybrid_mastery = BKT_WEIGHT * bkt_mastery + LSTM_WEIGHT * lstm_prediction
        if bkt_mastery - lstm_prediction > LSTM_BKT_DIVERGENCE_THRESHOLD:
            hybrid_mastery -= (bkt_mastery - lstm_prediction) * 0.5
            confidence_warning = True
        hybrid_mastery = float(np.clip(hybrid_mastery, 0.0, 0.99))
    else:
        hybrid_mastery = bkt_mastery

    hybrid_level = mastery_to_level(hybrid_mastery)

    # 5. Adaptive Signals
    hint_required = False
    adapt_difficulty = "maintain"

    if hybrid_mastery < 0.30:
        hint_required = True
        adapt_difficulty = "easier"
    elif hybrid_mastery < 0.40:
        hint_required = True
        adapt_difficulty = "easier"
    elif hybrid_mastery > 0.70:
        adapt_difficulty = "harder"

    if lstm_prediction is not None and lstm_prediction < bkt_mastery - 0.10:
        hint_required = True

    return {
        "mastery":           hybrid_mastery,  # Return hybrid as the main mastery for online
        "level":             hybrid_level,
        "is_uncertain":      bkt_result["is_uncertain"],
        "hint_required":     hint_required,
        "adapt_difficulty":  adapt_difficulty,
        "lstm_prediction":   lstm_prediction
    }

