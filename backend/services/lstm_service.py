"""
BKT-LSTM Service — Sequential Mastery Predictor

Architecture (from the BKT-LSTM paper):
  Input:  15-dim feature vector [mastery(1) + cluster_onehot(4) + difficulty_onehot(10)]
  LSTM:   200 hidden units, dropout=0.3
  Output: Single sigmoid → predicted mastery for next interaction

This service handles:
  - Model architecture definition (pure NumPy LSTM fallback, or TF if available)
  - Lazy model loading (weights from disk)
  - Feature vector construction
  - Single-step prediction
  - Graceful fallback when no trained model exists
"""

import os
import json
import numpy as np
from typing import Dict, Optional

# Try to import TensorFlow, fall back gracefully
_tf_available = False
_model = None
_model_loaded = False

try:
    import tensorflow as tf
    _tf_available = True
except ImportError:
    print("[LSTM Service] TensorFlow not installed — LSTM predictions disabled. "
          "PC-BKT will be used alone.")


# ─────────────────────────────────────────────────────────────
# PATHS
# ─────────────────────────────────────────────────────────────

BASE_DIR     = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELS_DIR   = os.path.join(BASE_DIR, "models")
WEIGHTS_PATH = os.path.join(MODELS_DIR, "bkt_lstm_weights.weights.h5")
SKILL_MAP_PATH = os.path.join(MODELS_DIR, "skill_map.json")


# ─────────────────────────────────────────────────────────────
# CONSTANTS (matching the paper)
# ─────────────────────────────────────────────────────────────

INPUT_DIM        = 15     # mastery(1) + cluster(4) + difficulty(10)
HIDDEN_UNITS     = 200
DROPOUT_RATE     = 0.3
SEQUENCE_LENGTH  = 1      # single-step prediction


# ─────────────────────────────────────────────────────────────
# MODEL DEFINITION
# ─────────────────────────────────────────────────────────────

def _build_model():
    """Build the BKT-LSTM Keras model architecture."""
    if not _tf_available:
        return None

    model = tf.keras.Sequential([
        tf.keras.layers.Input(shape=(SEQUENCE_LENGTH, INPUT_DIM)),
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
    return model


# ─────────────────────────────────────────────────────────────
# MODEL LOADING
# ─────────────────────────────────────────────────────────────

def load_model() -> bool:
    """
    Lazily load pre-trained LSTM weights from disk.
    Returns True if model loaded, False otherwise.
    """
    global _model, _model_loaded

    if _model_loaded:
        return _model is not None

    if not _tf_available:
        _model_loaded = True
        print("[LSTM Service] TensorFlow not available — LSTM disabled.")
        return False

    if not os.path.exists(WEIGHTS_PATH):
        _model_loaded = True
        print(f"[LSTM Service] No weights at {WEIGHTS_PATH} — LSTM disabled. "
              "Run training/train_lstm.py to generate.")
        return False

    try:
        _model = _build_model()
        _model.load_weights(WEIGHTS_PATH)
        _model_loaded = True
        print("[LSTM Service] Model loaded successfully.")
        return True
    except Exception as e:
        print(f"[LSTM Service] Failed to load weights: {e}")
        _model = None
        _model_loaded = True
        return False


def is_available() -> bool:
    """Check if LSTM model is ready for inference."""
    return _model is not None


# ─────────────────────────────────────────────────────────────
# FEATURE VECTOR CONSTRUCTION
# ─────────────────────────────────────────────────────────────

def build_feature_vector(
    mastery:          float,
    cluster_one_hot:  np.ndarray,
    difficulty_one_hot: np.ndarray
) -> np.ndarray:
    """
    Construct the 15-dim LSTM input feature vector:
      [mastery(1)] ++ [cluster_one_hot(4)] ++ [difficulty_one_hot(10)]
    """
    return np.concatenate([
        np.array([mastery]),
        cluster_one_hot,
        difficulty_one_hot
    ]).astype(np.float32)


# ─────────────────────────────────────────────────────────────
# PREDICTION
# ─────────────────────────────────────────────────────────────

def predict_next_mastery(
    mastery:            float,
    cluster_one_hot:    np.ndarray,
    difficulty_one_hot: np.ndarray
) -> Optional[float]:
    """
    Predict the student's mastery on the next interaction
    using the trained BKT-LSTM model.

    Returns:
        float: predicted mastery probability [0, 1]
        None:  if model is not available
    """
    if not _model_loaded:
        load_model()

    if not is_available():
        return None

    feature_vec = build_feature_vector(mastery, cluster_one_hot, difficulty_one_hot)

    # Reshape for LSTM: (batch=1, seq_len=1, features=15)
    X = feature_vec.reshape(1, SEQUENCE_LENGTH, INPUT_DIM)

    try:
        prediction = _model.predict(X, verbose=0)
        return float(prediction[0][0])
    except Exception as e:
        print(f"[LSTM Service] Prediction error: {e}")
        return None


def get_model_info() -> Dict:
    """Return model status information for diagnostics."""
    return {
        "tf_available":  _tf_available,
        "model_loaded":  is_available(),
        "weights_path":  WEIGHTS_PATH,
        "weights_exist": os.path.exists(WEIGHTS_PATH),
        "input_dim":     INPUT_DIM,
        "hidden_units":  HIDDEN_UNITS,
        "dropout_rate":  DROPOUT_RATE
    }
