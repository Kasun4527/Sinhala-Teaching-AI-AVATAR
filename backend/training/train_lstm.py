"""
BKT-LSTM Offline Training Script

Reads interaction_logs from MongoDB, constructs feature sequences,
and trains the LSTM model. Saves weights to models/bkt_lstm_weights.weights.h5.

Usage:
    cd backend
    python -m training.train_lstm

Requirements:
    - TensorFlow 2.x installed
    - MongoDB running with interaction_logs populated
    - At least ~50 interaction records recommended
"""

import os
import sys
import json
import numpy as np
from datetime import datetime

# Ensure backend root is on path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE_DIR)

from db import interaction_logs_col, skill_mastery_col
from services.bkt_service import (
    fit_bkt_ep, bkt_update, DEFAULT_L0, DEFAULT_T, DEFAULT_G, DEFAULT_S
)
from services.clustering_service import (
    get_student_cluster, get_cluster_one_hot, get_all_skill_ids
)
from services.difficulty_service import get_difficulty, get_difficulty_one_hot

# ─────────────────────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────────────────────

MODELS_DIR     = os.path.join(BASE_DIR, "models")
WEIGHTS_PATH   = os.path.join(MODELS_DIR, "bkt_lstm_weights.weights.h5")
SKILL_MAP_PATH = os.path.join(MODELS_DIR, "skill_map.json")
INPUT_DIM      = 15
HIDDEN_UNITS   = 200
DROPOUT_RATE   = 0.3
EPOCHS         = 50
BATCH_SIZE     = 32
SEQUENCE_LEN   = 1     # single-step: each interaction = 1 timestep


def build_training_data():
    """
    Build (X, y) arrays from MongoDB interaction logs.

    For each student-skill pair:
      1. Fetch interaction history sorted by time
      2. Re-fit EP → get BKT params
      3. Replay BKT updates
      4. At each step t, build feature vector [mastery, cluster_oh, difficulty_oh]
      5. Target y = correctness of NEXT interaction

    Returns:
        X: np.ndarray shape (N, 1, 15)
        y: np.ndarray shape (N, 1)
    """
    print("[Training] Building training data from interaction_logs...")

    # Get all unique (student_id, skill_id) pairs
    pipeline = [
        {"$group": {"_id": {"student_id": "$student_id", "skill_id": "$skill_id"}}},
        {"$sort": {"_id.student_id": 1, "_id.skill_id": 1}}
    ]
    pairs = list(interaction_logs_col.aggregate(pipeline))
    print(f"[Training] Found {len(pairs)} student-skill pairs.")

    all_X = []
    all_y = []

    for pair_doc in pairs:
        student_id = pair_doc["_id"]["student_id"]
        skill_id   = pair_doc["_id"]["skill_id"]

        # Fetch interactions sorted chronologically
        interactions = list(interaction_logs_col.find(
            {"student_id": student_id, "skill_id": skill_id},
            sort=[("created_at", 1)]
        ))

        if len(interactions) < 2:
            continue    # need at least 2 interactions for (input, target)

        responses = [int(doc["correct"]) for doc in interactions]

        # Fit EP params on full history
        params = fit_bkt_ep(responses)

        # Get cluster info
        cluster_id = get_student_cluster(student_id)
        cluster_oh = get_cluster_one_hot(cluster_id)

        # Replay BKT + build features
        mastery = params["L0"]

        for t in range(len(responses) - 1):
            # Feature at time t
            q_id = interactions[t].get("question_id", "")
            diff = interactions[t].get("difficulty", 5)
            diff_oh = get_difficulty_one_hot(diff)

            feature = np.concatenate([
                np.array([mastery]),
                cluster_oh,
                diff_oh
            ]).astype(np.float32)

            # Target: correctness of next interaction
            target = float(responses[t + 1])

            all_X.append(feature)
            all_y.append(target)

            # Update mastery after this step
            mastery = bkt_update(
                mastery, responses[t],
                params["T"], params["G"], params["S"]
            )

    X = np.array(all_X).reshape(-1, SEQUENCE_LEN, INPUT_DIM)
    y = np.array(all_y).reshape(-1, 1)

    print(f"[Training] Built {len(all_X)} samples.")
    return X, y


def train():
    """Full training pipeline."""
    try:
        import tensorflow as tf
    except ImportError:
        print("[Training] ERROR: TensorFlow not installed. Install with:")
        print("    pip install tensorflow")
        sys.exit(1)

    os.makedirs(MODELS_DIR, exist_ok=True)

    X, y = build_training_data()

    if len(X) < 10:
        print("[Training] Not enough data to train (need at least 10 samples).")
        print("[Training] Let students take more quizzes first.")
        return

    # Build model
    model = tf.keras.Sequential([
        tf.keras.layers.Input(shape=(SEQUENCE_LEN, INPUT_DIM)),
        tf.keras.layers.LSTM(
            HIDDEN_UNITS,
            return_sequences=False,
            dropout=DROPOUT_RATE,
            recurrent_dropout=0.0
        ),
        tf.keras.layers.Dense(1, activation="sigmoid")
    ])

    model.compile(
        optimizer="adam",
        loss="binary_crossentropy",
        metrics=["accuracy"]
    )

    model.summary()

    # Train
    print(f"\n[Training] Training on {len(X)} samples for {EPOCHS} epochs...")
    history = model.fit(
        X, y,
        epochs=EPOCHS,
        batch_size=BATCH_SIZE,
        validation_split=0.2,
        verbose=1
    )

    # Save weights
    model.save_weights(WEIGHTS_PATH)
    print(f"[Training] Weights saved to: {WEIGHTS_PATH}")

    # Save skill map
    all_skills = get_all_skill_ids()
    with open(SKILL_MAP_PATH, "w", encoding="utf-8") as f:
        json.dump({"skill_ids": all_skills, "trained_at": datetime.utcnow().isoformat()}, f)
    print(f"[Training] Skill map saved to: {SKILL_MAP_PATH}")

    # Print results
    final_loss = history.history["loss"][-1]
    final_acc  = history.history["accuracy"][-1]
    print(f"\n[Training] Final → loss={final_loss:.4f}, accuracy={final_acc:.4f}")

    if "val_loss" in history.history:
        val_loss = history.history["val_loss"][-1]
        val_acc  = history.history["val_accuracy"][-1]
        print(f"[Training] Val   → loss={val_loss:.4f}, accuracy={val_acc:.4f}")

    print("[Training] Done! The LSTM model is now ready for inference.")
    print("[Training] Restart the FastAPI server to load the new weights.")


if __name__ == "__main__":
    train()
