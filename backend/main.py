import sys
# Force UTF-8 stdout/stderr to prevent UnicodeEncodeError on Windows
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

from fastapi import FastAPI
from pydantic import BaseModel, Field

from typing import Optional, List
from agents.content_agent import generate_content
from agents.quiz_agent import generate_quiz, evaluate_answers
from agents.adaptation_agent import decide_next_step
from agents.student_agent import get_level
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException
from db import users_collection, enrollments_collection, ensure_indexes
from models.User import User
from auth.security import hash_password
from jose import jwt
from auth.security import verify_password
from agents.supervisor import learning_graph

from agents.progress_agent import (
    save_pre_quiz_result,
    save_delivered_content,
    save_post_quiz_result
)

from agents.dashboard_agent import (
    get_all_students,
    get_student_subjects,
    get_lesson_progress,
    get_topic_details
)


load_dotenv(override=True)

print("GROQ KEY LOADED:", os.getenv("GROQ_API_KEY"))

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Startup: ensure personalization indexes + load LSTM ──────────
@app.on_event("startup")
def on_startup():
    ensure_indexes()
    try:
        from services.lstm_service import load_model
        load_model()
    except Exception as e:
        print(f"[Startup] LSTM model load skipped: {e}")
# -------- Request Models --------

class QuizSubmission(BaseModel):
    subject: str
    lesson: str
    topic: str
    student_answers: list
    correct_answers: list
    student_id: str
    level: Optional[str] = None
    quiz_questions: Optional[list] = None    # ← personalization: quiz text for difficulty tracking


class EnrollmentSubmission(BaseModel):
    student_id: str
    subject: str
    lessons: list = Field(default_factory=list)


def normalize_enrolled_lessons(lessons):
    normalized_lessons = []

    for lesson in lessons or []:
        if isinstance(lesson, dict):
            normalized_lessons.append({
                "name": lesson.get("name", ""),
                "topics": lesson.get("topics", []),
            })

    return normalized_lessons


def flatten_topics(lessons):
    topics = []

    for lesson in lessons or []:
        for topic in lesson.get("topics", []):
            if topic not in topics:
                topics.append(topic)

    return topics


def normalize_enrolled_subject(subject):
    if isinstance(subject, str):
        return {
            "subject": subject,
            "lessons": [],
            "lesson_titles": [],
            "topics": [],
        }

    lessons = normalize_enrolled_lessons(subject.get("lessons", []))
    return {
        "subject": subject.get("subject") or subject.get("name") or "",
        "lessons": lessons,
        "lesson_titles": [lesson.get("name", "") for lesson in lessons if lesson.get("name")],
        "topics": flatten_topics(lessons),
    }

# -------- Routes --------

@app.get("/")
def home():
    return {"message": "Adaptive Learning AI Running 🚀"}

@app.get("/pre-quiz/")
def pre_quiz(subject: str, lesson: str, topic: str):
    print(f"Received pre-quiz request for {subject} - {lesson} - {topic}")
    try:
        quiz = generate_quiz(subject, lesson, topic, "Beginner", "pre")
        return {"quiz": quiz}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/submit-pre-quiz/")
def submit_pre_quiz(data: QuizSubmission):

    final_state = learning_graph.invoke({
        "student_id": data.student_id,
        "subject": data.subject,
        "lesson": data.lesson,
        "topic": data.topic,
        "student_answers": data.student_answers,
        "correct_answers": data.correct_answers,
        "quiz_type": "pre",
        "quiz": None,
        "score": None,
        "level": None,
        "content": None,
        "decision": None,
        # ── Personalization fields ──
        "mastery": None,
        "bkt_level": None,
        "quiz_questions": data.quiz_questions
    })

    return {
        "score": final_state["score"],
        "level": final_state["level"],
        "content": final_state["content"],
        "mastery": final_state.get("mastery"),
        "bkt_level": final_state.get("bkt_level")
    }


@app.get("/post-quiz/")
def post_quiz(subject: str, lesson: str, topic: str, level: str):
    try:
        quiz = generate_quiz(subject, lesson, topic, level, "post")
        return {"quiz": quiz}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))



@app.post("/submit-post-quiz/")
def submit_post_quiz(data: QuizSubmission):

    final_state = learning_graph.invoke({
        "student_id": data.student_id,
        "subject": data.subject,
        "lesson": data.lesson,
        "topic": data.topic,
        "student_answers": data.student_answers,
        "correct_answers": data.correct_answers,
        "quiz_type": "post",
        "quiz": None,
        "score": None,
        "level": data.level,
        "content": None,
        "decision": None,
        # ── Personalization fields ──
        "mastery": None,
        "bkt_level": None,
        "quiz_questions": data.quiz_questions
    })

    return {
        "score": final_state["score"],
        "level": final_state["level"],
        "decision": final_state["decision"],
        "content": final_state.get("content"),
        "mastery": final_state.get("mastery"),
        "bkt_level": final_state.get("bkt_level")
    }

@app.get("/get-lesson/")
def get_lesson(subject: str, lesson: str, topic: str, level: str):
    
    content = generate_content(subject, lesson, topic, level)

    return {"content": content}




