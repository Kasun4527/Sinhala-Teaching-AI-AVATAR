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

# ── Generation caches ────────────────────────────────────────────────────────
# LLM-generated content/explanations/quizzes are expensive and mostly a
# function of (subject, lesson, topic, level) rather than the individual
# student — caching by that key avoids redundant LLM calls when different
# students land on the same combination. See agents/content_agent.py,
# agents/quiz_agent.py's get_pooled_quiz(), and main.py's /explain-content/.
content_cache_collection = db["content_cache"]
explain_cache_collection = db["explain_cache"]
quiz_pool_collection = db["quiz_pool"]

# AVTR-1 avatar video cache — a recording of the first live WebRTC session
# for a given (subject, lesson, topic, level), reused on repeat visits
# instead of generating a fresh live session every time. Unlike the caches
# above (which store text/JSON in Mongo), the actual video file lives on
# disk under backend/avtr_cache/ (same pattern as documents_unicode/images —
# plain files, mounted via Azure Files in production); this collection only
# tracks the filename/metadata. See agents/avtr_cache_agent.py.
avtr_video_cache_collection = db["avtr_video_cache"]

# ── Personalization Collections (PC-BKT + BKT-LSTM) ─────────────────────────

skill_mastery_col       = db["skill_mastery"]
bkt_params_col          = db["bkt_params"]
interaction_logs_col    = db["interaction_logs"]
student_clusters_col    = db["student_clusters"]
problem_difficulty_col  = db["problem_difficulty"]
kmeans_models_col       = db["kmeans_models"]

# ── Safety Guardrails (LLM Content Guard) ────────────────────────────────────────
# Audit log of input/output safety violations. Each document records what
# was flagged, which student triggered it, and which teacher should be
# alerted. Reviewed by teachers via the admin dashboard.
safety_flags_collection = db["safety_flags"]

# ── Parent↔Student Persistent Links ──────────────────────────────────────────
# Each document records one parent→child relationship. Replaces the old
# on-device-only storage the mobile app used (parentChildren.ts).
parent_links_collection = db["parent_links"]

# ── Cross-App Notifications ──────────────────────────────────────────────────
# Teacher→Parent messages and Teacher→Student feedback, fetched by the
# student web app (Navbar bell) and the parent mobile app (Alerts section).
notifications_collection = db["notifications"]


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
    content_cache_collection.create_index(
        [("subject", ASCENDING), ("lesson", ASCENDING), ("topic", ASCENDING), ("level", ASCENDING)],
        unique=True
    )
    explain_cache_collection.create_index(
        [("content_hash", ASCENDING)], unique=True
    )
    quiz_pool_collection.create_index(
        [("subject", ASCENDING), ("lesson", ASCENDING), ("topic", ASCENDING),
         ("level", ASCENDING), ("quiz_type", ASCENDING)]
    )
    avtr_video_cache_collection.create_index(
        [("subject", ASCENDING), ("lesson", ASCENDING), ("topic", ASCENDING), ("level", ASCENDING)],
        unique=True
    )
    safety_flags_collection.create_index(
        [("teacher_id", ASCENDING), ("created_at", ASCENDING)]
    )
    safety_flags_collection.create_index(
        [("student_id", ASCENDING), ("created_at", ASCENDING)]
    )
    parent_links_collection.create_index(
        [("parent_id", ASCENDING), ("student_id", ASCENDING)], unique=True
    )
    parent_links_collection.create_index(
        [("student_id", ASCENDING)]
    )
    notifications_collection.create_index(
        [("recipient_id", ASCENDING), ("read", ASCENDING), ("created_at", ASCENDING)]
    )
    print("[DB] Personalization indexes ensured.")
