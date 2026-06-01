from pymongo import MongoClient, ASCENDING

client = MongoClient("mongodb://localhost:27017")

db = client["ai_avatar"]

# existing
users_collection = db["users"]

# new collections
subjects_collection = db["subjects"]
topics_collection = db["topics"]
student_progress_collection = db["student_progress"]
delivered_content_collection = db["delivered_content"]
enrollments_collection = db["enrollments"]

# ── Personalization Collections (PC-BKT + BKT-LSTM) ─────────────────────────

skill_mastery_col       = db["skill_mastery"]
bkt_params_col          = db["bkt_params"]
interaction_logs_col    = db["interaction_logs"]
student_clusters_col    = db["student_clusters"]
problem_difficulty_col  = db["problem_difficulty"]
kmeans_models_col       = db["kmeans_models"]


def ensure_indexes():
    """Create all personalization indexes. Called once on FastAPI startup."""
    skill_mastery_col.create_index(
        [("student_id", ASCENDING), ("skill_id", ASCENDING)], unique=True
    )
    bkt_params_col.create_index(
        [("student_id", ASCENDING), ("skill_id", ASCENDING)], unique=True
    )
    interaction_logs_col.create_index(
        [("student_id", ASCENDING), ("skill_id", ASCENDING), ("created_at", ASCENDING)]
    )
    student_clusters_col.create_index(
        [("student_id", ASCENDING)], unique=True
    )
    problem_difficulty_col.create_index(
        [("question_hash", ASCENDING)], unique=True
    )
    kmeans_models_col.create_index(
        [("model_version", ASCENDING)], unique=True
    )
    print("[DB] Personalization indexes ensured.")