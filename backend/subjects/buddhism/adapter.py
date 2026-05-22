"""
adapter.py -- Adapter to map PostgreSQL operations to MongoDB for the Buddhism subject card.
Updated with Grade 11 Buddhism Knowledge Components and Quiz Bank Support
"""
from datetime import datetime
import sys
from pathlib import Path
import pandas as pd
import logging

# Add project backend to path to import db
sys.path.append(str(Path(__file__).parent.parent.parent))
from db import student_progress_collection, topics_collection, questions_collection
from services.llm import get_llm
import uuid
import json

logger = logging.getLogger(__name__)

# Grade 10 Buddhism KCs (existing)
GRADE_10_BUDDHISM_KCS = {
    'BUD10_01_01': {
        'name': 'ඉගෙනුම් ඵල 1.1',
        'topic': 'බුදු ගුණ හැඳින චරිතායනය',
        'grade': 10,
        'lesson': 1
    },
    'BUD10_01_02': {
        'name': 'ඉගෙනුම් ඵල 1.2',
        'topic': 'බුදු ගුණ හැඳින චරිතායනය',
        'grade': 10,
        'lesson': 1
    },
    'BUD10_01_03': {
        'name': 'ඉගෙනුම් ඵල 1.3',
        'topic': 'බුදු ගුණ හැඳින චරිතායනය',
        'grade': 10,
        'lesson': 1
    },
    'BUD10_02_01': {
        'name': 'ඉගෙනුම් ඵල 2.1',
        'topic': 'බුදු ගුණ අනන්තය',
        'grade': 10,
        'lesson': 2
    },
    'BUD10_02_02': {
        'name': 'ඉගෙනුම් ඵල 2.2',
        'topic': 'බුදු ගුණ අනන්තය',
        'grade': 10,
        'lesson': 2
    }
}

# Grade 11 Buddhism KCs (new)
GRADE_11_BUDDHISM_KCS = {
    "11.1.1": {
        "lesson": 1,
        "topic": "බුදු සිරිත අනුව යමු - අභියෝග ජය ගනිමු",
        "name": "බුදු සිරිතේ සුවිශේෂී සිදුවීම් ආදර්ශයට ගනිමින් ජීවිත අභියෝගවලට සාර්ථකව මුහුණ දෙයි",
        "content": "සත්සතියෙන් හෙළි වන ආදර්ශ, ප්‍රථම ධර්ම දේශනය ආශ්‍රිත කරුණු, තනතුරු ප්‍රදානය",
        "skills": ["identify_special_events", "acknowledge_buddhist_challenges", "apply_buddha_principles_to_life", "analyze_triumph_over_adversity"],
        "grade": 11
    },
    "11.1.2": {
        "lesson": 1,
        "topic": "බුදු සිරිත අනුව යමු - අභියෝග ජය ගනිමු",
        "name": "බුදු සිරිතේ සුවිශේෂී ගුණාංග හැඳින ජීවිතාදර්ශ ලබා කටයුතු කරයි",
        "content": "පුරිසදම්මසාරථි ගුණය, අසරණ සරණ ගුණය, ගිලානෝපස්ථානය, තාදී ගුණය",
        "skills": ["identify_buddha_qualities", "explain_virtues_in_life", "apply_compassion_to_others", "understand_service_ethics"],
        "grade": 11
    },
    "11.2.1": {
        "lesson": 2,
        "topic": "බුදු ගුණ අනන්තය",
        "name": "සිරුර සුවඩු කිරීම සහ මානසික සහනීයතා",
        "content": "පූතිගත්ත තිස්ස තෙරුන්, ගිලනු උපස්ථාන කිරීම, වෛද්‍යවරුන්ගේ කර්තවතාවය",
        "skills": ["identify_healthcare_principles", "recognize_compassion_in_healing", "apply_service_to_sick", "understand_buddha_medicine_practice"],
        "grade": 11
    }
}

# In the old system, KCs were rows in 'kcs'. Here we map from topics_collection or hardcode if empty
def get_all_kcs(grade: int = 10):
    """
    Maps: SELECT kc_id FROM kcs ORDER BY kc_id
    Supports both Grade 10 and Grade 11 Buddhism
    """
    docs = list(topics_collection.find({"subject": "Buddhism", "grade": grade}).sort("kc_id", 1))
    
    if not docs:
        # Fall back to hardcoded KCs
        if grade == 10:
            return [{'kc_id': kc} for kc in GRADE_10_BUDDHISM_KCS.keys()]
        elif grade == 11:
            return [{'kc_id': kc} for kc in GRADE_11_BUDDHISM_KCS.keys()]
    
    return [{'kc_id': doc.get('kc_id', str(doc['_id']))} for doc in docs]

