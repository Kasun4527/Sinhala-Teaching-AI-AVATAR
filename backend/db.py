from pymongo import MongoClient

client = MongoClient("mongodb://localhost:27017")

db = client["ai_avatar"]

# existing
users_collection = db["users"]

# new collections
subjects_collection = db["subjects"]
topics_collection = db["topics"]
student_progress_collection = db["student_progress"]
delivered_content_collection = db["delivered_content"]