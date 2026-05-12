"""
pc_bkt_core.py — Personalized Clustered BKT (PC-BKT) Model

Implements the PC-BKT model from:
  Nedungadi & Remya (2014), "Predicting Students' Performance on
  Intelligent Tutoring System - Personalized Clustered BKT (PC-BKT) Model"

Key concepts:
  1. Personalized P(L0) per student per skill based on CFA
  2. Empirical Probabilities for P(G), P(S), P(T)
  3. Capability Matrix B (N x K proportion-correct matrix)
  4. K-Means clustering of students by capability profile
  5. Cold-start: new students receive cluster-average priors
"""

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from typing import Dict, Tuple, Optional
import json
import logging

logger = logging.getLogger(__name__)


class PC_BKT:
    """Personalized Clustered Bayesian Knowledge Tracing model."""

    def __init__(self, n_clusters: int = 3, p_know_cap: float = 0.95):
        self.n_clusters = n_clusters
        self.p_know_cap = p_know_cap          # Max P(L) to prevent ceiling

        # Per-skill global parameters (computed via EP)
        self.p_guess: Dict[str, float] = {}   # P(G) per kc_id
        self.p_slip: Dict[str, float] = {}    # P(S) per kc_id

        # Per-student parameters
        self.p_transit: Dict[str, float] = {} # P(T) per student_id
        self.p_know: Dict[str, Dict[str, float]] = {}  # P(L)[student][skill]

        # Capability matrix & clustering
        self.capability_matrix: Optional[pd.DataFrame] = None
        self.kmeans: Optional[KMeans] = None
        self.student_clusters: Dict[str, int] = {}
        self.cluster_priors: Dict[int, Dict[str, float]] = {}

        # Metadata
        self.kc_ids: list = []
        self.student_ids: list = []
        self.is_fitted = False

    # ------------------------------------------------------------------
    # Step 1: Annotate Knowledge Sequences using EP
    # ------------------------------------------------------------------
    def _annotate_knowledge(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Annotate each row with a binary knowledge state (0=unknown, 1=known).
        Uses the Empirical Probabilities heuristic from Hawkins et al. (2011):
          - Try all possible switch-points and pick the best fit.
          - Simplified: find the point where student transitions from mostly-wrong to mostly-right.
        """
        annotated = df.copy()
        annotated['knowledge'] = 0

        for (sid, kc), group in df.groupby(['student_id', 'kc_id']):
            corrects = group['correct'].values
            n = len(corrects)
            if n == 0:
                continue

            # Try each possible transition point (0 = never learned, n = always knew)
            best_point = 0
            best_score = -np.inf

            for t in range(n + 1):
                # Before t: unknown (correct = guess); after t: known (incorrect = slip)
                before = corrects[:t]
                after = corrects[t:]

                score = 0
                if len(before) > 0:
                    score += np.sum(1 - before)  # reward unknowns being wrong
                if len(after) > 0:
                    score += np.sum(after)        # reward knowns being right

                if score > best_score:
                    best_score = score
                    best_point = t

            # Build knowledge sequence: 0 before transition, 1 after (no forgetting)
            knowledge_seq = np.zeros(n)
            knowledge_seq[best_point:] = 1
            annotated.loc[group.index, 'knowledge'] = knowledge_seq

        return annotated

    # ------------------------------------------------------------------
    # Step 2: Compute Empirical P(G), P(S) per skill
    # ------------------------------------------------------------------
    def _compute_ep_params(self, annotated_df: pd.DataFrame):
        """
        From annotated data, compute:
          P(G) = Σ(correct * (1-knowledge)) / Σ(1-knowledge)  per skill
          P(S) = Σ((1-correct) * knowledge) / Σ(knowledge)    per skill
        """
        for kc_id, group in annotated_df.groupby('kc_id'):
            K = group['knowledge'].values
            C = group['correct'].values

            denom_g = np.sum(1 - K)
            denom_s = np.sum(K)

            self.p_guess[kc_id] = float(np.sum(C * (1 - K)) / denom_g) if denom_g > 0 else 0.2
            self.p_slip[kc_id] = float(np.sum((1 - C) * K) / denom_s) if denom_s > 0 else 0.1

            # Clamp to reasonable bounds
            self.p_guess[kc_id] = np.clip(self.p_guess[kc_id], 0.01, 0.4)
            self.p_slip[kc_id] = np.clip(self.p_slip[kc_id], 0.01, 0.3)

    # ------------------------------------------------------------------
    # Step 3: Compute per-student P(T) (learn/transition rate)
    # ------------------------------------------------------------------
    def _compute_transit(self, annotated_df: pd.DataFrame):
        """
        P_i(T) = Σ_{j≠0} (1 - K_{j-1}) * K_j  /  Σ_{j≠0} (1 - K_{j-1})
        per student across all their interactions.
        """
        for sid, group in annotated_df.groupby('student_id'):
            K = group['knowledge'].values
            if len(K) < 2:
                self.p_transit[sid] = 0.1
                continue

            numerator = 0.0
            denominator = 0.0
            for j in range(1, len(K)):
                denominator += (1 - K[j - 1])
                numerator += (1 - K[j - 1]) * K[j]

            self.p_transit[sid] = float(numerator / denominator) if denominator > 0 else 0.1
            self.p_transit[sid] = np.clip(self.p_transit[sid], 0.01, 0.5)

    # ------------------------------------------------------------------
    # Step 4: Build Capability Matrix B (N × K)
    # ------------------------------------------------------------------
    def build_capability_matrix(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        B_ik = proportion of correctly answered items involving skill k
               that student i attempted. If no data, B_ik = 0.5.
        """
        matrix = df.groupby(['student_id', 'kc_id'])['correct'].mean().unstack(fill_value=0.5)
        self.capability_matrix = matrix
        self.kc_ids = list(matrix.columns)
        self.student_ids = list(matrix.index)
        return matrix

    # ------------------------------------------------------------------
    # Step 5: K-Means Clustering
    # ------------------------------------------------------------------
    def fit_clustering(self):
        """
        Cluster students into n_clusters (High/Medium/Low) groups
        based on their capability matrix row vectors.
        """
        if self.capability_matrix is None:
            raise ValueError("Must call build_capability_matrix() first")

        n_samples = len(self.capability_matrix)
        actual_clusters = min(self.n_clusters, n_samples)

        if actual_clusters < 2:
            # Not enough students to cluster
            for sid in self.student_ids:
                self.student_clusters[sid] = 0
            logger.warning("Too few students for clustering, all assigned to cluster 0")
            return

        self.kmeans = KMeans(n_clusters=actual_clusters, random_state=42, n_init=10)
        labels = self.kmeans.fit_predict(self.capability_matrix.values)

        for i, sid in enumerate(self.student_ids):
            self.student_clusters[sid] = int(labels[i])

        # Pre-compute cluster average priors for cold-start
        self._compute_cluster_priors()

    def _compute_cluster_priors(self):
        """Compute average P(L0) for each cluster for cold-start initialization."""
        for cluster_id in range(self.n_clusters):
            cluster_students = [
                sid for sid, c in self.student_clusters.items() if c == cluster_id
            ]
            if not cluster_students:
                continue

            cluster_priors = {}
            for kc in self.kc_ids:
                vals = [
                    self.p_know.get(sid, {}).get(kc, 0.5)
                    for sid in cluster_students
                ]
                cluster_priors[kc] = float(np.mean(vals)) if vals else 0.3
            self.cluster_priors[cluster_id] = cluster_priors

    # ------------------------------------------------------------------
    # Step 6: Initialize Personalized P(L0) per student per skill
    # ------------------------------------------------------------------
    def _init_personalized_priors(self, df: pd.DataFrame):
        """
        P_ik(L0):
          If CFA_ik of first performance = 1 → P(L0) = 1 - P(G)
          If CFA_ik of first performance = 0 → P(L0) = P(S)
        """
        for (sid, kc), group in df.groupby(['student_id', 'kc_id']):
            first_correct = group['correct'].iloc[0]

            p_g = self.p_guess.get(kc, 0.2)
            p_s = self.p_slip.get(kc, 0.1)

            if sid not in self.p_know:
                self.p_know[sid] = {}

            if first_correct:
                self.p_know[sid][kc] = 1.0 - p_g
            else:
                self.p_know[sid][kc] = p_s

    # ------------------------------------------------------------------
    # Step 7: Training — BKT updates through interaction sequence
    # ------------------------------------------------------------------
    def _train_bkt(self, df: pd.DataFrame):
        """
        Iterate through each student's interactions in temporal order
        and apply the BKT update equations with personalized parameters.
        """
        sorted_df = df.sort_values(['student_id', 'kc_id', 'response_time'])

        for (sid, kc), group in sorted_df.groupby(['student_id', 'kc_id']):
            p_g = self.p_guess.get(kc, 0.2)
            p_s = self.p_slip.get(kc, 0.1)
            p_t = self.p_transit.get(sid, 0.1)

            p_l = self.p_know.get(sid, {}).get(kc, 0.3)

            for _, row in group.iterrows():
                correct = row['correct']

                # Posterior update
                if correct:
                    denom = p_l * (1 - p_s) + (1 - p_l) * p_g
                    p_l_posterior = (p_l * (1 - p_s)) / denom if denom > 0 else p_l
                else:
                    denom = p_l * p_s + (1 - p_l) * (1 - p_g)
                    p_l_posterior = (p_l * p_s) / denom if denom > 0 else p_l

                # Transition
                p_l = p_l_posterior + (1 - p_l_posterior) * p_t

                # Cap at p_know_cap to prevent ceiling effect
                p_l = min(p_l, self.p_know_cap)

            # Store final knowledge state
            if sid not in self.p_know:
                self.p_know[sid] = {}
            self.p_know[sid][kc] = p_l

    # ------------------------------------------------------------------
    # Main fit() — Full training pipeline
    # ------------------------------------------------------------------
    def fit(self, df: pd.DataFrame):
        """
        Full PC-BKT training pipeline.
        
        df must contain columns: student_id, kc_id, correct, response_time
        """
        required = {'student_id', 'kc_id', 'correct', 'response_time'}
        missing = required - set(df.columns)
        if missing:
            raise ValueError(f"Missing columns: {missing}")

        logger.info("PC-BKT: Starting training pipeline...")

        # 1. Sort temporally
        df = df.sort_values('response_time').reset_index(drop=True)

        # 2. Annotate knowledge sequences
        logger.info("  Step 1/6: Annotating knowledge sequences (EP)...")
        annotated = self._annotate_knowledge(df)

        # 3. Compute Empirical P(G), P(S)
        logger.info("  Step 2/6: Computing P(Guess), P(Slip) via EP...")
        self._compute_ep_params(annotated)

        # 4. Compute per-student P(T)
        logger.info("  Step 3/6: Computing per-student P(Transit)...")
        self._compute_transit(annotated)

        # 5. Build capability matrix
        logger.info("  Step 4/6: Building capability matrix...")
        self.build_capability_matrix(df)

        # 6. Initialize personalized priors
        logger.info("  Step 5/6: Initializing personalized P(L0)...")
        self._init_personalized_priors(df)

        # 7. Train BKT through interaction sequences
        logger.info("  Step 6/6: Running BKT update pass...")
        self._train_bkt(df)

        # 8. Cluster students
        logger.info("  Clustering students...")
        self.fit_clustering()

        self.is_fitted = True
        logger.info(f"PC-BKT: Training complete. "
                     f"{len(self.student_ids)} students, "
                     f"{len(self.kc_ids)} skills, "
                     f"{self.n_clusters} clusters.")

    # ------------------------------------------------------------------
    # Prediction
    # ------------------------------------------------------------------
    def predict_single(self, student_id: str, kc_id: str) -> float:
        """
        Predict the probability that a student will correctly apply
        skill kc_id at the next opportunity.
        
        P(correct) = P(L) * (1 - P(S)) + (1 - P(L)) * P(G)
        """
        p_l = self._get_p_know(student_id, kc_id)
        p_g = self.p_guess.get(kc_id, 0.2)
        p_s = self.p_slip.get(kc_id, 0.1)

        return p_l * (1 - p_s) + (1 - p_l) * p_g

    def _get_p_know(self, student_id: str, kc_id: str) -> float:
        """
        Get P(L) for a student on a skill.
        Falls back to cluster average (cold-start) if student has no data for that skill.
        """
        # Direct lookup
        if student_id in self.p_know and kc_id in self.p_know[student_id]:
            return self.p_know[student_id][kc_id]

        # Cold-start: use cluster average
        cluster = self.student_clusters.get(student_id)
        if cluster is not None and cluster in self.cluster_priors:
            return self.cluster_priors[cluster].get(kc_id, 0.3)

        # Complete cold-start: no data at all
        return 0.3

    def update_after_response(self, student_id: str, kc_id: str, correct: bool) -> float:
        """
        Online BKT update after a single response. Returns new P(L).
        This is used during live quiz sessions.
        """
        p_l = self._get_p_know(student_id, kc_id)
        p_g = self.p_guess.get(kc_id, 0.2)
        p_s = self.p_slip.get(kc_id, 0.1)
        p_t = self.p_transit.get(student_id, 0.1)

        # Posterior
        if correct:
            denom = p_l * (1 - p_s) + (1 - p_l) * p_g
            p_l_post = (p_l * (1 - p_s)) / denom if denom > 0 else p_l
        else:
            denom = p_l * p_s + (1 - p_l) * (1 - p_g)
            p_l_post = (p_l * p_s) / denom if denom > 0 else p_l

        # Transition
        new_p_l = p_l_post + (1 - p_l_post) * p_t
        new_p_l = min(new_p_l, self.p_know_cap)

        # Store
        if student_id not in self.p_know:
            self.p_know[student_id] = {}
        self.p_know[student_id][kc_id] = new_p_l

        return new_p_l

    def get_student_state(self, student_id: str) -> dict:
        """Return the full BKT state for a student (for frontend visualization)."""
        cluster = self.student_clusters.get(student_id, -1)
        kc_states = {}
        for kc in self.kc_ids:
            kc_states[kc] = {
                "p_know": self._get_p_know(student_id, kc),
                "p_guess": self.p_guess.get(kc, 0.2),
                "p_slip": self.p_slip.get(kc, 0.1),
            }

        return {
            "student_id": student_id,
            "cluster": cluster,
            "p_transit": self.p_transit.get(student_id, 0.1),
            "kc_states": kc_states,
        }

    # ------------------------------------------------------------------
    # Serialization
    # ------------------------------------------------------------------
    def to_dict(self) -> dict:
        """Serialize model state to a JSON-friendly dict."""
        return {
            "n_clusters": self.n_clusters,
            "p_know_cap": self.p_know_cap,
            "p_guess": self.p_guess,
            "p_slip": self.p_slip,
            "p_transit": self.p_transit,
            "p_know": self.p_know,
            "student_clusters": self.student_clusters,
            "cluster_priors": {str(k): v for k, v in self.cluster_priors.items()},
            "kc_ids": self.kc_ids,
            "student_ids": self.student_ids,
            "is_fitted": self.is_fitted,
        }

    @classmethod
    def from_dict(cls, d: dict) -> 'PC_BKT':
        """Deserialize model from a dict."""
        model = cls(n_clusters=d["n_clusters"], p_know_cap=d.get("p_know_cap", 0.95))
        model.p_guess = d["p_guess"]
        model.p_slip = d["p_slip"]
        model.p_transit = d["p_transit"]
        model.p_know = d["p_know"]
        model.student_clusters = d["student_clusters"]
        model.cluster_priors = {int(k): v for k, v in d["cluster_priors"].items()}
        model.kc_ids = d["kc_ids"]
        model.student_ids = d["student_ids"]
        model.is_fitted = d["is_fitted"]
        return model
