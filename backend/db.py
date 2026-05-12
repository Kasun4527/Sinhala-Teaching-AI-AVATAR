from pymongo import MongoClient

client = MongoClient("mongodb://localhost:27017")

db = client["ai_avatar"]

# existing
users_collection = db["users"]

# new collections
subjects_collection = db["subjects"]
topics_collection = db["topics"]
questions_collection = db["questions"]
student_progress_collection = db["student_progress"]
delivered_content_collection = db["delivered_content"]

# Hybrid BKT collections
capability_matrix_collection = db["capability_matrix"]
lstm_states_collection = db["lstm_states"]
pc_bkt_states_collection = db["pc_bkt_states"]