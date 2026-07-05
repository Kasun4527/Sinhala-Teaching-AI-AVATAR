"""
Hybrid BKT Service — PC-BKT Empirical Probabilities + BKT State Tracking

Implements:
  - PC-BKT EP parameter fitting (per-student, per-skill personalization)
  - Bayesian prior blending for small data (prevents EP degeneration)
  - BKT state update equations with mastery delta cap
  - Accuracy sanity check (prevents 50% correct → Advanced paradox)
  - PC-BKT performance prediction formula
  - Mastery-to-level mapping with uncertainty zone
  - Incremental single-answer updates (online learning)
  - MongoDB-backed state persistence
"""

import numpy as np
from typing import Dict, List, Optional
from datetime import datetime

from db import (
    skill_mastery_col,
    bkt_params_col,
    interaction_logs_col
)

# ─────────────────────────────────────────────────────────────
# CONSTANTS
# ─────────────────────────────────────────────────────────────

MASTERY_CAP         = 0.99   # Raised from 0.95; growth is now controlled by delta cap
DEFAULT_L0          = 0.30   # cold-start prior knowledge
DEFAULT_T           = 0.10   # cold-start learn rate
DEFAULT_G           = 0.20   # cold-start guess rate (calibrated)
DEFAULT_S           = 0.10   # cold-start slip rate

BEGINNER_THRESHOLD      = 0.40
INTERMEDIATE_THRESHOLD  = 0.70

# ── Bug #1 Fix: Tighter EP parameter clipping ranges ──────────
EP_G_MIN, EP_G_MAX  = 0.10, 0.30   # was [0.01, 0.50]
EP_S_MIN, EP_S_MAX  = 0.05, 0.20   # was [0.01, 0.50]
EP_T_MIN, EP_T_MAX  = 0.05, 0.30   # was [0.01, 0.90]
EP_L0_MIN, EP_L0_MAX = 0.05, 0.70  # was [0.01, 0.95]

# ── Bug #1 Fix: Minimum data for EP fitting ──────────────────
MIN_EP_FIT_THRESHOLD = 20   # Use defaults until we have 20 responses

# ── Bug #8 Fix: Cap mastery growth per single step ───────────
# Priority 4: Reduced from 0.10 → 0.05 so a perfect 10/10 quiz only adds
# ~0.50 mastery max, requiring sustained performance across multiple sessions.
MAX_MASTERY_DELTA    = 0.05

# ── Bug #7 Fix: Uncertainty zone ─────────────────────────────
UNCERTAINTY_THRESHOLD = 15   # First 15 interactions are "uncertain"

# ── Priority 2: Cluster-driven BKT parameter profiles ────────
# Each cluster maps to a behavioral learning profile that physically
# changes how BKT processes student responses.
CLUSTER_PROFILES = {
    0: {"T": 0.25, "G": 0.15, "S": 0.05, "label": "Fast Learner"},
    1: {"T": 0.05, "G": 0.25, "S": 0.20, "label": "Struggling"},
    2: {"T": 0.15, "G": 0.10, "S": 0.30, "label": "Careless"},
    3: {"T": DEFAULT_T, "G": DEFAULT_G, "S": DEFAULT_S, "label": "Cold-Start"},
}


def get_cluster_priors(cluster_id: int) -> Dict[str, float]:
    """Return BKT parameter priors driven by the student's cluster assignment."""
    profile = CLUSTER_PROFILES.get(cluster_id, CLUSTER_PROFILES[3])
    return {"T": profile["T"], "G": profile["G"], "S": profile["S"]}


# ─────────────────────────────────────────────────────────────
# SKILL ID BUILDER
# ─────────────────────────────────────────────────────────────

def make_skill_id(subject: str, lesson: str, topic: str) -> str:
    """Composite skill identifier matching the curriculum hierarchy."""
    return f"{subject}::{lesson}::{topic}"


