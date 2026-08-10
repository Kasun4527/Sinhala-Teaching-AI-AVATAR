import os
from dotenv import load_dotenv
from pymongo import MongoClient, ASCENDING

# Load environment variables
load_dotenv(override=True)

mongo_uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
client = MongoClient(mongo_uri)
db = client["ai_avatar"]

# existing
users_collection = db["users"]

# new collections
subjects_collection = db["subjects"]
topics_collection = db["topics"]
student_progress_collection = db["student_progress"]
delivered_content_collection = db["delivered_content"]
enrollments_collection = db["enrollments"]
engagement_collection = db["engagement_sessions"]
qa_collection = db["student_qa"]
youtube_watch_collection = db["youtube_watch_sessions"]
email_tokens_collection = db["email_verification_tokens"]
# Topics added via the admin PDF-ingestion pipeline, merged into the static
# frontend curriculum at load time so they show up for students to select.
curriculum_topics_collection = db["curriculum_topics"]

# Practice-quiz attempts generated from a student's past delivered_content
# (review flow). Deliberately separate from student_progress_collection —
# this must never feed topic_unlocked/mastery/BKT.
practice_quiz_results_collection = db["practice_quiz_results"]

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
    practice_quiz_results_collection.create_index(
        [("student_id", ASCENDING), ("subject", ASCENDING), ("lesson", ASCENDING),
         ("topic", ASCENDING), ("created_at", ASCENDING)]
    )
    print("[DB] Personalization indexes ensured.")
