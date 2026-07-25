from db import (
    users_collection,
    subjects_collection,
    student_progress_collection,
    delivered_content_collection
)
from bson import ObjectId


# =========================
# GET ALL REGISTERED STUDENTS
# =========================
def get_all_students():

    students = users_collection.find({"role": "student"})

    result = []
    for s in students:
        result.append({
            "student_id": str(s["_id"]),
            "name": s["name"],
            "email": s["email"]
        })

    return result


# =========================
# GET ALL SUBJECTS FOR A STUDENT
# =========================
def get_student_subjects(student_id):

    # Find distinct subjects this student has progress in
    records = student_progress_collection.find(
        {"student_id": student_id},
        {"subject": 1}
    )

    subjects = list(set([r["subject"] for r in records]))
    return subjects


# =========================
# GET LESSON PROGRESS FOR A STUDENT + SUBJECT
# =========================
def get_lesson_progress(student_id, subject):

    # Get all topics for this subject from subjects_collection
    subject_data = subjects_collection.find_one({"name": subject})

    if not subject_data:
        return {
            "subject": subject,
            "total_lessons": 0,
            "completed_lessons": 0,
            "percentage": 0
        }

    total_lessons = len(subject_data.get("lessons", []))

    # Count lessons where at least one topic is unlocked
    completed = student_progress_collection.distinct(
        "lesson",
        {
            "student_id": student_id,
            "subject": subject,
            "topic_unlocked": True
        }
    )

    completed_count = len(completed)
    percentage = round((completed_count / total_lessons) * 100) if total_lessons > 0 else 0

    return {
        "subject": subject,
        "total_lessons": total_lessons,
        "completed_lessons": completed_count,
        "percentage": percentage
    }


# =========================
# GET TOPIC DETAILS FOR A STUDENT + SUBJECT
# =========================
def get_topic_details(student_id, subject):

    # Get all progress records for this student + subject
    records = student_progress_collection.find({
        "student_id": student_id,
        "subject": subject
    })

    result = []

    for r in records:

        # Get delivered content for this topic
        content_record = delivered_content_collection.find_one({
            "student_id": student_id,
            "subject": subject,
            "lesson": r["lesson"],
            "topic": r["topic"]
        })

        result.append({
            "lesson": r["lesson"],
            "topic": r["topic"],
            "level": r.get("level"),
            "initial_quiz_marks": r.get("initial_quiz_marks"),
            "final_quiz_marks": r.get("final_quiz_marks"),
            "lesson_delivered": r.get("lesson_delivered", False),
            "topic_unlocked": r.get("topic_unlocked", False),
            "delivered_content": content_record["content"] if content_record else None
        })

    return result


# =========================
# GET PRE/POST QUIZ IMPROVEMENT FOR A STUDENT (optionally scoped to a subject)
# =========================
def get_improvement_summary(student_id, subject=None):

    query = {"student_id": student_id}
    if subject:
        query["subject"] = subject

    # Only topics where both quiz marks exist can show an improvement delta
    query["initial_quiz_marks"] = {"$ne": None}
    query["final_quiz_marks"] = {"$ne": None}

    records = student_progress_collection.find(query).sort("created_at", 1)

    topics = []
    total_improvement = 0

    for r in records:
        improvement = r["final_quiz_marks"] - r["initial_quiz_marks"]
        total_improvement += improvement
        topics.append({
            "subject": r["subject"],
            "lesson": r["lesson"],
            "topic": r["topic"],
            "level": r.get("level"),
            "initial_quiz_marks": r["initial_quiz_marks"],
            "final_quiz_marks": r["final_quiz_marks"],
            "improvement": improvement,
            "created_at": r["created_at"].isoformat() if r.get("created_at") else None,
        })

    count = len(topics)
    average_improvement = round(total_improvement / count, 2) if count > 0 else 0

    return {
        "topics": topics,
        "count": count,
        "average_improvement": average_improvement,
    }