@app.post("/auth/signup")
def signup(user: User):

    existing_user = users_collection.find_one({"email": user.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="User already exists")

    user_dict = user.dict()
    user_dict["password"] = hash_password(user.password)

    users_collection.insert_one(user_dict)

    return {"message": "User created successfully"}


# Ensure SECRET_KEY is loaded from environment; fallback for local dev
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"

if not SECRET_KEY:
    SECRET_KEY = "dev-secret"
    print("WARNING: SECRET_KEY not set in environment. Using fallback 'dev-secret'. Set SECRET_KEY in .env for production.")


@app.post("/auth/login")
def login(data: dict):

    user = users_collection.find_one({"email": data["email"]})

    if not user:
        raise HTTPException(status_code=401, detail="Invalid email")

    if not verify_password(data["password"], user["password"]):
        raise HTTPException(status_code=401, detail="Invalid password")

    token = jwt.encode(
        {"email": user["email"], "role": user["role"]},
        SECRET_KEY,
        algorithm=ALGORITHM
    )

    return {
        "token": token,
        "role": user["role"],
        "name": user["name"],
        "student_id": str(user["_id"])  
    }

@app.get("/admin/students")
def admin_get_students():
    students = get_all_students()
    return {"students": students}


# ✅ Get all subjects a student has activity in
@app.get("/admin/student-subjects")
def admin_get_student_subjects(student_id: str):
    subjects = get_student_subjects(student_id)
    return {"subjects": subjects}


# ✅ Get lesson completion progress for a student + subject
@app.get("/admin/lesson-progress")
def admin_get_lesson_progress(student_id: str, subject: str):
    progress = get_lesson_progress(student_id, subject)
    return progress


# ✅ Get full topic details for a student + subject
@app.get("/admin/topic-details")
def admin_get_topic_details(student_id: str, subject: str):
    details = get_topic_details(student_id, subject)
    return {"topics": details}


@app.post("/enroll/")
def enroll(data: EnrollmentSubmission):

    if not data.student_id or not data.subject:
        raise HTTPException(status_code=400, detail="student_id and subject required")

    subject_entry = {
        "subject": data.subject,
        "lessons": normalize_enrolled_lessons(data.lessons),
    }
    subject_entry["lesson_titles"] = [lesson.get("name", "") for lesson in subject_entry["lessons"] if lesson.get("name")]
    subject_entry["topics"] = flatten_topics(subject_entry["lessons"])

    existing_enrollment = enrollments_collection.find_one({"student_id": data.student_id}) or {}
    subjects = [normalize_enrolled_subject(subject) for subject in existing_enrollment.get("subjects", [])]

    replaced = False
    for index, subject in enumerate(subjects):
        if subject.get("subject") == data.subject:
            subjects[index] = subject_entry
            replaced = True
            break

    if not replaced:
        subjects.append(subject_entry)

    enrollments_collection.update_one(
        {"student_id": data.student_id},
        {"$set": {"student_id": data.student_id, "subjects": subjects}},
        upsert=True
    )

    return {"message": "enrolled", "student_id": data.student_id, "subject": subject_entry}


@app.get("/enrollments")
def get_enrollments(student_id: str):
    doc = enrollments_collection.find_one({"student_id": student_id})
    if not doc:
        return {"student_id": student_id, "subjects": []}

    subjects = [normalize_enrolled_subject(subject) for subject in doc.get("subjects", [])]

    return {"student_id": student_id, "subjects": subjects}


# ═══════════════════════════════════════════════════════════════
# PERSONALIZATION ENDPOINTS (PC-BKT + BKT-LSTM)
# ═══════════════════════════════════════════════════════════════

@app.get("/personalization/mastery")
def get_mastery_endpoint(student_id: str, subject: str, lesson: str, topic: str):
    """Get the BKT mastery state for a student on a specific skill."""
    from services.bkt_service import make_skill_id, get_mastery, mastery_to_level, get_bkt_params
    skill_id = make_skill_id(subject, lesson, topic)
    mastery = get_mastery(student_id, skill_id)
    params  = get_bkt_params(student_id, skill_id)
    return {
        "student_id": student_id,
        "skill_id":   skill_id,
        "mastery":    mastery,
        "level":      mastery_to_level(mastery),
        "params":     params
    }


@app.get("/personalization/all-masteries")
def get_all_masteries_endpoint(student_id: str):
    """Get all BKT mastery states for a student across all skills."""
    from services.bkt_service import get_all_skill_masteries, mastery_to_level
    masteries = get_all_skill_masteries(student_id)
    return {
        "student_id": student_id,
        "skills": [
            {"skill_id": sid, "mastery": m, "level": mastery_to_level(m)}
            for sid, m in masteries.items()
        ]
    }


@app.get("/personalization/cluster")
def get_cluster_endpoint(student_id: str):
    """Get the student's K-Means cluster assignment."""
    from services.clustering_service import get_student_cluster, CLUSTER_LABELS
    cluster_id = get_student_cluster(student_id)
    return {
        "student_id":    student_id,
        "cluster_id":    cluster_id,
        "cluster_label": CLUSTER_LABELS.get(cluster_id, "Unknown")
    }


@app.post("/personalization/retrain-clusters")
def retrain_clusters():
    """Admin endpoint: re-run K-Means clustering on all students."""
    from services.clustering_service import train_and_save_kmeans
    result = train_and_save_kmeans()
    if result:
        return {"status": "success", **result}
    return {"status": "skipped", "reason": "Not enough data to train K-Means"}


@app.get("/personalization/lstm-status")
def lstm_status():
    """Get LSTM model status for diagnostics."""
    from services.lstm_service import get_model_info
    return get_model_info()