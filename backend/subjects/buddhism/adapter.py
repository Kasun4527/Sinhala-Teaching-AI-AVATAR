"""
adapter.py -- Adapter to map PostgreSQL operations to MongoDB for the Buddhism subject card.
"""
from datetime import datetime
import sys
from pathlib import Path

# Add project backend to path to import db
sys.path.append(str(Path(__file__).parent.parent.parent))
from db import student_progress_collection, topics_collection

# In the old system, KCs were rows in 'kcs'. Here we map from topics_collection or hardcode if empty
def get_all_kcs():
    """Maps: SELECT kc_id FROM kcs ORDER BY kc_id"""
    # Assuming topics_collection has "kc_id" or "topic_id".
    # Since Buddhism is the first subject, we might fall back to the synthetic IDs if DB is empty
    docs = list(topics_collection.find({"subject": "Buddhism"}).sort("kc_id", 1))
    if not docs:
        return [{'kc_id': kc} for kc in ['BUD10_01_01', 'BUD10_01_02', 'BUD10_01_03', 'BUD10_02_01', 'BUD10_02_02']]
    return [{'kc_id': doc.get('kc_id', str(doc['_id']))} for doc in docs]

def get_student_interactions():
    """Maps: SELECT student_id, kc_id, correct::int as correct, response_time FROM student_interactions ORDER BY response_time ASC;"""
    docs = list(student_progress_collection.find(
        {"subject": "Buddhism"}, 
        {"student_id": 1, "kc_id": 1, "correct": 1, "response_time": 1, "_id": 0}
    ).sort("response_time", 1))
    
    # Format output to match old PostgreSQL dict rows
    results = []
    for doc in docs:
        results.append({
            'student_id': doc.get('student_id'),
            'kc_id': doc.get('kc_id', doc.get('topic')), # fallback
            'correct': int(doc.get('correct', 0)),
            'response_time': doc.get('response_time', datetime.utcnow())
        })
    return results

def log_interaction(student_id, kc_id, correct):
    """Maps: INSERT INTO student_interactions (student_id, kc_id, correct, response_time) VALUES (...)"""
    student_progress_collection.insert_one({
        "student_id": student_id,
        "kc_id": kc_id,
        "subject": "Buddhism",
        "correct": bool(correct),
        "response_time": datetime.utcnow()
    })
