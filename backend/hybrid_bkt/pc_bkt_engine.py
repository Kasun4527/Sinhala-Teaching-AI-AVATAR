
import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from typing import Dict, Tuple, Optional
import json
import logging
from db import pc_bkt_states_collection, capability_matrix_collection

logger = logging.getLogger(__name__)

class PC_BKT:
    """Personalized Clustered Bayesian Knowledge Tracing model adapted for MongoDB."""

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

    def load_from_db(self):
        doc = pc_bkt_states_collection.find_one({"type": "global_pc_bkt_model"})
        if doc:
            self.n_clusters = doc.get("n_clusters", self.n_clusters)
            self.p_know_cap = doc.get("p_know_cap", self.p_know_cap)
            self.p_guess = doc.get("p_guess", {})
            self.p_slip = doc.get("p_slip", {})
            self.p_transit = doc.get("p_transit", {})
            self.p_know = doc.get("p_know", {})
            self.student_clusters = doc.get("student_clusters", {})
            self.cluster_priors = {int(k): v for k, v in doc.get("cluster_priors", {}).items()}
            self.kc_ids = doc.get("kc_ids", [])
            self.student_ids = doc.get("student_ids", [])
            self.is_fitted = doc.get("is_fitted", False)
            return True
        return False

    def save_to_db(self):
        doc = {
            "type": "global_pc_bkt_model",
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
        pc_bkt_states_collection.update_one(
            {"type": "global_pc_bkt_model"},
            {"$set": doc},
            upsert=True
        )

        # Also update capability matrix collection for individual student clusters
        for sid, cluster_id in self.student_clusters.items():
            capability_matrix_collection.update_one(
                {"student_id": sid},
                {"$set": {"cluster_id": cluster_id}},
                upsert=True
            )

    # ------------------------------------------------------------------
    # Step 1: Annotate Knowledge Sequences using EP
    # ------------------------------------------------------------------
    def _annotate_knowledge(self, df: pd.DataFrame) -> pd.DataFrame:
        annotated = df.copy()
        annotated['knowledge'] = 0

        for (sid, kc), group in df.groupby(['student_id', 'kc_id']):
            corrects = group['correct'].values
            n = len(corrects)
            if n == 0: continue

            best_point = 0
            best_score = -np.inf

            for t in range(n + 1):
                before = corrects[:t]
                after = corrects[t:]

                score = 0
                if len(before) > 0: score += np.sum(1 - before)
                if len(after) > 0: score += np.sum(after)

                if score > best_score:
                    best_score = score
                    best_point = t

            knowledge_seq = np.zeros(n)
            knowledge_seq[best_point:] = 1
            annotated.loc[group.index, 'knowledge'] = knowledge_seq

        return annotated

    def _compute_ep_params(self, annotated_df: pd.DataFrame):
        for kc_id, group in annotated_df.groupby('kc_id'):
            K = group['knowledge'].values
            C = group['correct'].values

            denom_g = np.sum(1 - K)
            denom_s = np.sum(K)

            self.p_guess[kc_id] = float(np.sum(C * (1 - K)) / denom_g) if denom_g > 0 else 0.2
            self.p_slip[kc_id] = float(np.sum((1 - C) * K) / denom_s) if denom_s > 0 else 0.1

            self.p_guess[kc_id] = np.clip(self.p_guess[kc_id], 0.01, 0.4)
            self.p_slip[kc_id] = np.clip(self.p_slip[kc_id], 0.01, 0.3)

    def _compute_transit(self, annotated_df: pd.DataFrame):
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

    def build_capability_matrix(self, df: pd.DataFrame) -> pd.DataFrame:
        matrix = df.groupby(['student_id', 'kc_id'])['correct'].mean().unstack(fill_value=0.5)
        self.capability_matrix = matrix
        self.kc_ids = list(matrix.columns)
        self.student_ids = list(matrix.index)
        return matrix

    def fit_clustering(self):
        if self.capability_matrix is None: return
        n_samples = len(self.capability_matrix)
        actual_clusters = min(self.n_clusters, n_samples)

        if actual_clusters < 2:
            for sid in self.student_ids: self.student_clusters[sid] = 0
            return

        self.kmeans = KMeans(n_clusters=actual_clusters, random_state=42, n_init=10)
        labels = self.kmeans.fit_predict(self.capability_matrix.values)

        for i, sid in enumerate(self.student_ids):
            self.student_clusters[sid] = int(labels[i])

        self._compute_cluster_priors()

    def _compute_cluster_priors(self):
        for cluster_id in range(self.n_clusters):
            cluster_students = [sid for sid, c in self.student_clusters.items() if c == cluster_id]
            if not cluster_students: continue

            cluster_priors = {}
            for kc in self.kc_ids:
                vals = [self.p_know.get(sid, {}).get(kc, 0.5) for sid in cluster_students]
                cluster_priors[kc] = float(np.mean(vals)) if vals else 0.3
            self.cluster_priors[cluster_id] = cluster_priors

    def _init_personalized_priors(self, df: pd.DataFrame):
        for (sid, kc), group in df.groupby(['student_id', 'kc_id']):
            first_correct = group['correct'].iloc[0]
            p_g = self.p_guess.get(kc, 0.2)
            p_s = self.p_slip.get(kc, 0.1)

            if sid not in self.p_know: self.p_know[sid] = {}
            if first_correct: self.p_know[sid][kc] = 1.0 - p_g
            else: self.p_know[sid][kc] = p_s

    def _train_bkt(self, df: pd.DataFrame):
        sorted_df = df.sort_values(['student_id', 'kc_id', 'response_time'])
        for (sid, kc), group in sorted_df.groupby(['student_id', 'kc_id']):
            p_g = self.p_guess.get(kc, 0.2)
            p_s = self.p_slip.get(kc, 0.1)
            p_t = self.p_transit.get(sid, 0.1)
            p_l = self.p_know.get(sid, {}).get(kc, 0.3)

            for _, row in group.iterrows():
                correct = row['correct']
                if correct:
                    denom = p_l * (1 - p_s) + (1 - p_l) * p_g
                    p_l_post = (p_l * (1 - p_s)) / denom if denom > 0 else p_l
                else:
                    denom = p_l * p_s + (1 - p_l) * (1 - p_g)
                    p_l_post = (p_l * p_s) / denom if denom > 0 else p_l
                p_l = p_l_post + (1 - p_l_post) * p_t
                p_l = min(p_l, self.p_know_cap)

            if sid not in self.p_know: self.p_know[sid] = {}
            self.p_know[sid][kc] = p_l

    def fit(self, df: pd.DataFrame):
        required = {'student_id', 'kc_id', 'correct', 'response_time'}
        if required - set(df.columns): return

        df = df.sort_values('response_time').reset_index(drop=True)
        annotated = self._annotate_knowledge(df)
        self._compute_ep_params(annotated)
        self._compute_transit(annotated)
        self.build_capability_matrix(df)
        self._init_personalized_priors(df)
        self._train_bkt(df)
        self.fit_clustering()
        self.is_fitted = True
        self.save_to_db()

    def predict_single(self, student_id: str, kc_id: str) -> float:
        p_l = self._get_p_know(student_id, kc_id)
        p_g = self.p_guess.get(kc_id, 0.2)
        p_s = self.p_slip.get(kc_id, 0.1)
        return p_l * (1 - p_s) + (1 - p_l) * p_g

    def _get_p_know(self, student_id: str, kc_id: str) -> float:
        if student_id in self.p_know and kc_id in self.p_know[student_id]:
            return self.p_know[student_id][kc_id]
        cluster = self.student_clusters.get(student_id)
        if cluster is not None and cluster in self.cluster_priors:
            return self.cluster_priors[cluster].get(kc_id, 0.3)
        return 0.3

    def update_after_response(self, student_id: str, kc_id: str, correct: bool) -> float:
        p_l = self._get_p_know(student_id, kc_id)
        p_g = self.p_guess.get(kc_id, 0.2)
        p_s = self.p_slip.get(kc_id, 0.1)
        p_t = self.p_transit.get(student_id, 0.1)

        if correct:
            denom = p_l * (1 - p_s) + (1 - p_l) * p_g
            p_l_post = (p_l * (1 - p_s)) / denom if denom > 0 else p_l
        else:
            denom = p_l * p_s + (1 - p_l) * (1 - p_g)
            p_l_post = (p_l * p_s) / denom if denom > 0 else p_l

        new_p_l = p_l_post + (1 - p_l_post) * p_t
        new_p_l = min(new_p_l, self.p_know_cap)

        if student_id not in self.p_know: self.p_know[student_id] = {}
        self.p_know[student_id][kc_id] = new_p_l
        self.save_to_db()
        return new_p_l

    def get_student_state(self, student_id: str) -> dict:
        """Returns the full mastery profile for a student."""
        kc_states = {}
        for kc in self.kc_ids:
            p_l = self._get_p_know(student_id, kc)
            p_g = self.p_guess.get(kc, 0.2)
            p_s = self.p_slip.get(kc, 0.1)
            kc_states[kc] = {
                "p_know": round(float(p_l), 4),
                "p_guess": round(float(p_g), 4),
                "p_slip": round(float(p_s), 4)
            }
        
        return {
            "student_id": student_id,
            "cluster": self.student_clusters.get(student_id, -1),
            "p_transit": round(float(self.p_transit.get(student_id, 0.1)), 4),
            "kc_states": kc_states
        }

    def to_dict(self) -> dict:
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
            "is_fitted": self.is_fitted
        }

    @classmethod
    def from_dict(cls, d: dict) -> 'PC_BKT':
        obj = cls(n_clusters=d["n_clusters"], p_know_cap=d["p_know_cap"])
        obj.p_guess = d["p_guess"]
        obj.p_slip = d["p_slip"]
        obj.p_transit = d["p_transit"]
        obj.p_know = d["p_know"]
        obj.student_clusters = d["student_clusters"]
        obj.cluster_priors = {int(k): v for k, v in d["cluster_priors"].items()}
        obj.kc_ids = d["kc_ids"]
        obj.student_ids = d["student_ids"]
        obj.is_fitted = d["is_fitted"]
        return obj

pc_bkt_engine = PC_BKT()
pc_bkt_engine.load_from_db()
