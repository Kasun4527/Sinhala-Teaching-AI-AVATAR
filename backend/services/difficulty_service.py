"""
Problem Difficulty Service — BKT-LSTM Component

Tracks per-question difficulty on a 1-10 scale using first-attempt
success rates, as defined in the BKT-LSTM paper.

Formula:
  PD(p_j) = round(success_rate * 10)  if attempts >= 4
           = 5 (neutral default)       if attempts < 4
"""

import hashlib
import numpy as np
from typing import List
from datetime import datetime

from db import problem_difficulty_col


# ─────────────────────────────────────────────────────────────
# CONSTANTS
# ─────────────────────────────────────────────────────────────

MIN_ATTEMPTS_FOR_DIFFICULTY = 4
DEFAULT_DIFFICULTY          = 5
MAX_DIFFICULTY              = 10


# ─────────────────────────────────────────────────────────────
# QUESTION HASHING
# ─────────────────────────────────────────────────────────────

def hash_question(question_text: str) -> str:
    """Create a stable 16-char hex ID for a question from its text."""
    return hashlib.md5(question_text.encode("utf-8")).hexdigest()[:16]


# ─────────────────────────────────────────────────────────────
# DIFFICULTY CALCULATION
# ─────────────────────────────────────────────────────────────

def compute_difficulty(attempt_count: int, correct_first_attempts: int) -> int:
    """
    Priority 6: IRT-style dynamic difficulty formula.

    Difficulty is the INVERSE of success rate:
      difficulty_raw = 1.0 - (correct_first_attempts / attempt_count)

    A question answered correctly by 90% of students → difficulty 0.10 → scale 1 (Easy).
    A question answered correctly by 20% of students → difficulty 0.80 → scale 8 (Hard).

    Scale: round(difficulty_raw * 10), clamped to [1, 10].
    """
    if attempt_count < MIN_ATTEMPTS_FOR_DIFFICULTY:
        return DEFAULT_DIFFICULTY

    success_rate = correct_first_attempts / attempt_count
    difficulty_raw = 1.0 - success_rate
    difficulty = round(difficulty_raw * 10)
    return max(1, min(MAX_DIFFICULTY, int(difficulty)))


# ─────────────────────────────────────────────────────────────
# GET & UPDATE DIFFICULTY
# ─────────────────────────────────────────────────────────────

def get_difficulty(question_text: str) -> int:
    """Get difficulty for a question. Returns DEFAULT_DIFFICULTY if unknown."""
    q_hash = hash_question(question_text)
    record = problem_difficulty_col.find_one({"question_hash": q_hash})
    if record:
        return int(record.get("difficulty", DEFAULT_DIFFICULTY))
    return DEFAULT_DIFFICULTY


def update_difficulty_batch(
    questions: List[dict],
    skill_id:  str
):
    """
    Update difficulty scores after a quiz session.

    Args:
        questions: List of dicts with keys:
            "text" (question text), "student_answer", "correct_answer"
        skill_id: The skill this quiz tests
    """
    now = datetime.utcnow()
    for q in questions:
        q_text = q.get("text", "")
        if not q_text:
            continue

        q_hash     = hash_question(q_text)
        is_correct = int(q.get("student_answer") == q.get("correct_answer"))

        existing = problem_difficulty_col.find_one({"question_hash": q_hash})

        if existing:
            new_attempts = existing["attempt_count"] + 1
            new_correct  = existing["correct_first_attempts"] + is_correct
        else:
            new_attempts = 1
            new_correct  = is_correct

        new_difficulty = compute_difficulty(new_attempts, new_correct)

        problem_difficulty_col.update_one(
            {"question_hash": q_hash},
            {"$set": {
                "question_text":         q_text,
                "skill_id":              skill_id,
                "difficulty":            new_difficulty,
                "attempt_count":         new_attempts,
                "correct_first_attempts": new_correct,
                "updated_at":            now
            }},
            upsert=True
        )


def update_difficulty_single(
    question_text: str,
    is_correct:    int,
    skill_id:      str
):
    """
    Update difficulty score for a single question (Bug #10: online learning).

    Args:
        question_text: The question text
        is_correct:    1 if correct, 0 if incorrect
        skill_id:      The skill this question tests
    """
    if not question_text:
        return

    now = datetime.utcnow()
    q_hash = hash_question(question_text)

    existing = problem_difficulty_col.find_one({"question_hash": q_hash})

    if existing:
        new_attempts = existing["attempt_count"] + 1
        new_correct  = existing["correct_first_attempts"] + is_correct
    else:
        new_attempts = 1
        new_correct  = is_correct

    new_difficulty = compute_difficulty(new_attempts, new_correct)

    problem_difficulty_col.update_one(
        {"question_hash": q_hash},
        {"$set": {
            "question_text":         question_text,
            "skill_id":              skill_id,
            "difficulty":            new_difficulty,
            "attempt_count":         new_attempts,
            "correct_first_attempts": new_correct,
            "updated_at":            now
        }},
        upsert=True
    )


def get_difficulties_for_quiz(question_texts: List[str]) -> List[int]:
    """Return difficulty scores for a list of question texts."""
    return [get_difficulty(qt) for qt in question_texts]


def get_difficulty_one_hot(difficulty: int, n_levels: int = 10) -> np.ndarray:
    """One-hot encode difficulty level for LSTM feature vector."""
    vec = np.zeros(n_levels)
    idx = max(0, min(n_levels - 1, difficulty - 1))
    vec[idx] = 1.0
    return vec
