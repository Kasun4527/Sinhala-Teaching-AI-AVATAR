"""
🧠 UNIVERSAL HYBRID BKT MODULE
================================
Single source of truth for Bayesian Knowledge Tracing across ALL subjects.

This module provides a unified interface for:
- Predicting student mastery (P(Know))
- Updating model after quiz responses
- Retrieving student learning state
- Training the hybrid model

Usage:
    from hybrid_bkt.inference import (
        predict_next_response,
        update_student_hybrid_state,
        get_hybrid_mastery,
        train_hybrid_model
    )

Features:
- Subject-agnostic: works with Buddhism, Arabic, any subject
- Quiz-agnostic: works with pre/post quizzes, any assessment
- Hybrid approach: PC-BKT + LSTM for robust predictions
- Persistent state: MongoDB-backed for scalability
"""

from .inference import (
    predict_next_response,
    update_student_hybrid_state,
    get_hybrid_mastery,
    train_hybrid_model
)

__all__ = [
    'predict_next_response',
    'update_student_hybrid_state',
    'get_hybrid_mastery',
    'train_hybrid_model'
]

