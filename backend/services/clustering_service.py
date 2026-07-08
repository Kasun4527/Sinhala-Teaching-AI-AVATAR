"""
PC-BKT Clustering Service

Builds the Capability Matrix B (N x K) where:
  B[i][k] = student i's mastery on skill k

Runs K-Means (K=3) to assign students to:
  0 = High Performer
  1 = Medium Performer
  2 = Low Performer
  3 = Cold-Start / New (assigned if no sufficient history)

Also handles the update cycle: re-runs every 20 new student interactions.
"""

import numpy as np
from typing import Dict, List, Optional
from datetime import datetime
from sklearn.cluster import KMeans

from db import (
    skill_mastery_col,
    student_clusters_col,
    interaction_logs_col,
    kmeans_models_col,
    users_collection
)

# ─────────────────────────────────────────────────────────────
# CONSTANTS
# ─────────────────────────────────────────────────────────────

N_CLUSTERS          = 3      # High, Medium, Low
COLD_START_CLUSTER  = 3      # Cluster ID for new students
MIN_STUDENTS_TRAIN  = 3      # Minimum students needed to train K-Means
DEFAULT_CAPABILITY  = 0.5    # Neutral capability for unseen skills
MIN_INTERACTIONS_FOR_CLUSTER = 15  # Bug #5: Minimum interactions before hard clustering
EMA_ALPHA           = 0.3    # Priority 7: EMA smoothing factor for cluster probabilities

CLUSTER_LABELS = {0: "High", 1: "Medium", 2: "Low", 3: "New"}


# ─────────────────────────────────────────────────────────────
# CAPABILITY MATRIX BUILDER
# ─────────────────────────────────────────────────────────────

def get_all_skill_ids() -> List[str]:
    """Return sorted list of all known skill_ids in the system."""
    pipeline = [
        {"$group": {"_id": "$skill_id"}},
        {"$sort": {"_id": 1}}
    ]
    results = list(skill_mastery_col.aggregate(pipeline))
    return [r["_id"] for r in results]


def build_capability_vector(student_id: str, skill_ids: List[str]) -> np.ndarray:
    """
    Build a student's capability vector of length K (number of skills).

    PC-BKT formula:
      B[i][k] = mastery for skill k, or 0.5 if no attempts on skill k
    """
    mastery_map = {}
    records = skill_mastery_col.find({"student_id": student_id})
    for r in records:
        mastery_map[r["skill_id"]] = float(r["mastery"])

    vector = np.array([
        mastery_map.get(skill_id, DEFAULT_CAPABILITY)
        for skill_id in skill_ids
    ], dtype=float)

    return vector


def build_capability_matrix(all_student_ids: List[str], skill_ids: List[str]) -> np.ndarray:
    """Build the full N x K capability matrix for all students."""
    B = np.array([
        build_capability_vector(sid, skill_ids)
        for sid in all_student_ids
    ])
    return B


# ─────────────────────────────────────────────────────────────
# K-MEANS TRAINING
# ─────────────────────────────────────────────────────────────

def get_all_student_ids_with_mastery() -> List[str]:
    """Get student IDs that have at least one skill_mastery record."""
    pipeline = [
        {"$group": {"_id": "$student_id"}},
        {"$sort": {"_id": 1}}
    ]
    results = list(skill_mastery_col.aggregate(pipeline))
    return [r["_id"] for r in results]


def train_and_save_kmeans() -> Optional[Dict]:
    """
    Train K-Means on the capability matrix for all students.
    Saves centroids to MongoDB for persistent re-use.
    """
    all_student_ids = get_all_student_ids_with_mastery()
    skill_ids = get_all_skill_ids()

    if not skill_ids:
        print("[Clustering] No skill IDs found — skipping K-Means training.")
        return None

    if len(all_student_ids) < MIN_STUDENTS_TRAIN:
        print(f"[Clustering] Only {len(all_student_ids)} students — "
              f"need {MIN_STUDENTS_TRAIN} to train K-Means.")
        return None

    B = build_capability_matrix(all_student_ids, skill_ids)

    # Use min of N_CLUSTERS and actual student count
    actual_k = min(N_CLUSTERS, len(all_student_ids))
    kmeans = KMeans(n_clusters=actual_k, random_state=42, n_init=10)
    labels = kmeans.fit_predict(B)

    # Sort clusters by centroid mean (descending: High first)
    centroid_means = kmeans.cluster_centers_.mean(axis=1)
    sorted_order   = np.argsort(centroid_means)[::-1]
    label_remap    = {int(sorted_order[i]): i for i in range(actual_k)}

    centroids_list = kmeans.cluster_centers_.tolist()
    now = datetime.utcnow()

    # Persist to MongoDB
    kmeans_models_col.update_one(
        {"model_version": "latest"},
        {"$set": {
            "n_clusters":    int(actual_k),
            "centroids":     centroids_list,
            "label_remap":   {str(k): int(v) for k, v in label_remap.items()},
            "skill_ids":     skill_ids,
            "cluster_labels": {str(k): v for k, v in CLUSTER_LABELS.items()},
            "trained_at":    now,
            "student_count": len(all_student_ids)
        }},
        upsert=True
    )

    # Update all student cluster assignments
    for i, sid in enumerate(all_student_ids):
        raw_label = int(labels[i])
        mapped_label = int(label_remap.get(raw_label, 1))
        student_clusters_col.update_one(
            {"student_id": sid},
            {"$set": {
                "cluster_id":         mapped_label,
                "cluster_label":      CLUSTER_LABELS.get(mapped_label, "Medium"),
                "capability_vector":  B[i].tolist(),
                "skill_ids":          skill_ids,
                "assigned_at":        now,
                "attempt_window":     0
            }},
            upsert=True
        )

    print(f"[Clustering] K-Means trained on {len(all_student_ids)} students, "
          f"{len(skill_ids)} skills.")
    return {"trained": True, "n_students": len(all_student_ids),
            "n_skills": len(skill_ids), "n_clusters": actual_k}


