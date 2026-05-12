"""
hybrid_core.py -- Hybrid BKT Model (Enhanced PC-BKT + BKT-LSTM)

The third and strongest model in the Hybrid-BKT system.
Combines:
  1. PC-BKT's personalized Bayesian mastery tracking
     - Empirical P(G), P(S) per skill
     - Personalized P(L0) via CFA
     - Personalized P(T) per student
     - Capability matrix + K-Means clustering (cold-start)
  2. BKT-LSTM's temporal deep learning
     - LSTM processes sequences of enriched feature vectors
     - Captures learning transfer across skills
     - Integrates problem difficulty

Training pipeline:
  Step 1: Fit PC-BKT (full EP annotation + clustering)
  Step 2: Compute problem difficulty from data
  Step 3: Prepare LSTM input sequences using PC-BKT outputs as features
  Step 4: Train LSTM on top of PC-BKT features
  Step 5: Ensemble prediction = alpha * P_pcbkt + (1-alpha) * P_lstm

This model should outperform both standalone models because:
  - PC-BKT provides interpretable, personalized BKT parameters
  - LSTM captures non-linear temporal patterns and cross-skill transfer
"""

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from typing import Dict, List, Optional, Tuple
import json
import logging

# Reuse PC-BKT and LSTM network from existing modules
from hybrid_bkt.pc_bkt_engine import PC_BKT
from hybrid_bkt.lstm_model import HybridBKTLSTM as LSTMNetwork

logger = logging.getLogger(__name__)


# ======================================================================
# Dataset
# ======================================================================

class HybridSequenceDataset(Dataset):
    """Fixed-length sequences for the Hybrid LSTM."""

    def __init__(self, sequences: List[Tuple[np.ndarray, float]]):
        self.sequences = sequences

    def __len__(self):
        return len(self.sequences)

    def __getitem__(self, idx):
        seq, target = self.sequences[idx]
        return torch.FloatTensor(seq), torch.FloatTensor([target])


# ======================================================================
# Hybrid BKT Model
# ======================================================================

