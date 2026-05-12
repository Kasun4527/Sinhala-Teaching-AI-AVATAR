"""
bkt_lstm_core.py — BKT-LSTM Hybrid Model

Implements the BKT-LSTM model from:
  Sein Minn (2021), "BKT-LSTM: Efficient Student Modeling
  for knowledge tracing and student performance prediction"

Three meaningful components (from the paper):
  1. Individual skill mastery assessed by BKT  →  P(s_t)
  2. Ability profile (learning transfer) via K-Means clustering  →  ab_z
  3. Problem difficulty  →  PD(P_j)

These are concatenated into feature vector f_t and fed to LSTM for prediction.

Ensemble: final prediction = α * P_bkt + (1-α) * P_lstm
"""

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from sklearn.cluster import KMeans
from typing import Dict, List, Optional, Tuple
import json
import logging

from .lstm_model import LSTMNetwork

logger = logging.getLogger(__name__)

# ======================================================================
# Dataset for LSTM training
# ======================================================================

class StudentSequenceDataset(Dataset):
    """Converts student interaction data into fixed-length sequences for LSTM."""

    def __init__(self, sequences: List[Tuple[np.ndarray, float]]):
        self.sequences = sequences

    def __len__(self):
        return len(self.sequences)

    def __getitem__(self, idx):
        seq, target = self.sequences[idx]
        return torch.FloatTensor(seq), torch.FloatTensor([target])


# ======================================================================
# BKT-LSTM Model
# ======================================================================

