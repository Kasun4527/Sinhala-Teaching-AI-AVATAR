import sys
# Fix Windows console encoding for Sinhala Unicode
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

import asyncio
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from typing import Optional, List
from agents.content_agent import generate_content
from agents.explain_agent import generate_explanation
from agents.quiz_agent import generate_quiz, evaluate_answers
from agents.adaptation_agent import decide_next_step
from agents.student_agent import get_level
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException
from db import users_collection, enrollments_collection, ensure_indexes, student_progress_collection, engagement_collection, qa_collection
from models.User import User
from auth.security import hash_password
from jose import jwt
from auth.security import verify_password
from agents.supervisor import learning_graph

from agents.tts_agent import generate_teacher_speech
from fastapi.responses import Response as FastAPIResponse

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

# Serve images statically
app.mount("/images", StaticFiles(directory="images"), name="images")

# Use an environment variable for CORS so you don't have to commit code when Azure gives you a URL
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=False,
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


# Bug #10: Single answer submission model for per-answer online learning
class SingleAnswerSubmission(BaseModel):
    student_id: str
    subject: str
    lesson: str
    topic: str
    question_index: int
    student_answer: str
    correct_answer: str
    question_text: Optional[str] = None
    quiz_type: str = "pre"


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
async def submit_pre_quiz(data: QuizSubmission):

    final_state = await asyncio.to_thread(
        learning_graph.invoke,
        {
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
            "hybrid_mastery": None,
            "bkt_level": None,
            "quiz_questions": data.quiz_questions
        }
    )

    return {
        "score": final_state["score"],
        "level": final_state["level"],
        "content": final_state["content"],
        "mastery": final_state.get("mastery"),
        "hybrid_mastery": final_state.get("hybrid_mastery"),
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
async def submit_post_quiz(data: QuizSubmission):

    final_state = await asyncio.to_thread(
        learning_graph.invoke,
        {
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
            "hybrid_mastery": None,
            "bkt_level": None,
            "quiz_questions": data.quiz_questions
        }
    )

    return {
        "score": final_state["score"],
        "level": final_state["level"],
        "decision": final_state["decision"],
        "content": final_state.get("content"),
        "mastery": final_state.get("mastery"),
        "hybrid_mastery": final_state.get("hybrid_mastery"),
        "bkt_level": final_state.get("bkt_level")
    }


# ── Bug #10: Per-answer online learning endpoint ─────────────────────────────
@app.post("/submit-answer/")
async def submit_single_answer(data: SingleAnswerSubmission):
    """
    Incremental BKT update for a single answer (online learning).
    Called per-answer during quiz for real-time mastery updates.
    """
    from services.bkt_service import make_skill_id
    from services.difficulty_service import update_difficulty_single
    from agents.personalization_agent import personalize_single_answer

    skill_id = make_skill_id(data.subject, data.lesson, data.topic)
    is_correct = 1 if str(data.student_answer).strip() == str(data.correct_answer).strip() else 0

    def _process_answer():
        res = personalize_single_answer(
            student_id=data.student_id,
            subject=data.subject,
            lesson=data.lesson,
            topic=data.topic,
            is_correct=is_correct,
            quiz_type=data.quiz_type,
            question_text=data.question_text
        )
        # Update difficulty for this question
        if data.question_text:
            try:
                update_difficulty_single(
                    question_text=data.question_text,
                    is_correct=is_correct,
                    skill_id=skill_id
                )
            except Exception as e:
                print(f"[submit-answer] Difficulty update failed: {e}")
        return res

    result = await asyncio.to_thread(_process_answer)

    return {
        "mastery": result["mastery"],
        "level": result["level"],
        "is_uncertain": result["is_uncertain"],
        "question_index": data.question_index,
        # Priority 1 & 5: Adaptive learning signals
        "hint_required": result.get("hint_required", False),
        "adapt_difficulty": result.get("adapt_difficulty", "maintain")
    }


@app.get("/get-lesson/")
def get_lesson(subject: str, lesson: str, topic: str, level: str):
    content = generate_content(subject, lesson, topic, level)
    return {"content": content}


@app.post("/explain-content/")
def explain_content_route(data: dict):
    content = data.get("content", "")
    if not content:
        raise HTTPException(status_code=400, detail="content is required")
    explanation = generate_explanation(content)
    return {"explanation": explanation}


@app.post("/generate-tts/")
async def generate_tts(data: dict):
    """Convert text to WAV audio using Gemini TTS for avatar teacher."""
    text = data.get("text", "")
    if not text:
        raise HTTPException(status_code=400, detail="text is required")
    try:
        wav_bytes = await asyncio.to_thread(generate_teacher_speech, text)
        return FastAPIResponse(content=wav_bytes, media_type="audio/wav")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))




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


