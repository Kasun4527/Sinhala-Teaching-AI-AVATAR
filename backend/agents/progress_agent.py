from db import student_progress_collection, delivered_content_collection
from datetime import datetime
from bson import ObjectId

# =========================
# SAVE PROGRESS AFTER PRE-QUIZ
# =========================
def save_pre_quiz_result(student_id, subject, lesson, topic, level, score,
                        mastery=None, bkt_level=None):
    
    # Check if record already exists
    existing = student_progress_collection.find_one({
        "student_id": student_id,
        "subject": subject,
        "lesson": lesson,
        "topic": topic
    })

    update_fields = {
        "level": level,
        "initial_quiz_marks": score,
        "updated_at": datetime.utcnow()
    }
    # Add BKT-derived fields if available
    if mastery is not None:
        update_fields["mastery"] = mastery
    if bkt_level is not None:
        update_fields["bkt_level"] = bkt_level

    if existing:
        # Update existing record
        student_progress_collection.update_one(
            {"_id": existing["_id"]},
            {"$set": update_fields}
        )
        return str(existing["_id"])

    # Create new record
    record = {
        "student_id": student_id,
        "subject": subject,
        "lesson": lesson,
        "topic": topic,
        "level": level,
        "initial_quiz_marks": score,
        "final_quiz_marks": None,
        "lesson_delivered": False,
        "topic_unlocked": False,
        "created_at": datetime.utcnow()
    }
    if mastery is not None:
        record["mastery"] = mastery
    if bkt_level is not None:
        record["bkt_level"] = bkt_level

    result = student_progress_collection.insert_one(record)
    return str(result.inserted_id)


# =========================
# SAVE DELIVERED LESSON CONTENT
# =========================
def save_delivered_content(student_id, subject, lesson, topic, level, content):

    # Avoid duplicate content saves
    existing = delivered_content_collection.find_one({
        "student_id": student_id,
        "subject": subject,
        "lesson": lesson,
        "topic": topic
    })

    if existing:
        delivered_content_collection.update_one(
            {"_id": existing["_id"]},
            {"$set": {
                "content": content,
                "level": level,
                "updated_at": datetime.utcnow()
            }}
        )
        return str(existing["_id"])

    record = {
        "student_id": student_id,
        "subject": subject,
        "lesson": lesson,
        "topic": topic,
        "level": level,
        "content": content,
        "created_at": datetime.utcnow()
    }

    result = delivered_content_collection.insert_one(record)
    return str(result.inserted_id)


# =========================
# SAVE POST QUIZ RESULT
# =========================
def save_post_quiz_result(student_id, subject, lesson, topic, score,
                         mastery=None, bkt_level=None):

    unlocked = score >= 6

    update_fields = {
        "final_quiz_marks": score,
        "lesson_delivered": True,
        "topic_unlocked": unlocked,
        "updated_at": datetime.utcnow()
    }
    # Add BKT-derived fields if available
    if mastery is not None:
        update_fields["mastery"] = mastery
    if bkt_level is not None:
        update_fields["bkt_level"] = bkt_level

    student_progress_collection.update_one(
        {
            "student_id": student_id,
            "subject": subject,
            "lesson": lesson,
            "topic": topic
        },
        {"$set": update_fields}
    )

    return {"topic_unlocked": unlocked}


# =========================
# GET STUDENT PROGRESS FOR A TOPIC
# =========================
def get_topic_progress(student_id, subject, lesson, topic):

    record = student_progress_collection.find_one({
        "student_id": student_id,
        "subject": subject,
        "lesson": lesson,
        "topic": topic
    })

    if not record:
        return None

    record["_id"] = str(record["_id"])
    return record