class BKT_LSTM_Model:
    """
    Hybrid BKT-LSTM model combining:
      - BKT per-skill mastery tracking (from PC-BKT)
      - K-Means ability profiling (learning transfer)
      - Problem difficulty encoding
      - LSTM temporal prediction
    """

    def __init__(self, n_clusters: int = 7, seq_length: int = 10,
                 difficulty_levels: int = 10, hidden_size: int = 128,
                 ensemble_alpha: float = 0.6):
        # BKT parameters (per-skill)
        self.p_l0: Dict[str, float] = {}     # P(L0) per kc_id
        self.p_guess: Dict[str, float] = {}   # P(G) per kc_id
        self.p_slip: Dict[str, float] = {}    # P(S) per kc_id
        self.p_transit: Dict[str, float] = {} # P(T) per kc_id

        # Per-student per-skill mastery state
        self.p_know: Dict[str, Dict[str, float]] = {}

        # Clustering
        self.n_clusters = n_clusters
        self.kmeans: Optional[KMeans] = None
        self.student_clusters: Dict[str, int] = {}  # student_id → cluster_id at current interval

        # LSTM
        self.seq_length = seq_length
        self.difficulty_levels = difficulty_levels
        self.hidden_size = hidden_size

        # Feature size = num_kcs (mastery) + n_clusters+1 (ability one-hot) + difficulty_levels
        # Will be computed dynamically in fit()
        self.input_size: int = 0
        self.lstm: Optional[LSTMNetwork] = None
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

        # Ensemble weight
        self.ensemble_alpha = ensemble_alpha  # weight for BKT component

        # Metadata
        self.kc_ids: List[str] = []
        self.kc_to_idx: Dict[str, int] = {}
        self.student_ids: List[str] = []
        self.problem_difficulties: Dict[str, int] = {}  # question_id → difficulty level (0-9)
        self.is_fitted = False

    # ------------------------------------------------------------------
    # Step 1: Fit BKT parameters per skill (brute force search)
    # ------------------------------------------------------------------
    def fit_bkt(self, df: pd.DataFrame):
        """
        Fit standard BKT parameters for each skill using brute-force grid search.
        Paper Section 3.1: "We apply brute-force search algorithm to fit BKT."
        """
        logger.info("  BKT-LSTM Step 1: Fitting BKT parameters per skill...")

        for kc_id, group in df.groupby('kc_id'):
            corrects = group['correct'].values.astype(float)
            n = len(corrects)

            if n < 3:
                self.p_l0[kc_id] = 0.3
                self.p_guess[kc_id] = 0.2
                self.p_slip[kc_id] = 0.1
                self.p_transit[kc_id] = 0.1
                continue

            # Grid search over parameter space
            best_params = None
            best_ll = -np.inf

            for l0 in np.arange(0.05, 0.95, 0.1):
                for g in np.arange(0.05, 0.45, 0.1):
                    for s in np.arange(0.05, 0.35, 0.1):
                        for t in np.arange(0.05, 0.55, 0.1):
                            ll = self._bkt_log_likelihood(corrects, l0, g, s, t)
                            if ll > best_ll:
                                best_ll = ll
                                best_params = (l0, g, s, t)

            self.p_l0[kc_id] = best_params[0]
            self.p_guess[kc_id] = best_params[1]
            self.p_slip[kc_id] = best_params[2]
            self.p_transit[kc_id] = best_params[3]

        self.kc_ids = sorted(self.p_l0.keys())
        self.kc_to_idx = {kc: i for i, kc in enumerate(self.kc_ids)}

    def _bkt_log_likelihood(self, corrects: np.ndarray, l0: float,
                            g: float, s: float, t: float) -> float:
        """Compute log-likelihood for a sequence under BKT params."""
        p_l = l0
        ll = 0.0
        for c in corrects:
            p_correct = p_l * (1 - s) + (1 - p_l) * g
            p_correct = np.clip(p_correct, 1e-6, 1 - 1e-6)
            ll += c * np.log(p_correct) + (1 - c) * np.log(1 - p_correct)

            # Posterior update
            if c:
                denom = p_l * (1 - s) + (1 - p_l) * g
                p_l_post = (p_l * (1 - s)) / denom if denom > 0 else p_l
            else:
                denom = p_l * s + (1 - p_l) * (1 - g)
                p_l_post = (p_l * s) / denom if denom > 0 else p_l

            p_l = p_l_post + (1 - p_l_post) * t
            p_l = min(p_l, 0.95)

        return ll

    def get_bkt_mastery(self, student_id: str, kc_id: str) -> float:
        """Get current BKT mastery P(L) for a student on a skill."""
        if student_id in self.p_know and kc_id in self.p_know[student_id]:
            return self.p_know[student_id][kc_id]
        return self.p_l0.get(kc_id, 0.3)

    def update_bkt_mastery(self, student_id: str, kc_id: str, correct: bool) -> float:
        """Online BKT update after a single response."""
        p_l = self.get_bkt_mastery(student_id, kc_id)
        p_g = self.p_guess.get(kc_id, 0.2)
        p_s = self.p_slip.get(kc_id, 0.1)
        p_t = self.p_transit.get(kc_id, 0.1)

        if correct:
            denom = p_l * (1 - p_s) + (1 - p_l) * p_g
            p_l_post = (p_l * (1 - p_s)) / denom if denom > 0 else p_l
        else:
            denom = p_l * p_s + (1 - p_l) * (1 - p_g)
            p_l_post = (p_l * p_s) / denom if denom > 0 else p_l

        new_p_l = p_l_post + (1 - p_l_post) * p_t
        new_p_l = min(new_p_l, 0.95)

        if student_id not in self.p_know:
            self.p_know[student_id] = {}
        self.p_know[student_id][kc_id] = new_p_l
        return new_p_l

    # ------------------------------------------------------------------
    # Step 2: Compute problem difficulty (Paper Section 3.3)
    # ------------------------------------------------------------------
    def compute_problem_difficulty(self, df: pd.DataFrame):
        """
        PD(P_j) = modulo(avg_success_rate * 10, 10)
        Scale 1-10. If <4 attempts, difficulty = 5.
        """
        logger.info("  BKT-LSTM Step 2: Computing problem difficulty...")

        # Group by question_id if available, else by kc_id
        q_col = 'question_id' if 'question_id' in df.columns else 'kc_id'

        for q_id, group in df.groupby(q_col):
            n_attempts = len(group)
            if n_attempts >= 4:
                avg_success = group['correct'].mean()
                difficulty = int(avg_success * 10) % 10
            else:
                difficulty = 5
            self.problem_difficulties[str(q_id)] = difficulty

    # ------------------------------------------------------------------
    # Step 3: Detect ability profile via K-Means (Paper Section 3.2)
    # ------------------------------------------------------------------
    def compute_ability_profiles(self, df: pd.DataFrame):
        """
        Build performance vectors and cluster students.
        Paper: Every 20 attempts = 1 time interval.
        Performance vector = success rate per skill from interval 1 to z.
        """
        logger.info("  BKT-LSTM Step 3: Computing ability profiles via K-Means...")

        # Build performance vectors (cumulative success rate per skill)
        perf_matrix = df.groupby(['student_id', 'kc_id'])['correct'].mean().unstack(fill_value=0.5)
        self.student_ids = list(perf_matrix.index)

        n_samples = len(perf_matrix)

        # Need at least 2 students to cluster
        if n_samples < 2:
            logger.warning("Too few students for K-Means clustering, all assigned to cluster 0")
            for sid in self.student_ids:
                self.student_clusters[sid] = 0
            return

        actual_clusters = min(self.n_clusters, n_samples)

        self.kmeans = KMeans(n_clusters=actual_clusters, random_state=42, n_init=10)
        labels = self.kmeans.fit_predict(perf_matrix.values)

        for i, sid in enumerate(self.student_ids):
            self.student_clusters[sid] = int(labels[i])

    # ------------------------------------------------------------------
    # Step 4: Prepare LSTM feature sequences (Paper Section 3.4)
    # ------------------------------------------------------------------
    def _build_feature_vector(self, kc_id: str, student_id: str,
                              question_id: str = '') -> np.ndarray:
        """
        Build feature vector f_t = {P(s_t), ab_z_onehot, PD_onehot}

        Components:
          - Skill mastery vector: P(L) for each KC (num_kcs values)
          - Ability profile one-hot: n_clusters+1 values (cluster 0 = initial)
          - Problem difficulty one-hot: 10 levels
        """
        num_kcs = len(self.kc_ids)

        # 1. Skill mastery vector (all KCs for this student)
        mastery_vec = np.zeros(num_kcs)
        for i, kc in enumerate(self.kc_ids):
            mastery_vec[i] = self.get_bkt_mastery(student_id, kc)

        # 2. Ability profile one-hot (n_clusters + 1 for initial profile)
        ability_vec = np.zeros(self.n_clusters + 1)
        cluster = self.student_clusters.get(student_id, 0)
        ability_vec[min(cluster, self.n_clusters)] = 1.0

        # 3. Problem difficulty one-hot (10 levels)
        diff_vec = np.zeros(self.difficulty_levels)
        diff_level = self.problem_difficulties.get(str(question_id), 5)
        diff_vec[min(diff_level, self.difficulty_levels - 1)] = 1.0

        return np.concatenate([mastery_vec, ability_vec, diff_vec])

    def prepare_training_sequences(self, df: pd.DataFrame) -> List[Tuple[np.ndarray, float]]:
        """
        Convert interaction data into (sequence, target) pairs for LSTM training.
        Each sequence is the last `seq_length` feature vectors for a student.
        Target is the correctness of the next response.
        """
        logger.info("  BKT-LSTM Step 4: Preparing LSTM training sequences...")

        sequences = []
        sorted_df = df.sort_values('response_time')

        for student_id, student_df in sorted_df.groupby('student_id'):
            rows = student_df.to_dict('records')
            if len(rows) < 2:
                continue

            # Initialize BKT mastery for this student
            if student_id not in self.p_know:
                self.p_know[student_id] = {}

            history = []
            for i, row in enumerate(rows):
                kc_id = row['kc_id']
                q_id = str(row.get('question_id', kc_id))

                feat = self._build_feature_vector(kc_id, student_id, q_id)
                history.append(feat)

                # Update BKT mastery after this step
                self.update_bkt_mastery(student_id, kc_id, bool(row['correct']))

                # Generate training sample: last seq_length features → next correctness
                if i + 1 < len(rows) and len(history) >= 2:
                    # Pad or truncate history
                    seq = np.array(history[-self.seq_length:])
                    if len(seq) < self.seq_length:
                        padding = np.zeros((self.seq_length - len(seq), seq.shape[1]))
                        seq = np.vstack([padding, seq])

                    target = float(rows[i + 1]['correct'])
                    sequences.append((seq, target))

        logger.info(f"    Generated {len(sequences)} training sequences")
        return sequences

    # ------------------------------------------------------------------
    # Step 5: Train LSTM (Paper Section 3.4.1)
    # ------------------------------------------------------------------
    def train_lstm(self, sequences: List[Tuple[np.ndarray, float]],
                   epochs: int = 50, lr: float = 0.01, batch_size: int = 32):
        """
        Train the LSTM component using cross-entropy loss.
        Paper: "cross-entropy loss l between p and actual response r_t"
        """
        if not sequences:
            logger.warning("No sequences to train on!")
            return

        logger.info(f"  BKT-LSTM Step 5: Training LSTM ({epochs} epochs, lr={lr})...")

        # Determine input size from first sequence
        self.input_size = sequences[0][0].shape[1]

        self.lstm = LSTMNetwork(
            input_size=self.input_size,
            hidden_size=self.hidden_size,
            num_layers=2,
            dropout=0.3
        ).to(self.device)

        dataset = StudentSequenceDataset(sequences)
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

            if (epoch + 1) % 10 == 0 or epoch == 0:
                avg_loss = total_loss / max(n_batches, 1)
                logger.info(f"    Epoch {epoch+1}/{epochs}, Loss: {avg_loss:.4f}")

    # ------------------------------------------------------------------
    # Full training pipeline
    # ------------------------------------------------------------------
    def fit(self, df: pd.DataFrame, epochs: int = 50):
        """
        Full BKT-LSTM training pipeline.
        df must have: student_id, kc_id, correct, response_time
        """
        required = {'student_id', 'kc_id', 'correct', 'response_time'}
        missing = required - set(df.columns)
        if missing:
            raise ValueError(f"Missing columns: {missing}")

        logger.info("BKT-LSTM: Starting training pipeline...")
        df = df.sort_values('response_time').reset_index(drop=True)

        # 1. Fit BKT parameters per skill
        self.fit_bkt(df)

        # 2. Compute problem difficulty
        self.compute_problem_difficulty(df)

        # 3. Detect ability profiles via clustering
        self.compute_ability_profiles(df)

        # 4. Reset mastery states for clean training pass
        self.p_know = {}

        # 5. Prepare LSTM sequences (this also updates BKT mastery internally)
        sequences = self.prepare_training_sequences(df)

        # 6. Train LSTM
        if sequences:
            self.train_lstm(sequences, epochs=epochs)

        self.is_fitted = True
        logger.info(f"BKT-LSTM: Training complete. "
                     f"{len(self.student_ids)} students, "
                     f"{len(self.kc_ids)} skills, "
                     f"LSTM input_size={self.input_size}")

    # ------------------------------------------------------------------
    # Prediction (Paper Section 3.4 — ensemble)
    # ------------------------------------------------------------------
    def predict_single(self, student_id: str, kc_id: str,
                       recent_history: Optional[List[dict]] = None) -> float:
        """
        Predict P(correct) using ensemble: α * P_bkt + (1-α) * P_lstm

        If LSTM is not available or no history, falls back to pure BKT.
        """
        # BKT prediction
        p_l = self.get_bkt_mastery(student_id, kc_id)
        p_g = self.p_guess.get(kc_id, 0.2)
        p_s = self.p_slip.get(kc_id, 0.1)
        p_bkt = p_l * (1 - p_s) + (1 - p_l) * p_g

        # LSTM prediction
        p_lstm = p_bkt  # fallback
        if self.lstm is not None and recent_history:
            try:
                seq = self._prepare_inference_sequence(student_id, recent_history)
                self.lstm.eval()
                with torch.no_grad():
                    p_lstm = float(self.lstm(seq).item())
            except Exception as e:
                logger.warning(f"LSTM inference failed: {e}")

        # Ensemble
        final_p = self.ensemble_alpha * p_bkt + (1 - self.ensemble_alpha) * p_lstm
        return float(np.clip(final_p, 0.01, 0.99))

    def _prepare_inference_sequence(self, student_id: str,
                                     history: List[dict]) -> torch.Tensor:
        """Build an inference-ready sequence from recent interaction history."""
        features = []
        for row in history[-self.seq_length:]:
            kc_id = row.get('kc_id', '')
            q_id = str(row.get('question_id', kc_id))
            feat = self._build_feature_vector(kc_id, student_id, q_id)
            features.append(feat)

        seq = np.array(features)
        if len(seq) < self.seq_length:
            padding = np.zeros((self.seq_length - len(seq), seq.shape[1]))
            seq = np.vstack([padding, seq])

        return torch.FloatTensor(seq).unsqueeze(0).to(self.device)

    def predict_with_breakdown(self, student_id: str, kc_id: str,
                                recent_history: Optional[List[dict]] = None) -> dict:
        """Full prediction with component breakdown for the frontend."""
        p_l = self.get_bkt_mastery(student_id, kc_id)
        p_g = self.p_guess.get(kc_id, 0.2)
        p_s = self.p_slip.get(kc_id, 0.1)
        p_t = self.p_transit.get(kc_id, 0.1)
        p_bkt = p_l * (1 - p_s) + (1 - p_l) * p_g

        p_lstm = p_bkt
        if self.lstm is not None and recent_history:
            try:
                seq = self._prepare_inference_sequence(student_id, recent_history)
                self.lstm.eval()
                with torch.no_grad():
                    p_lstm = float(self.lstm(seq).item())
            except Exception:
                pass

        final_p = self.ensemble_alpha * p_bkt + (1 - self.ensemble_alpha) * p_lstm

        # Recommendation level from the paper
        if final_p > 0.85:
            level = "Advanced"
        elif final_p > 0.6:
            level = "Standard"
        else:
            level = "Remedial"

        return {
            "p_know": round(float(p_l), 4),
            "p_bkt": round(float(p_bkt), 4),
            "p_lstm": round(float(p_lstm), 4),
            "p_combined": round(float(np.clip(final_p, 0.01, 0.99)), 4),
            "p_guess": round(float(p_g), 4),
            "p_slip": round(float(p_s), 4),
            "p_transit": round(float(p_t), 4),
            "cluster": self.student_clusters.get(student_id, 0),
            "recommend_level": level,
            "confidence": round(min(0.95, 0.5 + p_l * 0.5), 4),
        }

    # ------------------------------------------------------------------
    # Online update
    # ------------------------------------------------------------------
    def update_after_response(self, student_id: str, kc_id: str,
                               correct: bool) -> float:
        """Online BKT update + return new mastery."""
        return self.update_bkt_mastery(student_id, kc_id, correct)

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
            "p_l0": self.p_l0,
            "p_guess": self.p_guess,
            "p_slip": self.p_slip,
            "p_transit": self.p_transit,
            "p_know": self.p_know,
            "student_clusters": self.student_clusters,
            "problem_difficulties": self.problem_difficulties,
            "kc_ids": self.kc_ids,
            "kc_to_idx": self.kc_to_idx,
            "student_ids": self.student_ids,
            "is_fitted": self.is_fitted,
        }

    @classmethod
    def from_dict(cls, d: dict) -> 'BKT_LSTM_Model':
        model = cls(
            n_clusters=d["n_clusters"],
            seq_length=d["seq_length"],
            difficulty_levels=d.get("difficulty_levels", 10),
            hidden_size=d.get("hidden_size", 128),
            ensemble_alpha=d.get("ensemble_alpha", 0.6),
        )
        model.input_size = d.get("input_size", 0)
        model.p_l0 = d["p_l0"]
        model.p_guess = d["p_guess"]
        model.p_slip = d["p_slip"]
        model.p_transit = d["p_transit"]
        model.p_know = d["p_know"]
        model.student_clusters = d["student_clusters"]
        model.problem_difficulties = d.get("problem_difficulties", {})
        model.kc_ids = d["kc_ids"]
        model.kc_to_idx = d.get("kc_to_idx", {})
        model.student_ids = d["student_ids"]
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
