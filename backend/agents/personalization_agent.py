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
  6. Optionally run LSTM prediction if model available
  7. Return unified result with mastery, level, params, prediction
"""

import numpy as np
from typing import Dict, List, Optional

from services.bkt_service import (
    make_skill_id,
    process_quiz_session,
    mastery_to_level,
    get_mastery
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
          "mastery":           float,
          "level":             str,       # Beginner / Intermediate / Advanced
          "params":            dict,      # {L0, T, G, S}
          "predicted_score":   float,
          "lstm_prediction":   float|None,
          "cluster_id":        int,
          "cluster_label":     str
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

    # ── 5. Process through PC-BKT engine ──────────────────────────────────────
    bkt_result = process_quiz_session(
        student_id=student_id,
        skill_id=skill_id,
        quiz_answers=quiz_answers_binary,
        quiz_type=quiz_type,
        question_ids=question_texts,
        difficulties=difficulties
    )
    print(f"   BKT result: mastery={bkt_result['mastery']:.4f}, "
          f"level={bkt_result['level']}")

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

    # ── 8. LSTM prediction (optional) ─────────────────────────────────────────
    lstm_prediction = None
    if lstm_is_available():
        try:
            cluster_oh    = get_cluster_one_hot(cluster_id)
            avg_difficulty = int(np.mean(difficulties)) if difficulties else 5
            difficulty_oh  = get_difficulty_one_hot(avg_difficulty)

            lstm_prediction = predict_next_mastery(
                mastery=bkt_result["mastery"],
                cluster_one_hot=cluster_oh,
                difficulty_one_hot=difficulty_oh
            )
            if lstm_prediction is not None:
                print(f"   LSTM prediction: {lstm_prediction:.4f}")
        except Exception as e:
            print(f"   LSTM prediction failed: {e}")

    # ── 9. Build unified result ───────────────────────────────────────────────
    from services.clustering_service import CLUSTER_LABELS

    result = {
        "mastery":         bkt_result["mastery"],
        "level":           bkt_result["level"],
        "params":          bkt_result["params"],
        "predicted_score": bkt_result["predicted_score"],
        "lstm_prediction": lstm_prediction,
        "cluster_id":      cluster_id,
        "cluster_label":   CLUSTER_LABELS.get(cluster_id, "Medium"),
        "correct_count":   bkt_result["correct_count"],
        "total_count":     bkt_result["total_count"]
    }

    print(f"   ✅ Personalization complete: level={result['level']}, "
          f"mastery={result['mastery']:.4f}")
    return result
