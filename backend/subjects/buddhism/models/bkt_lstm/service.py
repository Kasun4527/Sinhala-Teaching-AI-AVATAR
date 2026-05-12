"""
service.py — Service layer for BKT-LSTM model

Bridges DB ↔ BKT-LSTM model ↔ API.
Parallels the PC-BKT service but uses the hybrid BKT+LSTM architecture.
"""

import sys
import json
import logging
from pathlib import Path
from datetime import datetime

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from ...adapter import get_all_kcs, get_student_interactions, log_interaction
from .bkt_lstm_core import BKT_LSTM_Model

logger = logging.getLogger(__name__)

MODEL_SAVE_DIR = Path(__file__).parent.parent / "models" / "saved"
MODEL_JSON = MODEL_SAVE_DIR / "bkt_lstm_state.json"
LSTM_WEIGHTS = MODEL_SAVE_DIR / "bkt_lstm_weights.pth"


class BKTLSTMService:
    """Service wrapper for the BKT-LSTM model."""

    def __init__(self):
        self.model: BKT_LSTM_Model | None = None
        # Cache recent interactions for LSTM sequence building
        self._student_history: dict[str, list] = {}

    # ------------------------------------------------------------------
    # Data loading
    # ------------------------------------------------------------------
    def load_interactions(self) -> pd.DataFrame:
        rows = get_student_interactions()
        if not rows:
            return pd.DataFrame(columns=['student_id', 'kc_id', 'correct', 'response_time'])
        df = pd.DataFrame(rows)
        df['correct'] = df['correct'].astype(int)
        return df

    # ------------------------------------------------------------------
    # Training
    # ------------------------------------------------------------------
    def train(self, n_clusters: int = 7, epochs: int = 50) -> dict:
        df = self.load_interactions()

        if df.empty or len(df) < 10:
            logger.info("Insufficient interactions. Using synthetic data for BKT-LSTM.")
            df = self._generate_synthetic_data()

        self.model = BKT_LSTM_Model(n_clusters=n_clusters)
        self.model.fit(df, epochs=epochs)

        self._save_model()

        return {
            "status": "trained",
            "model": "BKT-LSTM",
            "n_students": len(self.model.student_ids),
            "n_skills": len(self.model.kc_ids),
            "n_clusters": self.model.n_clusters,
            "input_size": self.model.input_size,
        }

    def _generate_synthetic_data(self) -> pd.DataFrame:
        kc_rows = get_all_kcs()
        kc_ids = [r['kc_id'] for r in kc_rows] if kc_rows else [
            'BUD10_01_01', 'BUD10_01_02', 'BUD10_01_03',
            'BUD10_02_01', 'BUD10_02_02'
        ]

        np.random.seed(42)
        n_students = 15
        rows = []

        for s in range(n_students):
            student_id = f"synth_student_{s:03d}"
            ability = np.random.uniform(0.3, 0.9)

            for kc in kc_ids:
                n_interactions = np.random.randint(5, 15)
                for t in range(n_interactions):
                    p_correct = min(0.95, ability + t * 0.04)
                    correct = int(np.random.random() < p_correct)
                    rows.append({
                        'student_id': student_id,
                        'kc_id': kc,
                        'correct': correct,
                        'response_time': datetime(2026, 1, 1 + s, t, 0, 0).isoformat(),
                    })

        return pd.DataFrame(rows)

    # ------------------------------------------------------------------
    # Prediction & Update
    # ------------------------------------------------------------------
    def predict(self, student_id: str, kc_id: str) -> dict:
        self._ensure_model()
        history = self._student_history.get(student_id, [])
        return self.model.predict_with_breakdown(student_id, kc_id, history)

    def update(self, student_id: str, kc_id: str, correct: bool) -> dict:
        self._ensure_model()

        # 1. BKT update
        new_p_know = self.model.update_after_response(student_id, kc_id, correct)

        # 2. Log to history cache
        if student_id not in self._student_history:
            self._student_history[student_id] = []
        self._student_history[student_id].append({
            'kc_id': kc_id,
            'correct': int(correct),
            'question_id': kc_id,
        })
        # Keep last 20 interactions
        self._student_history[student_id] = self._student_history[student_id][-20:]

        # 3. Log to database
        try:
            log_interaction(student_id, kc_id, correct)
        except Exception as e:
            logger.error(f"Failed to log interaction: {e}")

        # 4. Get full prediction with LSTM
        history = self._student_history.get(student_id, [])
        pred = self.model.predict_with_breakdown(student_id, kc_id, history)
        pred["new_p_know"] = round(new_p_know, 4)
        pred["correct"] = correct

        self._save_model()
        return pred

    # ------------------------------------------------------------------
    # Persistence
    # ------------------------------------------------------------------
    def _save_model(self):
        if self.model is None:
            return
        MODEL_SAVE_DIR.mkdir(parents=True, exist_ok=True)
        with open(MODEL_JSON, 'w') as f:
            json.dump(self.model.to_dict(), f, indent=2, default=str)
        if self.model.lstm is not None:
            self.model.save_lstm_weights(str(LSTM_WEIGHTS))

    def _load_model(self) -> bool:
        if MODEL_JSON.exists():
            try:
                with open(MODEL_JSON, 'r') as f:
                    data = json.load(f)
                self.model = BKT_LSTM_Model.from_dict(data)
                if LSTM_WEIGHTS.exists():
                    self.model.load_lstm_weights(str(LSTM_WEIGHTS))
                return True
            except Exception as e:
                logger.error(f"Failed to load BKT-LSTM: {e}")
        return False

    def _ensure_model(self):
        if self.model is not None and self.model.is_fitted:
            return
        if self._load_model():
            return
        logger.info("No saved BKT-LSTM model. Training from scratch...")
        self.train()


# Singleton
bkt_lstm_service = BKTLSTMService()