def get_subject_transfer_L0(student_id: str, subject: str) -> float:
    """
    Priority 3: Cross-lesson knowledge transfer.

    When a student starts a new lesson in the same subject, instead of
    defaulting to L0=0.30, we blend the default with their average mastery
    across all previously completed skills in this subject.

    Formula: L0_new = 0.5 * DEFAULT_L0 + 0.5 * avg_subject_mastery
    """
    import re
    # Find all skill_mastery records for this student in this subject
    records = list(skill_mastery_col.find({
        "student_id": student_id,
        "skill_id": {"$regex": f"^{re.escape(subject)}::"}
    }))

    if not records:
        return DEFAULT_L0

    avg_mastery = sum(float(r["mastery"]) for r in records) / len(records)
    transfer_L0 = 0.5 * DEFAULT_L0 + 0.5 * avg_mastery
    transfer_L0 = float(np.clip(transfer_L0, EP_L0_MIN, EP_L0_MAX))
    print(f"   [KnowledgeTransfer] Subject={subject}, past_skills={len(records)}, "
          f"avg_mastery={avg_mastery:.3f}, transfer_L0={transfer_L0:.3f}")
    return transfer_L0


# ─────────────────────────────────────────────────────────────
# CORE BKT MATH
# ─────────────────────────────────────────────────────────────

def bkt_update(prev_L: float, action: int, p_T: float, p_G: float, p_S: float) -> float:
    """
    PC-BKT knowledge state update with mastery delta cap.

    Step 1 — posterior given observation:
      If correct: P(L | 1) = P(L)·(1-P(S)) / [P(L)·(1-P(S)) + (1-P(L))·P(G)]
      If wrong:   P(L | 0) = P(L)·P(S)     / [P(L)·P(S)     + (1-P(L))·(1-P(G))]

    Step 2 — apply learning transition:
      P(L_next) = P(L|obs) + (1 - P(L|obs)) · P(T)

    Step 3 — apply mastery delta cap (Bug #8 fix):
      P(L_next) = min(P(L_next), prev_L + MAX_MASTERY_DELTA)

    Returns:
        Updated mastery, capped at MASTERY_CAP and delta-limited
    """
    eps = 1e-9
    if action == 1:
        num = prev_L * (1.0 - p_S)
        den = prev_L * (1.0 - p_S) + (1.0 - prev_L) * p_G
    else:
        num = prev_L * p_S
        den = prev_L * p_S + (1.0 - prev_L) * (1.0 - p_G)

    L_given = num / (den + eps)
    next_L  = L_given + (1.0 - L_given) * p_T

    # Bug #8 Fix: Cap mastery growth per step
    next_L = min(next_L, prev_L + MAX_MASTERY_DELTA)

    return float(min(np.clip(next_L, 0.0, 1.0), MASTERY_CAP))


def predict_correctness(L_prev: float, p_G: float, p_S: float) -> float:
    """
    PC-BKT performance prediction:
    P(C_t) = P(L_{t-1}) · (1 - P(S)) + (1 - P(L_{t-1})) · P(G)
    """
    return float(L_prev * (1.0 - p_S) + (1.0 - L_prev) * p_G)


def mastery_to_level(mastery: float) -> str:
    """Map continuous mastery probability to 3-level teaching label."""
    if mastery < BEGINNER_THRESHOLD:
        return "Beginner"
    elif mastery < INTERMEDIATE_THRESHOLD:
        return "Intermediate"
    else:
        return "Advanced"


# ─────────────────────────────────────────────────────────────
# BUG #4 FIX: ACCURACY SANITY CHECK
# ─────────────────────────────────────────────────────────────

