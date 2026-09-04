from db import delivered_content_collection, practice_quiz_results_collection
from agents.quiz_agent import evaluate_answers
from datetime import datetime

# This module is kept deliberately separate from progress_agent.py — it never
# imports or writes student_progress_collection, so the review/practice-quiz
# flow structurally cannot touch topic_unlocked/mastery/BKT state.


def list_delivered_content(student_id, subject=None):
    """List every (subject, lesson, topic) this student has saved delivered
    content for — the 'past studied lessons' list. delivered_content_collection
    is upserted per (student, subject, lesson, topic), so this is a direct find()."""
    query = {"student_id": student_id}
    if subject:
        query["subject"] = subject

    records = delivered_content_collection.find(query).sort("updated_at", -1)
    results = []
    for r in records:
        ts = r.get("updated_at") or r.get("created_at")
        results.append({
            "subject": r["subject"],
            "lesson": r["lesson"],
            "topic": r["topic"],
            "level": r.get("level"),
            "updated_at": ts.isoformat() if ts else None,
        })
    return results


def get_delivered_content_for_topic(student_id, subject, lesson, topic):
    """Exact originally-delivered content for one topic — no regeneration."""
    r = delivered_content_collection.find_one({
        "student_id": student_id,
        "subject": subject,
        "lesson": lesson,
        "topic": topic,
    })
    if not r:
        return None
    return {"content": r["content"], "level": r.get("level")}


def save_practice_quiz_result(student_id, subject, lesson, topic, level,
                               quiz_questions, student_answers, correct_answers):
    """Score + persist a practice-quiz attempt."""
    result = evaluate_answers(student_answers, correct_answers)

    record = {
        "student_id": student_id,
        "subject": subject,
        "lesson": lesson,
        "topic": topic,
        "level": level,
        "quiz_questions": quiz_questions or [],
        "student_answers": student_answers,
        "correct_answers": correct_answers,
        "score": result["score"],
        "score_level": result["level"],
        "created_at": datetime.utcnow(),
    }
    inserted = practice_quiz_results_collection.insert_one(record)
    return {"result_id": str(inserted.inserted_id), **result}


def list_practice_quiz_results(student_id, subject=None, lesson=None, topic=None):
    """Past practice-quiz attempt history (all topics, or scoped)."""
    query = {"student_id": student_id}
    if subject:
        query["subject"] = subject
    if lesson:
        query["lesson"] = lesson
    if topic:
        query["topic"] = topic

    records = practice_quiz_results_collection.find(query).sort("created_at", -1)
    return [{
        "result_id": str(r["_id"]),
        "subject": r["subject"],
        "lesson": r["lesson"],
        "topic": r["topic"],
        "score": r["score"],
        "score_level": r["score_level"],
        "question_count": len(r.get("quiz_questions") or []),
        "created_at": r["created_at"].isoformat() if r.get("created_at") else None,
    } for r in records]
