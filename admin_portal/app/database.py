import os
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()

# Azure Cosmos DB for MongoDB connection
mongo_uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
client = MongoClient(mongo_uri)

db = client["sinhala_admin"]

main_collection = db["app_data"]


def ensure_indexes():
    """Create indexes for performance. Called on FastAPI startup."""
    main_collection.create_index([("type", 1), ("email", 1)])
    main_collection.create_index([("type", 1), ("name", 1)])
    main_collection.create_index([("type", 1), ("nic_number", 1)])
    main_collection.create_index("timestamp")
    print("[DB] Admin dashboard indexes ensured.")


def log_activity(action: str, performed_by: str, details: str = ""):
    """Insert an activity log entry."""
    from datetime import datetime, timezone
    main_collection.insert_one({
        "type": "activity_log",
        "action": action,
        "performed_by": performed_by,
        "details": details,
        "timestamp": datetime.now(timezone.utc),
    })