def accuracy_sanity_check(mastery: float, all_responses: List[int]) -> float:
    """
    Prevent the 'Advanced Student Paradox' where a student with low
    raw accuracy gets classified as Advanced due to BKT math degeneration.

    Rule: If raw accuracy < 60%, mastery is clamped below Intermediate.
          If raw accuracy < 40%, mastery is clamped below Beginner threshold.
    """
    if not all_responses:
        return mastery

    raw_accuracy = sum(all_responses) / len(all_responses)

    if raw_accuracy < 0.40:
        # Very weak performance → cap at Beginner zone
        mastery = min(mastery, BEGINNER_THRESHOLD - 0.01)
    elif raw_accuracy < 0.60:
        # Below-average performance → never allow Advanced
        mastery = min(mastery, INTERMEDIATE_THRESHOLD - 0.01)

    return mastery


# ─────────────────────────────────────────────────────────────
# PC-BKT EMPIRICAL PROBABILITIES (EP) FITTING
# ─────────────────────────────────────────────────────────────

def fit_bkt_ep(responses: List[int], cluster_id: int = 3,
               transfer_L0: Optional[float] = None) -> Dict[str, float]:
    """
    PC-BKT Empirical Probabilities algorithm with Bayesian prior blending.

    Bug #1 Fix: For small data (< MIN_EP_FIT_THRESHOLD responses), uses
    calibrated defaults instead of pure EP fitting. For intermediate data,
    blends EP-fitted values with defaults weighted by data confidence.

    Priority 2: Uses cluster-driven priors instead of global defaults.
    Priority 3: Uses transfer_L0 from cross-lesson knowledge transfer.

    Algorithm:
      1. Generate all valid monotone 0→1 state sequences (no forgetting).
      2. Find the sequence(s) with highest accuracy against actual responses.
      3. Average tied sequences → fractional knowledge state K_j ∈ [0,1].
      4. Compute G, S, T empirically from C (responses) and K (states).
      5. Derive L0 from Correct First Attempt (CFA).
      6. Blend with Bayesian priors based on data confidence.
    """
    J = len(responses)

    # Priority 2: Get cluster-driven priors instead of global defaults
    cluster_priors = get_cluster_priors(cluster_id)
    prior_T = cluster_priors["T"]
    prior_G = cluster_priors["G"]
    prior_S = cluster_priors["S"]

    # Priority 3: Use transfer L0 if available, otherwise default
    base_L0 = transfer_L0 if transfer_L0 is not None else DEFAULT_L0

    # Fallback defaults for insufficient data
    if J == 0:
        return {"L0": base_L0, "T": prior_T, "G": prior_G, "S": prior_S}

    if J == 1:
        p_L0 = (1.0 - prior_G) if responses[0] == 1 else prior_S
        return {"L0": float(np.clip(p_L0, EP_L0_MIN, EP_L0_MAX)),
                "T":  prior_T, "G": prior_G, "S": prior_S}

    # Bug #1 Fix: For very small data, return calibrated cluster priors
    # with L0 adjusted by first-attempt result
    if J < MIN_EP_FIT_THRESHOLD:
        raw_accuracy = sum(responses) / J
        # Scale L0 based on actual performance, blended with transfer L0
        p_L0 = float(np.clip(raw_accuracy * 0.7, EP_L0_MIN, EP_L0_MAX))
        # Blend with transfer L0 if available
        if transfer_L0 is not None:
            p_L0 = 0.6 * p_L0 + 0.4 * transfer_L0
            p_L0 = float(np.clip(p_L0, EP_L0_MIN, EP_L0_MAX))
        return {"L0": p_L0, "T": prior_T, "G": prior_G, "S": prior_S}

    # ── Step 1: Generate all valid monotone sequences ─────────────────────────
    valid_sequences = []
    for split in range(J + 1):
        seq = [0] * split + [1] * (J - split)
        valid_sequences.append(seq)

    # ── Step 2: Find best-accuracy sequence(s) ────────────────────────────────
    accuracies = [
        sum(1 for s_val, r_val in zip(seq, responses) if s_val == r_val) / J
        for seq in valid_sequences
    ]
    max_acc    = max(accuracies)
    best_seqs  = [valid_sequences[i] for i, a in enumerate(accuracies) if a == max_acc]

    # ── Step 3: Average tied sequences → fractional state K ──────────────────
    K = np.mean(best_seqs, axis=0)   # shape: (J,), values in [0, 1]
    C = np.array(responses, dtype=float)

    # ── Step 4: Empirical parameter computation ────────────────────────────────

    # Guess: correct answers while unlearned
    unlearned     = 1.0 - K
    sum_unlearned = np.sum(unlearned)
    ep_G = (float(np.sum(C * unlearned) / sum_unlearned)
           if sum_unlearned > 1e-9 else DEFAULT_G)

    # Slip: incorrect answers while learned
    sum_learned = np.sum(K)
    ep_S = (float(np.sum((1.0 - C) * K) / sum_learned)
           if sum_learned > 1e-9 else DEFAULT_S)

    # Transition (learn rate): 0→1 transitions
    num_T = sum((1.0 - K[j-1]) * K[j]   for j in range(1, J))
    den_T = sum((1.0 - K[j-1])           for j in range(1, J))
    ep_T  = float(num_T / den_T) if den_T > 1e-9 else DEFAULT_T

    # ── Step 5: Tighter boundary capping (Bug #1 fix) ────────────────────────
    ep_G = float(np.clip(ep_G, EP_G_MIN, EP_G_MAX))
    ep_S = float(np.clip(ep_S, EP_S_MIN, EP_S_MAX))
    ep_T = float(np.clip(ep_T, EP_T_MIN, EP_T_MAX))

    # ── Step 6: Bayesian prior blending (Bug #1 fix) ─────────────────────────
    # Confidence factor: 0.0 at MIN_EP_FIT_THRESHOLD, 1.0 at 2x threshold
    # Priority 2: Blends with cluster-driven priors instead of global defaults
    alpha = min(1.0, (J - MIN_EP_FIT_THRESHOLD) / MIN_EP_FIT_THRESHOLD)
    p_G = alpha * ep_G + (1.0 - alpha) * prior_G
    p_S = alpha * ep_S + (1.0 - alpha) * prior_S
    p_T = alpha * ep_T + (1.0 - alpha) * prior_T

    # Re-clip after blending
    p_G = float(np.clip(p_G, EP_G_MIN, EP_G_MAX))
    p_S = float(np.clip(p_S, EP_S_MIN, EP_S_MAX))
    p_T = float(np.clip(p_T, EP_T_MIN, EP_T_MAX))

    # Initial knowledge from Correct First Attempt
    cfa  = responses[0]
    p_L0 = float((1.0 - p_G) if cfa == 1 else p_S)
    p_L0 = float(np.clip(p_L0, EP_L0_MIN, EP_L0_MAX))

    return {"L0": p_L0, "T": p_T, "G": p_G, "S": p_S}


