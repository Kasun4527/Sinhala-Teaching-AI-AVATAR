import os
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()

# Azure Cosmos DB for MongoDB connection
mongo_uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
client = MongoClient(mongo_uri)

db = client["ai_avatar"]

# Option 2: shared database, isolated admin-portal collections.
admin_users_collection = db["admin_users"]
admin_teachers_collection = db["admin_teachers"]
admin_subjects_collection = db["admin_subjects"]
admin_lessons_collection = db["admin_lessons"]
admin_activity_logs_collection = db["admin_activity_logs"]


def ensure_indexes():
    """Create indexes for performance. Called on FastAPI startup."""
    admin_users_collection.create_index("email", unique=True)
    admin_teachers_collection.create_index("email", unique=True)
    admin_teachers_collection.create_index("nic_number", unique=True)
    admin_subjects_collection.create_index("name", unique=True)
    admin_lessons_collection.create_index(
        [("subject_name", 1), ("lesson_name", 1), ("source_filename", 1)]
    )
    admin_activity_logs_collection.create_index("timestamp")
    print("[DB] Admin dashboard indexes ensured.")


def log_activity(action: str, performed_by: str, details: str = ""):
    """Insert an activity log entry."""
    from datetime import datetime, timezone
    admin_activity_logs_collection.insert_one({
        "action": action,
        "performed_by": performed_by,
        "details": details,
        "timestamp": datetime.now(timezone.utc),
    })