# ─────────────────────────────────────────────────────────────
# STUDENT CLUSTER ASSIGNMENT (inference)
# ─────────────────────────────────────────────────────────────

def get_student_cluster(student_id: str) -> int:
    """
    Get the current cluster ID for a student.
    Returns COLD_START_CLUSTER (3) if no assignment exists.
    """
    record = student_clusters_col.find_one({"student_id": student_id})
    if record:
        return int(record["cluster_id"])
    return COLD_START_CLUSTER


def assign_new_student_cluster(student_id: str) -> int:
    """
    Assign cluster to a student using pre-trained K-Means model.
    Bug #5 Fix: Requires MIN_INTERACTIONS_FOR_CLUSTER interactions before
    hard clustering. Also stores soft probability distribution.
    Defaults to Medium (1) if no model available yet.
    """
    # Bug #5: Check if student has enough interactions for hard clustering
    total_attempts = interaction_logs_col.count_documents(
        {"student_id": student_id}
    )
    if total_attempts < MIN_INTERACTIONS_FOR_CLUSTER:
        _set_cluster(student_id, COLD_START_CLUSTER, "New")
        return COLD_START_CLUSTER

    model_doc = kmeans_models_col.find_one({"model_version": "latest"})
    if not model_doc:
        _set_cluster(student_id, 1, "Medium")
        return 1

    skill_ids  = model_doc["skill_ids"]
    centroids  = np.array(model_doc["centroids"])
    label_remap = model_doc.get("label_remap", {})

    vec = build_capability_vector(student_id, skill_ids).reshape(1, -1)
    distances  = np.linalg.norm(centroids - vec, axis=1)
    raw_label  = int(np.argmin(distances))
    mapped     = int(label_remap.get(str(raw_label), 1))

    # Bug #5: Compute soft probability distribution (softmax of negative distances)
    neg_distances = -distances
    exp_vals = np.exp(neg_distances - np.max(neg_distances))  # numerical stability
    soft_probs = (exp_vals / np.sum(exp_vals)).tolist()

    _set_cluster(student_id, mapped, CLUSTER_LABELS.get(mapped, "Medium"),
                 soft_probs=soft_probs)
    return mapped


def _set_cluster(student_id: str, cluster_id: int, label: str,
                 soft_probs: list = None):
    """Upsert cluster assignment in DB with optional soft probabilities."""
    update_doc = {
        "cluster_id":    cluster_id,
        "cluster_label": label,
        "assigned_at":   datetime.utcnow()
    }
    if soft_probs is not None:
        update_doc["cluster_probabilities"] = soft_probs
    student_clusters_col.update_one(
        {"student_id": student_id},
        {"$set": update_doc},
        upsert=True
    )


def maybe_update_cluster(student_id: str) -> bool:
    """
    Priority 7: Always re-assign cluster on every quiz submission
    (no more arbitrary 30-attempt intervals).

    Uses EMA smoothing on the soft probability distribution to prevent
    erratic cluster jumping from a single bad quiz.

    Returns True if cluster was updated.
    """
    total_attempts = interaction_logs_col.count_documents(
        {"student_id": student_id}
    )

    # Still enforce minimum interactions threshold
    if total_attempts < MIN_INTERACTIONS_FOR_CLUSTER:
        return False

    model_doc = kmeans_models_col.find_one({"model_version": "latest"})
    if not model_doc:
        # No trained model yet — try to train one
        train_result = train_and_save_kmeans()
        if not train_result:
            return False
        model_doc = kmeans_models_col.find_one({"model_version": "latest"})
        if not model_doc:
            return False

    skill_ids  = model_doc["skill_ids"]
    centroids  = np.array(model_doc["centroids"])
    label_remap = model_doc.get("label_remap", {})

    vec = build_capability_vector(student_id, skill_ids).reshape(1, -1)
    distances  = np.linalg.norm(centroids - vec, axis=1)

    # Compute new soft probabilities
    neg_distances = -distances
    exp_vals = np.exp(neg_distances - np.max(neg_distances))
    new_soft_probs = (exp_vals / np.sum(exp_vals)).tolist()

    # Priority 7: EMA smoothing — blend with previous probabilities
    existing = student_clusters_col.find_one({"student_id": student_id})
    if existing and "cluster_probabilities" in existing:
        old_probs = existing["cluster_probabilities"]
        if len(old_probs) == len(new_soft_probs):
            smoothed_probs = [
                EMA_ALPHA * new_p + (1 - EMA_ALPHA) * old_p
                for new_p, old_p in zip(new_soft_probs, old_probs)
            ]
            # Re-normalize
            total = sum(smoothed_probs)
            smoothed_probs = [p / total for p in smoothed_probs]
        else:
            smoothed_probs = new_soft_probs
    else:
        smoothed_probs = new_soft_probs

    # Assign to cluster with highest smoothed probability
    raw_label = int(np.argmax(smoothed_probs))
    mapped = int(label_remap.get(str(raw_label), 1))

    _set_cluster(student_id, mapped, CLUSTER_LABELS.get(mapped, "Medium"),
                 soft_probs=smoothed_probs)
    return True


def get_cluster_one_hot(cluster_id: int, n_clusters: int = 4) -> np.ndarray:
    """
    One-hot encode cluster ID for LSTM feature vector.
    n_clusters = 4 to accommodate cold-start cluster (id=3).
    """
    vec = np.zeros(n_clusters)
    if 0 <= cluster_id < n_clusters:
        vec[cluster_id] = 1.0
    return vec
