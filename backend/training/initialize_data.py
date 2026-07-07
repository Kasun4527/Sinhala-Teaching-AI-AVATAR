"""
Data Initialization Script

Bootstraps the personalization system by:
  1. Computing initial difficulty scores for any existing quiz data
  2. Running initial K-Means clustering if enough student data exists

Usage:
    cd backend
    python -m training.initialize_data
"""

import os
import sys

# Ensure backend root is on path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE_DIR)

from db import (
    interaction_logs_col,
    problem_difficulty_col,
    student_clusters_col,
    ensure_indexes
)
from services.clustering_service import train_and_save_kmeans
from services.difficulty_service import compute_difficulty


def initialize_difficulty_scores():
    """
    Scan existing interaction logs and compute difficulty
    for each unique question.
    """
    print("[Init] Computing initial difficulty scores...")

    pipeline = [
        {"$group": {
            "_id": "$question_id",
            "total_attempts":   {"$sum": 1},
            "correct_attempts": {"$sum": "$correct"},
            "skill_id":         {"$first": "$skill_id"}
        }},
        {"$match": {"_id": {"$ne": None, "$ne": ""}}}
    ]

    results = list(interaction_logs_col.aggregate(pipeline))
    count = 0

    for r in results:
        q_id = r["_id"]
        if not q_id:
            continue

        difficulty = compute_difficulty(r["total_attempts"], r["correct_attempts"])

        problem_difficulty_col.update_one(
            {"question_hash": q_id},
            {"$set": {
                "difficulty":            difficulty,
                "attempt_count":         r["total_attempts"],
                "correct_first_attempts": r["correct_attempts"],
                "skill_id":              r.get("skill_id", ""),
            }},
            upsert=True
        )
        count += 1

    print(f"[Init] Updated difficulty for {count} questions.")


def initialize_clusters():
    """Run K-Means clustering on existing student data."""
    print("[Init] Running initial K-Means clustering...")
    result = train_and_save_kmeans()
    if result:
        print(f"[Init] Clustering complete: {result}")
    else:
        print("[Init] Not enough data to run clustering (need >= 3 students with mastery data).")


def main():
    print("=" * 60)
    print("  Personalization Data Initialization")
    print("=" * 60)

    # Ensure indexes first
    ensure_indexes()

    # Step 1: Difficulty scores
    initialize_difficulty_scores()

    # Step 2: Clustering
    initialize_clusters()

    print("\n[Init] Initialization complete!")
    print("[Init] You can now start the FastAPI server with:")
    print("       uvicorn main:app --reload")


if __name__ == "__main__":
    main()