# ─────────────────────────────────────────────────────────────
# MONGODB STATE MANAGEMENT
# ─────────────────────────────────────────────────────────────

def get_mastery(student_id: str, skill_id: str, subject: Optional[str] = None) -> float:
    """Retrieve the current mastery probability for a specific skill. Returns transfer L0 if unseen."""
    record = skill_mastery_col.find_one(
        {"student_id": student_id, "skill_id": skill_id}
    )
    if record:
        return float(record["mastery"])
    return get_subject_transfer_L0(student_id, subject) if subject else DEFAULT_L0


def get_bkt_params(student_id: str, skill_id: str, cluster_id: int = 3, subject: Optional[str] = None) -> Dict[str, float]:
    """Retrieve personalized BKT params from DB. Returns cluster/transfer defaults if unseen."""
    record = bkt_params_col.find_one(
        {"student_id": student_id, "skill_id": skill_id}
    )
    if record:
        return {"L0": record["L0"], "T": record["T"],
                "G":  record["G"],  "S": record["S"]}
    
    # Fallback to cluster priors and cross-lesson transfer L0
    cluster_priors = get_cluster_priors(cluster_id)
    transfer_L0 = get_subject_transfer_L0(student_id, subject) if subject else DEFAULT_L0
    
    return {"L0": transfer_L0, "T": cluster_priors["T"], "G": cluster_priors["G"], "S": cluster_priors["S"]}


