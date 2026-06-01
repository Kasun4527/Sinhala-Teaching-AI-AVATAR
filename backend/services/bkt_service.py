"""
Hybrid BKT Service — PC-BKT Empirical Probabilities + BKT State Tracking

Implements:
  - PC-BKT EP parameter fitting (per-student, per-skill personalization)
  - BKT state update equations
  - PC-BKT performance prediction formula
  - Mastery-to-level mapping
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

MASTERY_CAP         = 0.95   # PC-BKT: prevents model from saturating
DEFAULT_L0          = 0.30   # cold-start prior knowledge
DEFAULT_T           = 0.10   # cold-start learn rate
DEFAULT_G           = 0.25   # cold-start guess rate
DEFAULT_S           = 0.10   # cold-start slip rate

BEGINNER_THRESHOLD      = 0.40
INTERMEDIATE_THRESHOLD  = 0.70


# ─────────────────────────────────────────────────────────────
# SKILL ID BUILDER
# ─────────────────────────────────────────────────────────────

def make_skill_id(subject: str, lesson: str, topic: str) -> str:
    """Composite skill identifier matching the curriculum hierarchy."""
    return f"{subject}::{lesson}::{topic}"


# ─────────────────────────────────────────────────────────────
# CORE BKT MATH
# ─────────────────────────────────────────────────────────────

def bkt_update(prev_L: float, action: int, p_T: float, p_G: float, p_S: float) -> float:
    """
    PC-BKT knowledge state update.

    Step 1 — posterior given observation:
      If correct: P(L | 1) = P(L)·(1-P(S)) / [P(L)·(1-P(S)) + (1-P(L))·P(G)]
      If wrong:   P(L | 0) = P(L)·P(S)     / [P(L)·P(S)     + (1-P(L))·(1-P(G))]

    Step 2 — apply learning transition:
      P(L_next) = P(L|obs) + (1 - P(L|obs)) · P(T)

    Returns:
        Updated mastery, capped at MASTERY_CAP
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
# PC-BKT EMPIRICAL PROBABILITIES (EP) FITTING
# ─────────────────────────────────────────────────────────────

def fit_bkt_ep(responses: List[int]) -> Dict[str, float]:
    """
    PC-BKT Empirical Probabilities algorithm.
    Fits PERSONALIZED {L0, T, G, S} for one student-skill pair
    from their complete binary response history.

    Algorithm:
      1. Generate all valid monotone 0→1 state sequences (no forgetting).
      2. Find the sequence(s) with highest accuracy against actual responses.
      3. Average tied sequences → fractional knowledge state K_j ∈ [0,1].
      4. Compute G, S, T empirically from C (responses) and K (states).
      5. Derive L0 from Correct First Attempt (CFA).
    """
    J = len(responses)

    # Fallback defaults for insufficient data
    if J == 0:
        return {"L0": DEFAULT_L0, "T": DEFAULT_T, "G": DEFAULT_G, "S": DEFAULT_S}

    if J == 1:
        p_G  = DEFAULT_G
        p_S  = DEFAULT_S
        p_T  = DEFAULT_T
        p_L0 = (1.0 - p_G) if responses[0] == 1 else p_S
        return {"L0": float(np.clip(p_L0, 0.01, 0.95)),
                "T":  p_T, "G": p_G, "S": p_S}

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
    p_G = (float(np.sum(C * unlearned) / sum_unlearned)
           if sum_unlearned > 1e-9 else DEFAULT_G)

    # Slip: incorrect answers while learned
    sum_learned = np.sum(K)
    p_S = (float(np.sum((1.0 - C) * K) / sum_learned)
           if sum_learned > 1e-9 else DEFAULT_S)

    # Transition (learn rate): 0→1 transitions
    num_T = sum((1.0 - K[j-1]) * K[j]   for j in range(1, J))
    den_T = sum((1.0 - K[j-1])           for j in range(1, J))
    p_T   = float(num_T / den_T) if den_T > 1e-9 else DEFAULT_T

    # ── Step 5: Boundary capping (PC-BKT requirement) ─────────────────────────
    p_G = float(np.clip(p_G, 0.01, 0.50))
    p_S = float(np.clip(p_S, 0.01, 0.50))
    p_T = float(np.clip(p_T, 0.01, 0.90))

    # Initial knowledge from Correct First Attempt
    cfa  = responses[0]
    p_L0 = float((1.0 - p_G) if cfa == 1 else p_S)
    p_L0 = float(np.clip(p_L0, 0.01, 0.95))

    return {"L0": p_L0, "T": p_T, "G": p_G, "S": p_S}


# ─────────────────────────────────────────────────────────────
# MONGODB STATE MANAGEMENT
# ─────────────────────────────────────────────────────────────

def get_mastery(student_id: str, skill_id: str) -> float:
    """Retrieve current BKT mastery from DB. Returns DEFAULT_L0 if unseen."""
    record = skill_mastery_col.find_one(
        {"student_id": student_id, "skill_id": skill_id}
    )
    return float(record["mastery"]) if record else DEFAULT_L0


def get_bkt_params(student_id: str, skill_id: str) -> Dict[str, float]:
    """Retrieve personalized BKT params from DB. Returns defaults if unseen."""
    record = bkt_params_col.find_one(
        {"student_id": student_id, "skill_id": skill_id}
    )
    if record:
        return {"L0": record["L0"], "T": record["T"],
                "G":  record["G"],  "S": record["S"]}
    return {"L0": DEFAULT_L0, "T": DEFAULT_T, "G": DEFAULT_G, "S": DEFAULT_S}


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
) -> Dict:
    """
    Full processing pipeline for one quiz session on one skill.

    Steps:
      1. Fetch existing interaction history for this student-skill pair.
      2. Re-fit EP parameters on ALL responses (history + new).
      3. Replay BKT updates from scratch with new parameters.
      4. Persist new interaction logs, updated params, updated mastery.

    Returns:
        {
          "mastery":         float,
          "level":           str,
          "params":          dict,
          "predicted_score": float,
          "correct_count":   int,
          "total_count":     int
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
    params = fit_bkt_ep(all_responses)

    # ── 3. Replay BKT from L0 with newly fitted params ────────────────────────
    mastery = params["L0"]
    for resp in all_responses:
        mastery = bkt_update(
            mastery, resp, params["T"], params["G"], params["S"]
        )

    predicted_score = predict_correctness(mastery, params["G"], params["S"])

    # ── 4. Persist new interaction logs ───────────────────────────────────────
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

    # ── 5. Upsert personalized BKT parameters ─────────────────────────────────
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

    # ── 6. Upsert skill mastery ────────────────────────────────────────────────
    correct_count = sum(all_responses)
    skill_mastery_col.update_one(
        {"student_id": student_id, "skill_id": skill_id},
        {"$set": {
            "mastery":          mastery,
            "total_attempts":   len(all_responses),
            "correct_attempts": correct_count,
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
        "total_count":     len(all_responses)
    }