@app.get("/sidebar-progress")
def sidebar_progress(student_id: str):
    """Return enrolled subjects with lessons/topics and completion status for sidebar."""
    doc = enrollments_collection.find_one({"student_id": student_id})
    if not doc:
        return {"subjects": []}

    result = []
    for subj in doc.get("subjects", []):
        subj_name = subj.get("subject") or subj.get("name", "")
        completed_topics = set(
            r["topic"]
            for r in student_progress_collection.find(
                {"student_id": student_id, "subject": subj_name, "lesson_delivered": True},
                {"topic": 1}
            )
        )
        lessons_out = []
        for lesson in subj.get("lessons", []):
            topics_out = [
                {"name": t, "done": t in completed_topics}
                for t in lesson.get("topics", [])
            ]
            lessons_out.append({"name": lesson.get("name", ""), "topics": topics_out})
        result.append({"subject": subj_name, "lessons": lessons_out})
    return {"subjects": result}


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


# ── Engagement endpoints ──────────────────────────────────────────────────────

class EngagementSession(BaseModel):
    student_id: str
    subject: str
    lesson: str
    topic: str
    avg_score: float
    min_score: float
    max_score: float
    duration_seconds: int
    timeline: list  # [{"time": "HH:MM:SS", "score": float, "emotion": str}]
    started_at: str

@app.post("/engagement-log")
def log_engagement(data: EngagementSession):
    doc = data.dict()
    engagement_collection.insert_one(doc)
    return {"message": "logged"}

@app.get("/engagement-history")
def get_engagement_history(student_id: str, subject: str, topic: str):
    sessions = list(engagement_collection.find(
        {"student_id": student_id, "subject": subject, "topic": topic},
        {"_id": 0}
    ).sort("started_at", -1).limit(10))
    return {"sessions": sessions}


# ── Student Q&A endpoint ──────────────────────────────────────────────────────
import json as _json
import requests as _requests

class QuestionRequest(BaseModel):
    question: str
    subject: str
    lesson: str
    topic: str
    student_id: Optional[str] = None

@app.post("/ask-question")
async def ask_question(data: QuestionRequest):
    from services.retriever import get_relevant_context
    import datetime
    
    # Run context retrieval in thread
    context = await asyncio.to_thread(get_relevant_context, data.subject, data.lesson, data.topic, 5)
    if not context:
        context = f"{data.topic} relating to {data.subject} - {data.lesson}"

    instruction = "ඔබ දක්ෂ ගුරුවරයෙකි. පහත context ඇසුරින් සිසුවාගේ ප්‍රශ්නයට සරල සිංහල පිළිතුරක් දෙන්න."
    input_text = f"Context:\n{context[:2000]}\n\nප්‍රශ්නය: {data.question}"

    FINETUNED_URL = os.getenv("FINETUNED_URL", "https://cupbearer-pointing-serotonin.ngrok-free.dev/ask")
    try:
        def _fetch():
            return _requests.post(
                FINETUNED_URL,
                headers={"Content-Type": "application/json"},
                data=_json.dumps({"instruction": instruction, "input": input_text, "max_new_tokens": 400}, ensure_ascii=False).encode("utf-8"),
                timeout=120,
            )
        resp = await asyncio.to_thread(_fetch)
        resp.raise_for_status()
        result = resp.json()
        answer = result.get("answer") or result.get("response") or "පිළිතුර ලබා ගත නොහැකි විය."
        answer = answer.strip()

        # Save to DB
        if data.student_id:
            qa_collection.insert_one({
                "student_id": data.student_id,
                "subject": data.subject,
                "lesson": data.lesson,
                "topic": data.topic,
                "question": data.question,
                "answer": answer,
                "asked_at": datetime.datetime.utcnow().isoformat(),
            })

        return {"answer": answer}
    except Exception as e:
        return {"answer": f"Error: {str(e)}"}

@app.get("/admin/student-qa")
def get_student_qa(student_id: str, subject: str, topic: str):
    records = list(qa_collection.find(
        {"student_id": student_id, "subject": subject, "topic": topic},
        {"_id": 0}
    ).sort("asked_at", -1))
    return {"qa": records}