def get_all_skill_masteries(student_id: str) -> Dict[str, float]:
    """
    Retrieve all BKT mastery values for a student across all skills.
    Used by clustering_service to build the capability vector.
    """
    records = skill_mastery_col.find({"student_id": student_id})
    return {r["skill_id"]: float(r["mastery"]) for r in records}


def process_quiz_session(
    student_id:   str,
    skill_id:     str,
    quiz_answers: List[int],
    quiz_type:    str = "pre",
    question_ids: Optional[List[str]] = None,
    difficulties: Optional[List[int]] = None,
    cluster_id:   int = 3,
    subject:      Optional[str] = None,
) -> Dict:
    """
    Full processing pipeline for one quiz session on one skill.

    Steps:
      1. Fetch existing interaction history for this student-skill pair.
      2. Re-fit EP parameters on ALL responses (history + new).
      3. Replay BKT updates from scratch with new parameters.
      4. Apply accuracy sanity check (Bug #4 fix).
      5. Persist new interaction logs, updated params, updated mastery.

    Returns:
        {
          "mastery":         float,
          "level":           str,
          "params":          dict,
          "predicted_score": float,
          "correct_count":   int,
          "total_count":     int,
          "is_uncertain":    bool
        }
    """
    now = datetime.utcnow()

    # ── 1. Fetch historical responses ─────────────────────────────────────────
    history_docs = list(interaction_logs_col.find(
        {"student_id": student_id, "skill_id": skill_id},
        sort=[("created_at", 1)]
    ))
    historical_responses = [int(doc["correct"]) for doc in history_docs]

    # ── 2. Fit EP parameters on combined response history ─────────────────────
    all_responses = historical_responses + quiz_answers

    # Priority 3: Get cross-lesson transfer L0 if starting a new skill
    transfer_L0 = None
    if not historical_responses and subject:
        transfer_L0 = get_subject_transfer_L0(student_id, subject)

    # Priority 2: Pass cluster_id for cluster-driven priors
    params = fit_bkt_ep(all_responses, cluster_id=cluster_id,
                        transfer_L0=transfer_L0)

    # ── 3. Replay BKT from L0 with newly fitted params ────────────────────────
    mastery = params["L0"]
    for resp in all_responses:
        mastery = bkt_update(
            mastery, resp, params["T"], params["G"], params["S"]
        )

    # ── 4. Apply accuracy sanity check (Bug #4 fix) ──────────────────────────
    mastery = accuracy_sanity_check(mastery, all_responses)

    # ── 4b. Priority 4: First-quiz mastery ceiling ────────────────────────────
    # One quiz session should NOT prove mastery. If this is the student's
    # first interaction with this skill, cap mastery at 0.80 max.
    FIRST_QUIZ_CEILING = 0.80
    if not historical_responses:
        mastery = min(mastery, FIRST_QUIZ_CEILING)

    predicted_score = predict_correctness(mastery, params["G"], params["S"])

    # ── 5. Bug #7: Determine uncertainty status ──────────────────────────────
    is_uncertain = len(all_responses) < UNCERTAINTY_THRESHOLD

    # ── 6. Persist new interaction logs ───────────────────────────────────────
    q_ids  = question_ids or ([None] * len(quiz_answers))
    diffs  = difficulties  or ([5]    * len(quiz_answers))

    for i, ans in enumerate(quiz_answers):
        interaction_logs_col.insert_one({
            "student_id":  student_id,
            "skill_id":    skill_id,
            "question_id": q_ids[i],
            "correct":     int(ans),
            "quiz_type":   quiz_type,
            "difficulty":  int(diffs[i]),
            "created_at":  now
        })

    # ── 7. Upsert personalized BKT parameters ─────────────────────────────────
    bkt_params_col.update_one(
        {"student_id": student_id, "skill_id": skill_id},
        {"$set": {
            "L0": params["L0"], "T": params["T"],
            "G":  params["G"],  "S": params["S"],
            "response_count": len(all_responses),
            "fitted_at": now
        }},
        upsert=True
    )

    # ── 8. Upsert skill mastery ────────────────────────────────────────────────
    correct_count = sum(all_responses)
    skill_mastery_col.update_one(
        {"student_id": student_id, "skill_id": skill_id},
        {"$set": {
            "mastery":          mastery,
            "total_attempts":   len(all_responses),
            "correct_attempts": correct_count,
            "is_uncertain":     is_uncertain,
            "updated_at":       now
        },
        "$setOnInsert": {
            "created_at": now
        }},
        upsert=True
    )

    return {
        "mastery":         mastery,
        "level":           mastery_to_level(mastery),
        "params":          params,
        "predicted_score": predicted_score,
        "correct_count":   correct_count,
        "total_count":     len(all_responses),
        "is_uncertain":    is_uncertain
    }