def get_student_interactions(grade: int = 10):
    """
    Maps: SELECT student_id, kc_id, correct::int as correct, response_time FROM student_interactions ORDER BY response_time ASC;
    Supports both Grade 10 and Grade 11 Buddhism
    """
    docs = list(student_progress_collection.find(
        {"subject": "Buddhism", "grade": grade}, 
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

def log_interaction(student_id, kc_id, correct, grade: int = 10):
    """
    Maps: INSERT INTO student_interactions (student_id, kc_id, correct, response_time) VALUES (...)
    Supports both Grade 10 and Grade 11 Buddhism
    """
    student_progress_collection.insert_one({
        "student_id": student_id,
        "kc_id": kc_id,
        "subject": "Buddhism",
        "grade": grade,
        "correct": bool(correct),
        "response_time": datetime.utcnow()
    })

def get_pre_quiz_questions_for_grade_11(kc_id: str, limit: int = 5):
    """Get pre-quiz questions for Grade 11 knowledge component"""
    questions = list(questions_collection.find(
        {
            "kc_id": kc_id,
            "subject": "buddhism",
            "grade": 11,
            "difficulty": {"$in": ["easy", "medium"]}
        }
    ).limit(limit))

    # Ensure minimum questions; if less than requested, generate and persist
    if len(questions) < limit:
        needed = limit - len(questions)
        generated = generate_and_store_questions_for_kc(kc_id, needed)
        if generated:
            questions.extend(generated)

    return questions

def get_post_quiz_questions_for_grade_11(kc_id: str, limit: int = 5):
    """Get post-quiz questions for Grade 11 knowledge component"""
    questions = list(questions_collection.find(
        {
            "kc_id": kc_id,
            "subject": "buddhism",
            "grade": 11,
            "difficulty": {"$in": ["medium", "hard"]}
        }
    ).limit(limit))

    if len(questions) < limit:
        needed = limit - len(questions)
        generated = generate_and_store_questions_for_kc(kc_id, needed, difficulty_preferred="medium")
        if generated:
            questions.extend(generated)

    return questions

def get_kc_info(kc_id: str, grade: int = 11):
    """Get knowledge component information"""
    if grade == 11 and kc_id in GRADE_11_BUDDHISM_KCS:
        return GRADE_11_BUDDHISM_KCS[kc_id]
    elif grade == 10 and kc_id in GRADE_10_BUDDHISM_KCS:
        return GRADE_10_BUDDHISM_KCS[kc_id]
    return None

def ingest_grade_11_quiz_bank(csv_filepath: str) -> int:
    """Ingest Grade 11 Buddhism quiz bank from CSV to MongoDB"""
    try:
        df = pd.read_csv(csv_filepath)
        questions = df.to_dict('records')
        
        inserted_count = 0
        for question in questions:
            try:
                if 'question_id' not in question or 'kc_id' not in question:
                    continue
                
                question['subject'] = 'buddhism'
                question['grade'] = 11
                question['active'] = True
                
                questions_collection.update_one(
                    {"question_id": question['question_id']},
                    {"$set": question},
                    upsert=True
                )
                inserted_count += 1
            except Exception as e:
                logger.error(f"Error ingesting question: {e}")
                continue
        
        logger.info(f"Successfully ingested {inserted_count} Grade 11 Buddhism questions")
        return inserted_count
    except Exception as e:
        logger.error(f"Error loading quiz bank: {e}")
        return 0

def initialize_grade_11_buddhism_topics():
    """Initialize Grade 11 Buddhism topics in MongoDB"""
    for kc_id, kc_data in GRADE_11_BUDDHISM_KCS.items():
        topic_doc = {
            "kc_id": kc_id,
            "subject": "Buddhism",
            "grade": 11,
            "lesson": kc_data.get("lesson"),
            "topic": kc_data.get("topic"),
            "name": kc_data.get("name"),
            "content": kc_data.get("content"),
            "skills": kc_data.get("skills", []),
            "active": True
        }
        
        topics_collection.update_one(
            {"kc_id": kc_id},
            {"$set": topic_doc},
            upsert=True
        )
    
    logger.info("Grade 11 Buddhism topics initialized in database")

def get_lesson_kc_ids(lesson_number: int, grade: int = 11):
    """Get all KC IDs for a specific lesson"""
    if grade == 11:
        kc_ids = [kc_id for kc_id, kc_data in GRADE_11_BUDDHISM_KCS.items() 
                  if kc_data.get("lesson") == lesson_number]
        return kc_ids
    return []

def get_pre_quiz_questions_for_lesson(lesson_number: int, limit_per_kc: int = 5):
    """Get pre-quiz questions for all KCs in a lesson (combined)"""
    kc_ids = get_lesson_kc_ids(lesson_number, grade=11)
    all_questions = []
    
    for kc_id in kc_ids:
        questions = list(questions_collection.find(
            {
                "kc_id": kc_id,
                "subject": "buddhism",
                "grade": 11,
                "difficulty": {"$in": ["easy", "medium"]}
            }
        ).limit(limit_per_kc))
        if len(questions) < limit_per_kc:
            needed = limit_per_kc - len(questions)
            generated = generate_and_store_questions_for_kc(kc_id, needed)
            if generated:
                questions.extend(generated)
        all_questions.extend(questions)

    return all_questions

def get_post_quiz_questions_for_lesson(lesson_number: int, limit_per_kc: int = 5):
    """Get post-quiz questions for all KCs in a lesson (combined)"""
    kc_ids = get_lesson_kc_ids(lesson_number, grade=11)
    all_questions = []
    
    for kc_id in kc_ids:
        questions = list(questions_collection.find(
            {
                "kc_id": kc_id,
                "subject": "buddhism",
                "grade": 11,
                "difficulty": {"$in": ["medium", "hard"]}
            }
        ).limit(limit_per_kc))
        if len(questions) < limit_per_kc:
            needed = limit_per_kc - len(questions)
            generated = generate_and_store_questions_for_kc(kc_id, needed, difficulty_preferred="hard")
            if generated:
                questions.extend(generated)
        all_questions.extend(questions)
    
    return all_questions


def generate_and_store_questions_for_kc(kc_id: str, count: int = 1, subject: str = 'buddhism', grade: int = 11, difficulty_preferred: str = 'medium'):
    """Try to generate `count` MCQ questions for the given KC using the LLM.
    If LLM generation fails, fall back to duplicating an existing question with minor variation.
    Returns the list of inserted question documents.
    """
    inserted = []
    try:
        llm = get_llm()
        prompt = (
            f"Generate {count} multiple-choice questions in Sinhala for the Grade 11 Buddhism knowledge component {kc_id}.\n"
            "Ensure the questions are accurate, standard exam-style questions.\n"
            "Return ONLY a JSON array of objects with keys: question_text, option_a, option_b, option_c, option_d, correct_answer (a|b|c|d), difficulty (easy|medium|hard), blooms_level, question_type."
        )
        resp = llm.invoke(prompt)
        text = getattr(resp, 'content', str(resp))
        # Try to locate a JSON array in the response
        start = text.find('[')
        end = text.rfind(']')
        if start != -1 and end != -1 and end > start:
            raw = text[start:end+1]
            try:
                items = json.loads(raw)
            except Exception:
                items = None
        else:
            items = None

        if items and isinstance(items, list):
            for it in items[:count]:
                qdoc = {
                    'question_id': str(uuid.uuid4()),
                    'kc_id': kc_id,
                    'subject': subject,
                    'grade': grade,
                    'question_text': it.get('question_text') or it.get('text') or '',
                    'option_a': it.get('option_a') or it.get('a') or '',
                    'option_b': it.get('option_b') or it.get('b') or '',
                    'option_c': it.get('option_c') or it.get('c') or '',
                    'option_d': it.get('option_d') or it.get('d') or '',
                    'correct_answer': it.get('correct_answer', 'a'),
                    'difficulty': it.get('difficulty', difficulty_preferred),
                    'question_type': it.get('question_type', 'mcq'),
                    'blooms_level': it.get('blooms_level', 'remember')
                }
                questions_collection.update_one({'question_id': qdoc['question_id']}, {'$set': qdoc}, upsert=True)
                inserted.append(qdoc)
    except Exception as e:
        logger.warning(f"LLM question generation failed for {kc_id}: {e}")

    # Fallback removed - we do not want duplicate variations with "(variation X)"
    # If LLM fails, we simply return the questions already in the database.
    
    if inserted:
        logger.info(f"Generated and stored {len(inserted)} new standard questions for KC {kc_id}")
    else:
        logger.info(f"No new questions generated for KC {kc_id} (LLM generation failed or returned no items)")
        
    return inserted
