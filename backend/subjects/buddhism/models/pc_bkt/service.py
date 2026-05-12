"""
service.py — Service layer connecting PC-BKT model ↔ Database ↔ API

This is the bridge that:
  1. Loads interaction data from PostgreSQL
  2. Trains/loads the PC-BKT model
  3. Provides prediction + online update methods for the API layer
"""

import sys
import json
import logging
from pathlib import Path
from datetime import datetime

import numpy as np
import pandas as pd

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from ...adapter import get_all_kcs, get_student_interactions, log_interaction
from .pc_bkt_core import PC_BKT

logger = logging.getLogger(__name__)

MODEL_SAVE_PATH = Path(__file__).parent.parent / "models" / "saved" / "pc_bkt_state.json"


class PCBKTService:
    """Service wrapper for the PC-BKT model."""

    def __init__(self):
        self.model: PC_BKT | None = None

    # ------------------------------------------------------------------
    # Data Loading
    # ------------------------------------------------------------------
    def load_interactions(self) -> pd.DataFrame:
        """Load student interaction data from the database."""
        rows = get_student_interactions()
        if not rows:
            logger.warning("No interactions found in database. Returning empty DataFrame.")
            return pd.DataFrame(columns=['student_id', 'kc_id', 'correct', 'response_time'])

        df = pd.DataFrame(rows)
        df['correct'] = df['correct'].astype(int)
        return df

    def load_interactions_for_student(self, student_id: str) -> pd.DataFrame:
        """Load interactions for a specific student."""
        all_rows = get_student_interactions()
        rows = [r for r in all_rows if r['student_id'] == student_id]
        if not rows:
            return pd.DataFrame(columns=['student_id', 'kc_id', 'correct', 'response_time'])
        return pd.DataFrame(rows)

    # ------------------------------------------------------------------
    # Training
    # ------------------------------------------------------------------
    def train(self, n_clusters: int = 3) -> dict:
        """
        Full training pipeline:
          1. Load all interactions
          2. Fit PC-BKT
          3. Save model state
          4. Return training summary
        """
        df = self.load_interactions()

        if df.empty or len(df) < 5:
            # Generate synthetic warm-up data if no real interactions exist
            logger.info("Insufficient interactions. Using synthetic warm-up data.")
            df = self._generate_synthetic_data()

        self.model = PC_BKT(n_clusters=n_clusters)
        self.model.fit(df)

        # Save model state
        self._save_model()

        return {
            "status": "trained",
            "n_students": len(self.model.student_ids),
            "n_skills": len(self.model.kc_ids),
            "n_clusters": self.model.n_clusters,
            "clusters": {
                str(k): len([s for s, c in self.model.student_clusters.items() if c == k])
                for k in range(self.model.n_clusters)
            },
            "p_guess_summary": {
                "mean": float(np.mean(list(self.model.p_guess.values()))) if self.model.p_guess else 0,
                "min": float(np.min(list(self.model.p_guess.values()))) if self.model.p_guess else 0,
                "max": float(np.max(list(self.model.p_guess.values()))) if self.model.p_guess else 0,
            },
            "p_slip_summary": {
                "mean": float(np.mean(list(self.model.p_slip.values()))) if self.model.p_slip else 0,
            },
        }

    def _generate_synthetic_data(self) -> pd.DataFrame:
        """
        Generate synthetic interaction data from the question bank
        to bootstrap the model when no real interactions exist.
        """
        # Get all KC IDs from the database
        kc_rows = get_all_kcs()
        kc_ids = [r['kc_id'] for r in kc_rows]

        if not kc_ids:
            kc_ids = ['BUD10_01_01', 'BUD10_01_02', 'BUD10_01_03',
                       'BUD10_02_01', 'BUD10_02_02']

        np.random.seed(42)
        n_students = 10
        rows = []

        for s in range(n_students):
            student_id = f"synthetic_student_{s:03d}"
            # Each synthetic student has a different ability level
            ability = np.random.uniform(0.3, 0.9)

            for kc in kc_ids:
                # 3-8 interactions per skill
                n_interactions = np.random.randint(3, 9)
                for t in range(n_interactions):
                    # Probability of correct increases with time (learning)
                    p_correct = min(0.95, ability + t * 0.05)
                    correct = int(np.random.random() < p_correct)
                    rows.append({
                        'student_id': student_id,
                        'kc_id': kc,
                        'correct': correct,
                        'response_time': datetime(2026, 1, 1 + s, t, 0, 0).isoformat(),
                    })

        return pd.DataFrame(rows)

    # ------------------------------------------------------------------
    # Prediction & Online Update
    # ------------------------------------------------------------------
    def predict(self, student_id: str, kc_id: str) -> dict:
        """Predict probability of correctness for a student on a skill."""
        self._ensure_model()

        p_correct = self.model.predict_single(student_id, kc_id)
        p_know = self.model._get_p_know(student_id, kc_id)
        p_g = self.model.p_guess.get(kc_id, 0.2)
        p_s = self.model.p_slip.get(kc_id, 0.1)
        p_t = self.model.p_transit.get(student_id, 0.1)

        return {
            "student_id": student_id,
            "kc_id": kc_id,
            "p_correct": round(p_correct, 4),
            "p_know": round(p_know, 4),
            "p_guess": round(p_g, 4),
            "p_slip": round(p_s, 4),
            "p_transit": round(p_t, 4),
            "cluster": self.model.student_clusters.get(student_id, -1),
        }

    def update(self, student_id: str, kc_id: str, correct: bool) -> dict:
        """
        Online BKT update after a student response.
        Also logs the interaction to the database.
        """
        self._ensure_model()

        # 1. Update model state
        new_p_know = self.model.update_after_response(student_id, kc_id, correct)

        # 2. Log to database
        try:
            log_interaction(student_id, kc_id, correct)
        except Exception as e:
            logger.error(f"Failed to log interaction: {e}")

        # 3. Save updated model state
        self._save_model()

        # 4. Return updated state
        p_g = self.model.p_guess.get(kc_id, 0.2)
        p_s = self.model.p_slip.get(kc_id, 0.1)
        p_t = self.model.p_transit.get(student_id, 0.1)

        return {
            "student_id": student_id,
            "kc_id": kc_id,
            "correct": correct,
            "new_p_know": round(new_p_know, 4),
            "p_correct": round(new_p_know * (1 - p_s) + (1 - new_p_know) * p_g, 4),
            "p_guess": round(p_g, 4),
            "p_slip": round(p_s, 4),
            "p_transit": round(p_t, 4),
            "confidence": round(min(0.95, 0.5 + new_p_know * 0.5), 4),
        }

    def get_student_mastery(self, student_id: str) -> dict:
        """Get full mastery state for a student across all skills."""
        self._ensure_model()
        return self.model.get_student_state(student_id)

    # ------------------------------------------------------------------
    # Model Persistence
    # ------------------------------------------------------------------
    def _save_model(self):
        """Save model state to JSON file."""
        if self.model is None:
            return
        MODEL_SAVE_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(MODEL_SAVE_PATH, 'w') as f:
            json.dump(self.model.to_dict(), f, indent=2, default=str)

    def _load_model(self) -> bool:
        """Load model from saved state. Returns True if successful."""
        if MODEL_SAVE_PATH.exists():
            try:
                with open(MODEL_SAVE_PATH, 'r') as f:
                    data = json.load(f)
                self.model = PC_BKT.from_dict(data)
                return True
            except Exception as e:
                logger.error(f"Failed to load saved model: {e}")
        return False

    def _ensure_model(self):
        """Ensure model is loaded — try saved state, then train from scratch."""
        if self.model is not None and self.model.is_fitted:
            return

        if self._load_model():
            logger.info("Loaded PC-BKT model from saved state.")
            return

        logger.info("No saved model found. Training from scratch...")
        self.train()


# Singleton service instance
pc_bkt_service = PCBKTService()