# ─────────────────────────────────────────────────────────────
# BUG #10 FIX: INCREMENTAL SINGLE-ANSWER UPDATE
# ─────────────────────────────────────────────────────────────

def process_single_answer(
    student_id:   str,
    skill_id:     str,
    is_correct:   int,
    quiz_type:    str = "pre",
    question_id:  Optional[str] = None,
    difficulty:   int = 5,
    cluster_id:   int = 3,
    subject:      Optional[str] = None
) -> Dict:
    """
    Incremental BKT update for a single answer (online learning).
    """
    now = datetime.utcnow()

    # ── 1. Fetch current state ────────────────────────────────────────────────
    mastery = get_mastery(student_id, skill_id, subject)
    params  = get_bkt_params(student_id, skill_id, cluster_id, subject)

    # ── 2. Run single BKT update ─────────────────────────────────────────────
    new_mastery = bkt_update(
        mastery, is_correct, params["T"], params["G"], params["S"]
    )

    # ── 3. Apply accuracy sanity check using recent history ──────────────────
    # Fetch last N responses for sanity check
    recent_docs = list(interaction_logs_col.find(
        {"student_id": student_id, "skill_id": skill_id},
        sort=[("created_at", -1)],
        limit=20
    ))
    recent_responses = [int(doc["correct"]) for doc in recent_docs] + [is_correct]
    new_mastery = accuracy_sanity_check(new_mastery, recent_responses)

    # ── 4. Persist the single interaction log ────────────────────────────────
    interaction_logs_col.insert_one({
        "student_id":  student_id,
        "skill_id":    skill_id,
        "question_id": question_id,
        "correct":     int(is_correct),
        "quiz_type":   quiz_type,
        "difficulty":  difficulty,
        "created_at":  now
    })

    # ── 5. Count total attempts ──────────────────────────────────────────────
    total_attempts = interaction_logs_col.count_documents(
        {"student_id": student_id, "skill_id": skill_id}
    )
    is_uncertain = total_attempts < UNCERTAINTY_THRESHOLD

    # ── 6. Update mastery in DB ──────────────────────────────────────────────
    skill_mastery_col.update_one(
        {"student_id": student_id, "skill_id": skill_id},
        {"$set": {
            "mastery":        new_mastery,
            "total_attempts": total_attempts,
            "is_uncertain":   is_uncertain,
            "updated_at":     now
        },
        "$setOnInsert": {
            "created_at": now
        },
        "$inc": {
            "correct_attempts": is_correct
        }},
        upsert=True
    )

    return {
        "mastery":       new_mastery,
        "level":         mastery_to_level(new_mastery),
        "is_uncertain":  is_uncertain
    }