class Hybrid_BKT:
    """
    Hybrid BKT = Enhanced PC-BKT backbone + LSTM temporal head.

    The PC-BKT component handles:
      - Personalized mastery P(L) per student per skill
      - Empirical P(G), P(S) per skill
      - Personalized P(T) per student
      - Capability-matrix clustering for cold-start

    The LSTM component consumes rich features at each time step:
      - Full mastery vector (all KCs) from PC-BKT
      - Student cluster one-hot (ability profile / learning transfer)
      - Problem difficulty one-hot (10 levels)
      - Correctness of current step
      - Normalized attempt count (progress signal)

    Ensemble: P_hybrid = alpha * P_pcbkt + (1-alpha) * P_lstm
    """

    def __init__(self, n_clusters: int = 4, seq_length: int = 10,
                 difficulty_levels: int = 10, hidden_size: int = 128,
                 ensemble_alpha: float = 0.65):
        # --- PC-BKT backbone ---
        self.pc_bkt = PC_BKT(n_clusters=n_clusters)

        # --- LSTM head ---
        self.seq_length = seq_length
        self.difficulty_levels = difficulty_levels
        self.hidden_size = hidden_size
        self.input_size: int = 0
        self.lstm: Optional[LSTMNetwork] = None
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

        # --- Ensemble ---
        self.ensemble_alpha = ensemble_alpha  # weight for PC-BKT component

        # --- Problem difficulty (computed from data) ---
        self.problem_difficulties: Dict[str, int] = {}

        # --- Metadata ---
        self.n_clusters = n_clusters
        self.is_fitted = False

    # ------------------------------------------------------------------
    # Full training pipeline
    # ------------------------------------------------------------------
    def fit(self, df: pd.DataFrame, epochs: int = 30):
        """
        Full Hybrid-BKT training pipeline.
        df must have: student_id, kc_id, correct, response_time
        """
        required = {'student_id', 'kc_id', 'correct', 'response_time'}
        missing = required - set(df.columns)
        if missing:
            raise ValueError(f"Missing columns: {missing}")

        logger.info("=" * 60)
        logger.info("  Hybrid-BKT: Starting training pipeline")
        logger.info("=" * 60)

        df = df.sort_values('response_time').reset_index(drop=True)

        # ----- Step 1: Train PC-BKT backbone -----
        logger.info("  Step 1/4: Training PC-BKT backbone...")
        self.pc_bkt.fit(df)

        # ----- Step 2: Compute problem difficulty -----
        logger.info("  Step 2/4: Computing problem difficulty levels...")
        self._compute_problem_difficulty(df)

        # ----- Step 3: Prepare LSTM sequences using PC-BKT features -----
        logger.info("  Step 3/4: Preparing LSTM sequences with PC-BKT features...")
        # Reset PC-BKT mastery for a clean forward pass
        self.pc_bkt.p_know = {}
        self.pc_bkt._init_personalized_priors(df)
        sequences = self._prepare_training_sequences(df)

        # ----- Step 4: Train LSTM -----
        if sequences:
            logger.info(f"  Step 4/4: Training LSTM ({epochs} epochs)...")
            self._train_lstm(sequences, epochs=epochs)
        else:
            logger.warning("  No sequences generated; LSTM not trained.")

        self.is_fitted = True
        logger.info(f"  Hybrid-BKT: Training complete. "
                     f"{len(self.pc_bkt.student_ids)} students, "
                     f"{len(self.pc_bkt.kc_ids)} skills, "
                     f"LSTM input={self.input_size}")

    # ------------------------------------------------------------------
    # Problem difficulty (from BKT-LSTM paper Section 3.3)
    # ------------------------------------------------------------------
    def _compute_problem_difficulty(self, df: pd.DataFrame):
        """
        PD(P_j) on a scale of 0-9.
        Uses first-attempt success rate mapped to 10 levels.
        """
        q_col = 'question_id' if 'question_id' in df.columns else 'kc_id'
        for q_id, group in df.groupby(q_col):
            n = len(group)
            if n >= 4:
                avg = group['correct'].mean()
                level = int(avg * 10) % 10
            else:
                level = 5
            self.problem_difficulties[str(q_id)] = level

    # ------------------------------------------------------------------
    # Feature extraction (Hybrid = PC-BKT mastery + cluster + difficulty + extras)
    # ------------------------------------------------------------------
    def _build_feature_vector(self, student_id: str, kc_id: str,
                              correct: float, question_id: str = '',
                              attempt_ratio: float = 0.0) -> np.ndarray:
        """
        Build the enriched feature vector for one time step.

        f_t = [mastery_vec | cluster_onehot | difficulty_onehot | correct | attempt_ratio]

        Components:
          - mastery_vec (num_kcs): P(L) for each KC from PC-BKT
          - cluster_onehot (n_clusters+1): ability profile encoding
          - difficulty_onehot (10): problem difficulty level
          - correct (1): whether the current step was correct
          - attempt_ratio (1): normalized progress 0..1
        """
        kc_ids = self.pc_bkt.kc_ids
        num_kcs = len(kc_ids)

        # 1. Full mastery vector from PC-BKT
        mastery_vec = np.zeros(num_kcs)
        for i, kc in enumerate(kc_ids):
            mastery_vec[i] = self.pc_bkt._get_p_know(student_id, kc)

        # 2. Cluster one-hot (ability profile / learning transfer)
        cluster_vec = np.zeros(self.n_clusters + 1)
        cluster_id = self.pc_bkt.student_clusters.get(student_id, 0)
        cluster_vec[min(cluster_id, self.n_clusters)] = 1.0

        # 3. Problem difficulty one-hot
        diff_vec = np.zeros(self.difficulty_levels)
        diff_level = self.problem_difficulties.get(str(question_id), 5)
        diff_vec[min(diff_level, self.difficulty_levels - 1)] = 1.0

        # 4. Extra scalar features
        extras = np.array([correct, attempt_ratio])

        return np.concatenate([mastery_vec, cluster_vec, diff_vec, extras])

    # ------------------------------------------------------------------
    # Sequence preparation for LSTM training
    # ------------------------------------------------------------------
    def _prepare_training_sequences(self, df: pd.DataFrame) -> List[Tuple[np.ndarray, float]]:
        """
        For each student, walk through their interactions in order.
        At each step:
          1. Build feature vector using *current* PC-BKT state
          2. Update PC-BKT with the observation
          3. Once we have seq_length features, pair with next correct as target.
        """
        sequences = []
        sorted_df = df.sort_values('response_time')

        for student_id, student_df in sorted_df.groupby('student_id'):
            rows = student_df.to_dict('records')
            if len(rows) < 3:
                continue

            history = []
            total_attempts = len(rows)

            for i, row in enumerate(rows):
                kc_id = row['kc_id']
                q_id = str(row.get('question_id', kc_id))
                correct = float(row['correct'])
                attempt_ratio = (i + 1) / total_attempts

                # Build feature BEFORE updating mastery (predict then update)
                feat = self._build_feature_vector(
                    student_id, kc_id, correct, q_id, attempt_ratio
                )
                history.append(feat)

                # Now update PC-BKT mastery with this observation
                self.pc_bkt.update_after_response(student_id, kc_id, bool(row['correct']))

                # Generate training sample
                if i + 1 < len(rows) and len(history) >= 2:
                    seq = np.array(history[-self.seq_length:])
                    if len(seq) < self.seq_length:
                        padding = np.zeros((self.seq_length - len(seq), seq.shape[1]))
                        seq = np.vstack([padding, seq])

                    target = float(rows[i + 1]['correct'])
                    sequences.append((seq, target))

        logger.info(f"    Generated {len(sequences)} Hybrid training sequences")
        return sequences

    # ------------------------------------------------------------------
    # LSTM training
    # ------------------------------------------------------------------
    def _train_lstm(self, sequences: List[Tuple[np.ndarray, float]],
                    epochs: int = 30, lr: float = 0.005, batch_size: int = 32):
        """Train the LSTM head on top of PC-BKT features."""
        if not sequences:
            return

        self.input_size = sequences[0][0].shape[1]

        self.lstm = LSTMNetwork(
            input_size=self.input_size,
            hidden_size=self.hidden_size,
            num_layers=2,
            dropout=0.3
        ).to(self.device)

        dataset = HybridSequenceDataset(sequences)
        dataloader = DataLoader(dataset, batch_size=batch_size, shuffle=True)

        optimizer = torch.optim.Adam(self.lstm.parameters(), lr=lr)
        criterion = nn.BCELoss()

        self.lstm.train()
        for epoch in range(epochs):
            total_loss = 0.0
            n_batches = 0
            for seq_batch, target_batch in dataloader:
                seq_batch = seq_batch.to(self.device)
                target_batch = target_batch.to(self.device)

                optimizer.zero_grad()
                output = self.lstm(seq_batch)
                loss = criterion(output, target_batch)
                loss.backward()
                optimizer.step()

                total_loss += loss.item()
                n_batches += 1

            if (epoch + 1) % 5 == 0 or epoch == 0:
                avg_loss = total_loss / max(n_batches, 1)
                logger.info(f"    LSTM Epoch {epoch+1}/{epochs}, Loss: {avg_loss:.4f}")

    # ------------------------------------------------------------------
    # Prediction — Hybrid Ensemble
    # ------------------------------------------------------------------
    def predict_single(self, student_id: str, kc_id: str,
                       recent_history: Optional[List[dict]] = None) -> float:
        """
        Ensemble prediction:
          P_hybrid = alpha * P_pcbkt + (1-alpha) * P_lstm

        Falls back to pure PC-BKT when LSTM unavailable.
        """
        p_pcbkt = self.pc_bkt.predict_single(student_id, kc_id)

        p_lstm = p_pcbkt  # fallback
        if self.lstm is not None and recent_history and len(recent_history) >= 2:
            try:
                seq = self._prepare_inference_sequence(student_id, recent_history)
                self.lstm.eval()
                with torch.no_grad():
                    p_lstm = float(self.lstm(seq).item())
            except Exception as e:
                logger.warning(f"Hybrid LSTM inference failed: {e}")

        final_p = self.ensemble_alpha * p_pcbkt + (1 - self.ensemble_alpha) * p_lstm
        return float(np.clip(final_p, 0.01, 0.99))

    def _prepare_inference_sequence(self, student_id: str,
                                     history: List[dict]) -> torch.Tensor:
        """Build a padded sequence for LSTM inference from recent history."""
        features = []
        for row in history[-self.seq_length:]:
            kc_id = row.get('kc_id', '')
            q_id = str(row.get('question_id', kc_id))
            correct = float(row.get('correct', 0))
            feat = self._build_feature_vector(
                student_id, kc_id, correct, q_id, 0.5
            )
            features.append(feat)

        seq = np.array(features)
        if len(seq) < self.seq_length:
            padding = np.zeros((self.seq_length - len(seq), seq.shape[1]))
            seq = np.vstack([padding, seq])

        return torch.FloatTensor(seq).unsqueeze(0).to(self.device)

    def predict_with_breakdown(self, student_id: str, kc_id: str,
                                recent_history: Optional[List[dict]] = None) -> dict:
        """Full prediction with component breakdown for the frontend."""
        p_l = self.pc_bkt._get_p_know(student_id, kc_id)
        p_g = self.pc_bkt.p_guess.get(kc_id, 0.2)
        p_s = self.pc_bkt.p_slip.get(kc_id, 0.1)
        p_t = self.pc_bkt.p_transit.get(student_id, 0.1)
        p_pcbkt = self.pc_bkt.predict_single(student_id, kc_id)

        p_lstm = p_pcbkt
        if self.lstm is not None and recent_history and len(recent_history) >= 2:
            try:
                seq = self._prepare_inference_sequence(student_id, recent_history)
                self.lstm.eval()
                with torch.no_grad():
                    p_lstm = float(self.lstm(seq).item())
            except Exception:
                pass

        final_p = self.ensemble_alpha * p_pcbkt + (1 - self.ensemble_alpha) * p_lstm

        if final_p > 0.85:
            level = "Advanced"
        elif final_p > 0.60:
            level = "Standard"
        else:
            level = "Remedial"

        return {
            "p_know": round(float(p_l), 4),
            "p_pcbkt": round(float(p_pcbkt), 4),
            "p_lstm": round(float(p_lstm), 4),
            "p_combined": round(float(np.clip(final_p, 0.01, 0.99)), 4),
            "p_guess": round(float(p_g), 4),
            "p_slip": round(float(p_s), 4),
            "p_transit": round(float(p_t), 4),
            "cluster": self.pc_bkt.student_clusters.get(student_id, -1),
            "recommend_level": level,
            "confidence": round(min(0.95, 0.5 + p_l * 0.5), 4),
        }

    # ------------------------------------------------------------------
    # Online update
    # ------------------------------------------------------------------
    def update_after_response(self, student_id: str, kc_id: str,
                               correct: bool) -> float:
        """Online update through the PC-BKT backbone."""
        return self.pc_bkt.update_after_response(student_id, kc_id, correct)

    # ------------------------------------------------------------------
    # Serialization
    # ------------------------------------------------------------------
    def to_dict(self) -> dict:
        return {
            "n_clusters": self.n_clusters,
            "seq_length": self.seq_length,
            "difficulty_levels": self.difficulty_levels,
            "hidden_size": self.hidden_size,
            "ensemble_alpha": self.ensemble_alpha,
            "input_size": self.input_size,
            "pc_bkt_state": self.pc_bkt.to_dict(),
            "problem_difficulties": self.problem_difficulties,
            "is_fitted": self.is_fitted,
        }

    @classmethod
    def from_dict(cls, d: dict) -> 'Hybrid_BKT':
        model = cls(
            n_clusters=d["n_clusters"],
            seq_length=d["seq_length"],
            difficulty_levels=d.get("difficulty_levels", 10),
            hidden_size=d.get("hidden_size", 128),
            ensemble_alpha=d.get("ensemble_alpha", 0.65),
        )
        model.input_size = d.get("input_size", 0)
        model.pc_bkt = PC_BKT.from_dict(d["pc_bkt_state"])
        model.problem_difficulties = d.get("problem_difficulties", {})
        model.is_fitted = d["is_fitted"]
        return model

    def save_lstm_weights(self, path: str):
        if self.lstm is not None:
            torch.save(self.lstm.state_dict(), path)

    def load_lstm_weights(self, path: str):
        if self.input_size > 0:
            self.lstm = LSTMNetwork(
                input_size=self.input_size,
                hidden_size=self.hidden_size,
                num_layers=2
            ).to(self.device)
            self.lstm.load_state_dict(torch.load(path, map_location=self.device))
            self.lstm.eval()
