import sys
# Fix Windows console encoding for Sinhala Unicode
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

import asyncio
from bson import ObjectId
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from typing import Optional, List
from agents.content_agent import generate_content
from agents.explain_agent import generate_explanation, generate_paragraph_explanations
from agents.quiz_agent import generate_quiz, evaluate_answers, get_pooled_quiz
from agents.adaptation_agent import decide_next_step
from agents.student_agent import get_level
from fastapi.middleware.cors import CORSMiddleware
import os
import requests
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException
from db import users_collection, enrollments_collection, ensure_indexes, student_progress_collection, engagement_collection, qa_collection, youtube_watch_collection, curriculum_topics_collection, explain_cache_collection, parent_links_collection, notifications_collection
from services.email_service import send_verification_email, verify_token
from models.User import User
from auth.security import hash_password
from jose import jwt
from auth.security import verify_password
from agents.supervisor import learning_graph

from agents.tts_agent import generate_teacher_speech
from fastapi.responses import Response as FastAPIResponse
from fastapi.responses import FileResponse
from fastapi import UploadFile, File, BackgroundTasks
from agents.align_agent import get_word_timestamps, words_to_sentence_segments

import json
import re
import shutil
import threading
import uuid
import tempfile
from pathlib import Path
from pdf_pipeline.pipeline import PDFPipeline, BlockItem
from services.vector_store import ingest_text_content

from agents.progress_agent import (
    save_pre_quiz_result,
    save_delivered_content,
    save_post_quiz_result
)

from agents.review_agent import (
    list_delivered_content,
    get_delivered_content_for_topic,
    save_practice_quiz_result,
    list_practice_quiz_results,
)

from agents.dashboard_agent import (
    get_all_students,
    get_student_subjects,
    get_lesson_progress,
    get_topic_details,
    get_improvement_summary
)


load_dotenv(override=True)

print("GROQ KEY LOADED:", os.getenv("GROQ_API_KEY"))

app = FastAPI()

# Serve images statically
app.mount("/images", StaticFiles(directory="images"), name="images")

_default_origins = [
    "http://localhost:3000", 
    "http://127.0.0.1:3000",
    "https://witty-moss-04a910200.7.azurestaticapps.net"
]
_frontend_url = os.getenv("FRONTEND_URL")
allow_origins = _default_origins + [_frontend_url] if _frontend_url else _default_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure CORS headers are present even on unhandled 500 errors
from fastapi import Request
from fastapi.responses import JSONResponse

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import traceback
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc)},
        headers={"Access-Control-Allow-Origin": request.headers.get("origin", "*")},
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


# Practice-quiz submission — separate from QuizSubmission because this flow
# never touches student_progress_collection/BKT (see agents/review_agent.py).
class PracticeQuizSubmission(BaseModel):
    subject: str
    lesson: str
    topic: str
    student_id: str
    quiz_questions: list
    student_answers: list


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
    grade: str = ""  # e.g. "11 ශ්‍රේණිය" — used for education-level validation


class SkipPreQuizRequest(BaseModel):
    student_id: str
    subject: str
    lesson: str
    topic: str


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


class AlignRequest(BaseModel):
    audio_b64: str        # base64-encoded WAV
    text:      str        # original speech text for sentence mapping
    duration:  float = 0  # WAV duration in seconds (used as fallback)

@app.post("/align-audio/")
async def align_audio(data: AlignRequest):
    """
    Run faster-whisper on the provided WAV and return sentence-level segments
    with real timestamps.  Falls back to character-ratio if whisper fails.
    """
    import base64
    try:
        wav_bytes = base64.b64decode(data.audio_b64)
        words     = get_word_timestamps(wav_bytes)
        segments  = words_to_sentence_segments(data.text, words, data.duration)
        return {"segments": segments, "words": words, "source": "whisper"}
    except Exception as exc:
        import traceback; traceback.print_exc()
        # Graceful fallback — character ratio
        from agents.align_agent import words_to_sentence_segments as wts
        segments = wts(data.text, [], data.duration)
        return {"segments": segments, "words": [], "source": "fallback", "error": str(exc)}


@app.get("/pre-quiz/")
def pre_quiz(subject: str, lesson: str, topic: str):
    print(f"Received pre-quiz request for {subject} - {lesson} - {topic}")
    try:
        quiz = get_pooled_quiz(subject, lesson, topic, "Beginner", "pre")
        return {"quiz": quiz}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ── Pre-quiz bypass: student self-selects Beginner level ─────────────────
@app.post("/skip-pre-quiz/")
async def skip_pre_quiz(data: SkipPreQuizRequest):
    """
    Allows a student to bypass the pre-quiz and start directly as a Beginner.
    Initializes BKT at cold-start defaults (mastery=0.30) and generates
    Beginner-level content without requiring quiz answers.
    """
    from services.bkt_service import DEFAULT_L0, make_skill_id, get_subject_transfer_L0

    print(f"⏩ [SkipPreQuiz] {data.student_id} skipping pre-quiz for {data.subject}/{data.lesson}/{data.topic}")

    # Use transfer L0 if student has prior subject history, otherwise cold-start default
    initial_mastery = get_subject_transfer_L0(data.student_id, data.subject)
    level = "Beginner"

    # Generate Beginner-level content (uses cache if available)
    content = await asyncio.to_thread(
        generate_content,
        subject=data.subject,
        lesson=data.lesson,
        topic=data.topic,
        level=level
    )

    # Save progress with quiz_type="skip" to distinguish from assessed students
    save_pre_quiz_result(
        student_id=data.student_id,
        subject=data.subject,
        lesson=data.lesson,
        topic=data.topic,
        level=level,
        score=0,
        mastery=initial_mastery,
        bkt_level=level,
        quiz_type="skip"
    )

    save_delivered_content(
        student_id=data.student_id,
        subject=data.subject,
        lesson=data.lesson,
        topic=data.topic,
        level=level,
        content=content
    )

    return {
        "level": level,
        "content": content,
        "mastery": initial_mastery,
        "score": 0
    }


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
        quiz = get_pooled_quiz(subject, lesson, topic, level, "post")
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


# ── Past lessons review + on-demand practice quiz ──────────────────────────
# Separate from the pre/post-quiz flow: these never write to
# student_progress_collection, so they can't affect topic_unlocked/mastery/BKT.

@app.get("/past-lessons/")
def past_lessons(student_id: str, subject: str = None):
    return {"topics": list_delivered_content(student_id, subject)}


@app.get("/past-lessons/content/")
def past_lesson_content(student_id: str, subject: str, lesson: str, topic: str):
    record = get_delivered_content_for_topic(student_id, subject, lesson, topic)
    if not record:
        raise HTTPException(status_code=404, detail="No delivered content found for this topic.")
    return record


@app.get("/practice-quiz/")
def practice_quiz(student_id: str, subject: str, lesson: str, topic: str):
    record = get_delivered_content_for_topic(student_id, subject, lesson, topic)
    if not record:
        raise HTTPException(status_code=404, detail="No delivered content found for this topic.")
    quiz = generate_quiz(subject, lesson, topic, record["level"], "practice", context=record["content"])
    return {"quiz": quiz}


@app.post("/practice-quiz/submit/")
def submit_practice_quiz(data: PracticeQuizSubmission):
    correct_answers = [q.get("answer") for q in data.quiz_questions]
    result = save_practice_quiz_result(
        student_id=data.student_id,
        subject=data.subject,
        lesson=data.lesson,
        topic=data.topic,
        level=None,
        quiz_questions=data.quiz_questions,
        student_answers=data.student_answers,
        correct_answers=correct_answers,
    )
    return result


@app.get("/practice-quiz/results/")
def practice_quiz_results(student_id: str, subject: str = None, lesson: str = None, topic: str = None):
    return {"results": list_practice_quiz_results(student_id, subject, lesson, topic)}


@app.post("/explain-content/")
def explain_content_route(data: dict):
    import hashlib
    import datetime as _dt

    content = data.get("content", "")
    paragraphs = data.get("paragraphs", [])
    if not content:
        raise HTTPException(status_code=400, detail="content is required")

    # Same generated content (from the content_cache in content_agent.py, or
    # coincidentally identical across students) shouldn't pay for a second
    # LLM round-trip just to re-explain it. Keyed by a hash of the exact
    # input rather than subject/lesson/topic/level, since this endpoint
    # doesn't receive those — the content itself is what's actually reused.
    cache_input = json.dumps({"content": content, "paragraphs": paragraphs}, ensure_ascii=False, sort_keys=True)
    content_hash = hashlib.sha256(cache_input.encode("utf-8")).hexdigest()
    cached = explain_cache_collection.find_one({"content_hash": content_hash})
    if cached:
        return cached["result"]

    if paragraphs:
        explanation_parts, explained = generate_paragraph_explanations(paragraphs)
        explanation = "\n\n".join(explanation_parts)
        result = {"explanation": explanation, "explanationParts": explanation_parts, "explained": explained}
    else:
        explanation, explained = generate_explanation(content)
        result = {"explanation": explanation, "explained": explained}

    # Only cache genuine successful explanations — never the raw-content
    # fallback (explained: False) — so a transient failure doesn't get
    # served as the permanent "explanation" for this content.
    if result.get("explained"):
        explain_cache_collection.update_one(
            {"content_hash": content_hash},
            {"$set": {"content_hash": content_hash, "result": result, "created_at": _dt.datetime.utcnow()}},
            upsert=True,
        )

    return result


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




def _resolve_teacher_id(teacher_code: str) -> str:
    """Look up a teacher by their human-readable teacher_code (e.g. 'TE482917').
    Falls back to matching by _id for legacy codes that are raw ObjectIds."""
    # Try human-readable code first
    teacher = users_collection.find_one({"teacher_code": teacher_code, "role": "admin"})
    if teacher:
        return str(teacher["_id"])
    # Fallback: legacy raw ObjectId codes
    try:
        teacher = users_collection.find_one({"_id": ObjectId(teacher_code), "role": "admin"})
    except Exception:
        teacher = None
    if not teacher:
        raise HTTPException(status_code=400, detail="Invalid teacher code")
    return str(teacher["_id"])


@app.post("/auth/signup")
def signup(user: User):
    existing_user = users_collection.find_one({"email": user.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="User already exists")

    user_dict = user.dict()
    user_dict["password"] = hash_password(user.password)
    # Parents skip email verification entirely — there's no web verification
    # flow surfaced to them, so requiring it would just permanently block
    # mobile parent signup.
    user_dict["is_verified"] = (user.role == "parent")

    teacher_code = user_dict.pop("teacher_code", None)
    if user.role == "student" and teacher_code:
        user_dict["teacher_id"] = _resolve_teacher_id(teacher_code)

    # Persist education_level for students (OL / AL); None for legacy
    if user.role != "student":
        user_dict.pop("education_level", None)

    # Keep contact_number for parents; strip it for other roles
    if user.role != "parent":
        user_dict.pop("contact_number", None)

    # Generate a human-readable teacher code for admin accounts, and student code for students
    import random
    if user.role == "admin":
        while True:
            code = f"TE{random.randint(100000, 999999)}"
            if not users_collection.find_one({"teacher_code": code}):
                break
        user_dict["teacher_code"] = code
    elif user.role == "student":
        while True:
            code = f"ST{random.randint(100000, 999999)}"
            if not users_collection.find_one({"student_code": code}):
                break
        user_dict["student_code"] = code

    users_collection.insert_one(user_dict)

    if user.role != "parent":
        try:
            send_verification_email(user.email, user.name)
        except Exception as e:
            import traceback
            print(f"[Signup] Email send failed: {e}")
            traceback.print_exc()
            # Don't block signup if email fails — user can request resend later

    message = (
        "Account created. You can log in now."
        if user.role == "parent"
        else "Account created. Please check your email to verify your account."
    )
    return {"message": message}


@app.get("/auth/verify-email")
def verify_email(token: str):
    email = verify_token(token)
    if not email:
        raise HTTPException(status_code=400, detail="Invalid or expired verification link")

    result = users_collection.update_one(
        {"email": email},
        {"$set": {"is_verified": True}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")

    return {"message": "Email verified successfully. You can now log in."}


@app.post("/auth/resend-verification")
def resend_verification(data: dict):
    email = data.get("email", "").strip()
    user = users_collection.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=404, detail="No account found with that email")
    if user.get("is_verified"):
        raise HTTPException(status_code=400, detail="This account is already verified")
    try:
        send_verification_email(email, user.get("name", ""))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send email: {e}")
    return {"message": "Verification email resent. Please check your inbox."}


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

    # Parents are exempt from email verification (see /auth/signup) — this
    # also covers parent accounts created before that exemption existed.
    if not user.get("is_verified", False) and user.get("role") != "parent":
        raise HTTPException(status_code=403, detail="Please verify your email before logging in. Check your inbox for the verification link.")

    token = jwt.encode(
        {"email": user["email"], "role": user["role"]},
        SECRET_KEY,
        algorithm=ALGORITHM
    )

    return {
        "token": token,
        "role": user["role"],
        "name": user["name"],
        "student_id": str(user["_id"]),
        "teacher_id": user.get("teacher_id"),  # null if not yet linked to a teacher
        "education_level": user.get("education_level"),  # "OL" | "AL" | None (legacy)
        "teacher_code": user.get("teacher_code"),  # e.g. "TE482917" for admins
        "student_code": user.get("student_code"),  # e.g. "ST123456" for students
    }


@app.post("/auth/set-teacher-code")
def set_teacher_code(data: dict):
    """Lets an already-registered student (signed up before this feature,
    or who skipped it) link to a teacher afterwards."""
    student_id = data.get("student_id", "")
    teacher_code = data.get("teacher_code", "")
    if not student_id or not teacher_code:
        raise HTTPException(status_code=400, detail="student_id and teacher_code are required")

    teacher_id = _resolve_teacher_id(teacher_code)

    try:
        result = users_collection.update_one(
            {"_id": ObjectId(student_id), "role": "student"},
            {"$set": {"teacher_id": teacher_id}},
        )
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid student_id")
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Student not found")

    return {"teacher_id": teacher_id}


@app.get("/auth/test-email")
def test_email_connection():
    import smtplib, os
    user = os.getenv("GMAIL_USER", "")
    pwd  = (os.getenv("GMAIL_APP_PASSWORD") or "").replace(" ", "")
    result = {"user": user, "password_len": len(pwd)}
    try:
        with smtplib.SMTP("smtp.gmail.com", 587) as s:
            s.ehlo(); s.starttls(); s.ehlo()
            s.login(user, pwd)
            result["status"] = "SUCCESS — credentials are correct"
    except Exception as e:
        result["status"] = f"FAILED: {e}"
    return result


@app.get("/admin/students")
def admin_get_students(teacher_id: str = None):
    students = get_all_students(teacher_id)
    return {"students": students}


@app.get("/admin/safety-alerts")
def admin_get_safety_alerts(teacher_id: str = None, limit: int = 50):
    """Fetch recent safety-flag incidents for the teacher's admin dashboard.

    If teacher_id is provided, only flags linked to that teacher's students
    are returned. Otherwise, all flags are returned (for superadmin use).
    """
    from services.content_guard import get_safety_alerts
    alerts = get_safety_alerts(teacher_id=teacher_id, limit=limit)
    # Convert datetime objects to ISO strings for JSON serialization.
    for a in alerts:
        if "created_at" in a and a["created_at"]:
            a["created_at"] = a["created_at"].isoformat()
        if "reviewed_at" in a and a["reviewed_at"]:
            a["reviewed_at"] = a["reviewed_at"].isoformat()
    return {"alerts": alerts, "count": len(alerts)}


# ✅ Look up a single student's name by their own id — /admin/students only
# returns students scoped to a teacher_id, with no by-id lookup mode. Used
# by the mobile parent dashboard to resolve a student ID (entered manually
# at parent signup, since there's no parent↔child link stored anywhere)
# to a real name.
@app.get("/admin/student-lookup")
def admin_student_lookup(student_id: str):
    """Look up a student by ObjectId or by human-readable STXXXXXX code."""
    student = None
    # Try STXXXXXX code first
    if student_id.upper().startswith("ST") and len(student_id) == 8:
        student = users_collection.find_one({"student_code": student_id.upper(), "role": "student"})
    # Fallback: raw ObjectId
    if not student:
        try:
            student = users_collection.find_one({"_id": ObjectId(student_id), "role": "student"})
        except Exception:
            student = None
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    return {"name": student["name"], "email": student["email"], "student_id": str(student["_id"])}


# ── Student Profile (bio fields) ─────────────────────────────────────────────
PROFILE_FIELDS = ["bio", "contact_number", "parent_name", "parent_contact", "school"]


@app.get("/student-profile")
def get_student_profile(student_id: str):
    """Return editable profile fields for a student."""
    try:
        student = users_collection.find_one({"_id": ObjectId(student_id), "role": "student"})
    except Exception:
        student = None
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    student_code = student.get("student_code")
    if not student_code:
        import random
        while True:
            student_code = f"ST{random.randint(100000, 999999)}"
            if not users_collection.find_one({"student_code": student_code}):
                break
        users_collection.update_one({"_id": student["_id"]}, {"$set": {"student_code": student_code}})

    return {
        "name": student.get("name", ""),
        "email": student.get("email", ""),
        "student_code": student_code,
        "education_level": student.get("education_level"),
        "profile_complete": all(student.get(f) for f in PROFILE_FIELDS),
        **{f: student.get(f, "") for f in PROFILE_FIELDS},
    }


class StudentProfileUpdate(BaseModel):
    student_id: str
    bio: str = ""
    contact_number: str = ""
    parent_name: str = ""
    parent_contact: str = ""
    school: str = ""


@app.put("/student-profile")
def update_student_profile(body: StudentProfileUpdate):
    """Update editable profile fields for a student."""
    try:
        student = users_collection.find_one({"_id": ObjectId(body.student_id), "role": "student"})
    except Exception:
        student = None
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    update = {f: getattr(body, f) for f in PROFILE_FIELDS if getattr(body, f)}
    if not update:
        raise HTTPException(status_code=400, detail="No fields to update")

    users_collection.update_one({"_id": ObjectId(body.student_id)}, {"$set": update})
    return {"message": "Profile updated", "profile_complete": all(update.get(f) for f in PROFILE_FIELDS)}


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


# ✅ Pre/post-quiz improvement trend for a student — used by both the
# student's own dashboard (their own student_id) and the admin dashboard
# (any student_id), optionally scoped to one subject.
@app.get("/progress-improvement")
def progress_improvement(student_id: str, subject: str = None):
    return get_improvement_summary(student_id, subject)


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


# Grade→education-level mapping for enrollment gating
_OL_GRADES = {"11 ශ්‍රේණිය"}
_AL_GRADES = {"12 ශ්‍රේණිය", "13 ශ්‍රේණිය"}


@app.post("/enroll/")
def enroll(data: EnrollmentSubmission):

    if not data.student_id or not data.subject:
        raise HTTPException(status_code=400, detail="student_id and subject required")

    # ── Education-level guard ──────────────────────────────────────────
    # Legacy accounts (education_level=None) are unrestricted.
    try:
        student = users_collection.find_one({"_id": ObjectId(data.student_id)})
    except Exception:
        student = None
    level = student.get("education_level") if student else None
    if level and data.grade:
        if level == "OL" and data.grade not in _OL_GRADES:
            raise HTTPException(status_code=403, detail="O/L students cannot enrol in A/L subjects")
        if level == "AL" and data.grade not in _AL_GRADES:
            raise HTTPException(status_code=403, detail="A/L students cannot enrol in O/L subjects")

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
# The engagement engine is its own hosted service (browser captures webcam
# frames and POSTs them directly to it) — the backend only stores/reads the
# session summaries it logs afterward.

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
    from services.retriever import get_relevant_context, search_by_question
    import datetime

    context = None

    # Best case: a specific topic lets us pin down the exact source document.
    if data.topic:
        context = await asyncio.to_thread(get_relevant_context, data.subject, data.lesson, data.topic, 5)

    # Fallback for chatbots on pages without a specific topic (or where the
    # topic didn't match a file) — search using the student's actual
    # question, scoped by whatever subject/lesson is available.
    if not context:
        context = await asyncio.to_thread(
            search_by_question, data.question, data.subject or None, data.lesson or None, 5
        )

    if not context:
        context = f"{data.topic} relating to {data.subject} - {data.lesson}"

    instruction = "ඔබ දක්ෂ ගුරුවරයෙකි. පහත context ඇසුරින් සිසුවාගේ ප්‍රශ්නයට සරල සිංහල පිළිතුරක් දෙන්න."
    input_text = f"Context:\n{context[:2000]}\n\nප්‍රශ්නය: {data.question}"

    FINETUNED_URL = os.getenv("SINHALA_LLM_URL", "https://cupbearer-pointing-serotonin.ngrok-free.dev/ask")
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


# ── YouTube search + watch-history endpoints ──────────────────────────────────
@app.get("/youtube/search")
def youtube_search(q: str):
    api_key = os.getenv("YOUTUBE_API_KEY")
    resp = requests.get(
        "https://www.googleapis.com/youtube/v3/search",
        params={
            "part": "snippet",
            "type": "video",
            "maxResults": 10,
            "safeSearch": "strict",
            "videoCategoryId": "27",  # Education
            "q": q,
            "key": api_key,
        },
        timeout=10,
    )
    resp.raise_for_status()
    items = resp.json().get("items", [])
    return {"results": [
        {
            "video_id": item["id"]["videoId"],
            "title": item["snippet"]["title"],
            "thumbnail_url": item["snippet"]["thumbnails"]["medium"]["url"],
            "channel_title": item["snippet"]["channelTitle"],
        }
        for item in items
    ]}


class YouTubeWatchSession(BaseModel):
    student_id: str
    subject: str
    lesson: str
    topic: str
    video_id: str
    video_title: str
    video_url: str
    watched_seconds: int
    started_at: str

@app.post("/youtube-log")
def log_youtube_watch(data: YouTubeWatchSession):
    youtube_watch_collection.insert_one(data.dict())
    return {"message": "logged"}

@app.get("/admin/youtube-history")
def get_youtube_history(student_id: str, subject: str, topic: str):
    sessions = list(youtube_watch_collection.find(
        {"student_id": student_id, "subject": subject, "topic": topic},
        {"_id": 0}
    ).sort("started_at", -1).limit(10))
    return {"sessions": sessions}


# ════════════════════════════════════════════════════════════════════════
# PDF Ingestion Pipeline (Admin) — upload a textbook PDF, review extracted
# images and generated topic text, then finalize: saves .txt files into
# documents_unicode/, images into images/, and ingests each topic directly
# into the vector store. Ported from the separate admin_portal project's
# pipeline.py/page_detector.py/text_cleaner.py (backend/pdf_pipeline/),
# adapted so finalize writes directly into this project instead of
# zipping and publishing to a separate backend.
#
# Three-stage job flow, mirroring admin_portal's pattern:
#   1. POST /admin/pdf/extract      — upload PDF, background-extract blocks/images
#   2. POST /admin/pdf/build-text   — selected images + subject/lesson -> topic text
#   3. POST /admin/pdf/finalize     — edited topics -> save + ingest
# Poll GET /admin/pdf/jobs/{job_id} for status between each stage.
# ════════════════════════════════════════════════════════════════════════

pdf_pipeline = PDFPipeline()
_pdf_jobs: dict = {}
_pdf_jobs_lock = threading.Lock()

DOCUMENTS_UNICODE_DIR = "documents_unicode"
IMAGES_DIR = "images"

# Admin_portal's pipeline emits "[image: base_name]" (lowercase, no
# extension); this project's convention is "[IMAGE: filename.ext]"
# (uppercase, with the real extension) — normalized at finalize time.
_PDF_IMAGE_TAG = re.compile(r'\[image:\s*([^\]]+)\]', re.IGNORECASE)


def _pdf_slugify(value: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9඀-෿]+", "_", value.strip())
    cleaned = re.sub(r"_+", "_", cleaned).strip("_")
    return cleaned or "untitled"


@app.post("/admin/pdf/extract")
async def pdf_extract(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
):
    if file.content_type not in {
        "application/pdf", "application/x-pdf", "application/octet-stream",
    }:
        raise HTTPException(status_code=400, detail="Please upload a PDF file.")

    job_id = str(uuid.uuid4())
    job_dir = Path(tempfile.mkdtemp(prefix=f"pdf_job_{job_id}_"))
    safe_name = Path(file.filename or "textbook.pdf").name
    pdf_path = job_dir / safe_name
    contents = await file.read()
    pdf_path.write_bytes(contents)

    with _pdf_jobs_lock:
        _pdf_jobs[job_id] = {
            "status": "extracting",
            "progress": 10,
            "message": "Starting extraction...",
            "job_dir": job_dir,
            "pdf_path": pdf_path,
            "extracted_images": [],
            "error": None,
        }

    background_tasks.add_task(_run_pdf_extract_job, job_id)
    return {"job_id": job_id}


def _run_pdf_extract_job(job_id: str) -> None:
    with _pdf_jobs_lock:
        job = _pdf_jobs[job_id]
        pdf_path = job["pdf_path"]
        job_dir = job["job_dir"]
    try:
        blocks, image_files = pdf_pipeline.extract_phase(pdf_path, job_dir)
        blocks_path = job_dir / "blocks.json"
        blocks_path.write_text(
            json.dumps([b.to_dict() for b in blocks], ensure_ascii=False),
            encoding="utf-8",
        )
        with _pdf_jobs_lock:
            job = _pdf_jobs[job_id]
            job["status"] = "extracted"
            job["message"] = f"Extraction complete. Found {len(image_files)} images."
            job["progress"] = 100
            job["extracted_images"] = [p.name for p in image_files]
    except Exception as exc:
        with _pdf_jobs_lock:
            job = _pdf_jobs[job_id]
            job["status"] = "failed"
            job["message"] = "Extraction failed"
            job["progress"] = 100
            job["error"] = str(exc)


@app.get("/admin/pdf/jobs/{job_id}")
def pdf_job_status(job_id: str):
    with _pdf_jobs_lock:
        job = _pdf_jobs.get(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        return {
            "job_id": job_id,
            "status": job["status"],
            "progress": job["progress"],
            "message": job["message"],
            "extracted_images": job.get("extracted_images", []),
            "topics": job.get("topics", []),
            "final_images_mapping": job.get("final_images_mapping", {}),
            "saved_txt_files": job.get("saved_txt_files", []),
            "saved_images": job.get("saved_images", []),
            "error": job.get("error"),
        }


@app.get("/admin/pdf/jobs/{job_id}/image/{image_name}")
def pdf_job_image(job_id: str, image_name: str):
    with _pdf_jobs_lock:
        job = _pdf_jobs.get(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        job_dir = job["job_dir"]
    if Path(image_name).name != image_name:
        raise HTTPException(status_code=400, detail="Invalid image name")
    image_path = job_dir / "images" / image_name
    if not image_path.exists():
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(str(image_path))


class PdfBuildTextRequest(BaseModel):
    job_id: str
    selected_images: List[str]
    subject: str
    lesson: str


@app.post("/admin/pdf/build-text")
def pdf_build_text(req: PdfBuildTextRequest, background_tasks: BackgroundTasks):
    with _pdf_jobs_lock:
        job = _pdf_jobs.get(req.job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        if job["status"] not in ("extracted", "failed"):
            raise HTTPException(status_code=400, detail="Job not ready for building text")
        job["status"] = "building_text"
        job["progress"] = 30
        job["message"] = "Building text topics..."
        job["selected_images"] = req.selected_images
        job["subject"] = req.subject
        job["lesson"] = req.lesson

    background_tasks.add_task(_run_pdf_build_text_job, req.job_id)
    return {"job_id": req.job_id}


def _run_pdf_build_text_job(job_id: str) -> None:
    with _pdf_jobs_lock:
        job = _pdf_jobs[job_id]
        job_dir = job["job_dir"]
        selected_images = job["selected_images"]
        subject = job["subject"]
    try:
        blocks_data = json.loads((job_dir / "blocks.json").read_text(encoding="utf-8"))
        blocks = [BlockItem.from_dict(d) for d in blocks_data]
        result = pdf_pipeline.build_text_phase(
            blocks, job_dir, selected_images, subject, lesson_spec=None
        )
        with _pdf_jobs_lock:
            job = _pdf_jobs[job_id]
            job["status"] = "text_ready"
            job["message"] = "Text generated successfully."
            job["progress"] = 60
            job["topics"] = result["topics"]
            job["lesson_name"] = result["lesson_name"]
            job["final_images_mapping"] = result["final_images_mapping"]
    except Exception as exc:
        with _pdf_jobs_lock:
            job = _pdf_jobs[job_id]
            job["status"] = "failed"
            job["message"] = "Build text failed"
            job["progress"] = 100
            job["error"] = str(exc)


class PdfTopicData(BaseModel):
    title: str
    content: str


class PdfFinalizeRequest(BaseModel):
    job_id: str
    topics: List[PdfTopicData]
    subject: str
    lesson: str
    grade: str = ""  # e.g. "12 ශ්‍රේණිය" — used to place new topics in the student curriculum UI
    teacher_id: str = ""  # uploading teacher's own user id — scopes this content to their students


@app.post("/admin/pdf/finalize")
def pdf_finalize(req: PdfFinalizeRequest, background_tasks: BackgroundTasks):
    with _pdf_jobs_lock:
        job = _pdf_jobs.get(req.job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        job["status"] = "finalizing"
        job["progress"] = 80
        job["message"] = "Saving files and ingesting into the vector DB..."
        job["topics_data"] = [t.dict() for t in req.topics]
        job["subject"] = req.subject
        job["lesson"] = req.lesson
        job["grade"] = req.grade
        job["teacher_id"] = req.teacher_id

    background_tasks.add_task(_run_pdf_finalize_job, req.job_id)
    return {"job_id": req.job_id}


def _run_pdf_finalize_job(job_id: str) -> None:
    with _pdf_jobs_lock:
        job = _pdf_jobs[job_id]
        job_dir = job["job_dir"]
        topics_data = job["topics_data"]
        subject = job["subject"]
        lesson_name = job.get("lesson") or job.get("lesson_name", "lesson")
        grade = job.get("grade", "")
        teacher_id = job.get("teacher_id", "")

    try:
        subject_slug = _pdf_slugify(subject)
        lesson_slug = _pdf_slugify(lesson_name)

        # Map each extracted image's base name (no extension) to its real
        # filename, so "[image: base]" tags can be rewritten to this
        # project's "[IMAGE: filename.ext]" convention with the correct
        # extension rather than assuming one.
        image_dir = job_dir / "images"
        ext_by_base = {}
        if image_dir.exists():
            for p in image_dir.iterdir():
                ext_by_base[p.stem] = p.name

        def _normalize_tag(match: "re.Match") -> str:
            base = match.group(1).strip()
            real_name = ext_by_base.get(base, f"{base}.png")
            return f"[IMAGE: {real_name}]"

        saved_txt_files = []
        for topic in topics_data:
            clean_title = re.sub(r'^\d+\.\d+\s*', '', topic["title"])
            topic_slug = _pdf_slugify(clean_title)
            # Canonical backend metadata contract: subject_lesson_topic.txt
            filename = f"{subject_slug}_{lesson_slug}_{topic_slug}.txt"

            content = _PDF_IMAGE_TAG.sub(_normalize_tag, topic["content"])

            txt_path = Path(DOCUMENTS_UNICODE_DIR) / filename
            txt_path.parent.mkdir(parents=True, exist_ok=True)
            txt_path.write_text(content, encoding="utf-8")
            saved_txt_files.append(filename)

            # Ingest this topic's chunks into the vector store right away —
            # non-destructive: only this file's prior chunks are replaced.
            ingest_text_content(content, filename)

            # Record the topic so the student curriculum UI can show it —
            # the frontend's static curriculum.js is merged with these
            # records at load time (GET /curriculum-additions). Upsert so
            # re-finalizing the same topic doesn't create duplicates.
            curriculum_topics_collection.update_one(
                {"grade": grade, "subject": subject, "lesson": lesson_name, "topic": clean_title},
                {"$set": {
                    "grade": grade,
                    "subject": subject,
                    "lesson": lesson_name,
                    "topic": clean_title,
                    "source_file": filename,
                    "teacher_id": teacher_id,
                }},
                upsert=True,
            )

        saved_images = []
        if image_dir.exists():
            dest_dir = Path(IMAGES_DIR)
            dest_dir.mkdir(parents=True, exist_ok=True)
            for p in image_dir.iterdir():
                shutil.copy2(p, dest_dir / p.name)
                saved_images.append(p.name)

        with _pdf_jobs_lock:
            job = _pdf_jobs[job_id]
            job["status"] = "completed"
            job["progress"] = 100
            job["message"] = (
                f"Saved {len(saved_txt_files)} topic file(s) and "
                f"{len(saved_images)} image(s), and ingested them into the vector DB."
            )
            job["saved_txt_files"] = saved_txt_files
            job["saved_images"] = saved_images

    except Exception as exc:
        with _pdf_jobs_lock:
            job = _pdf_jobs[job_id]
            job["status"] = "failed"
            job["message"] = "Finalize failed"
            job["progress"] = 100
            job["error"] = str(exc)


@app.get("/curriculum-additions")
def curriculum_additions(student_id: str = None, teacher_id: str = None):
    """Topics added via the admin PDF pipeline, grouped by grade → subject →
    lesson. The student frontend fetches this (passing its own student_id)
    and merges it into its static curriculum so newly ingested topics show
    up for selection. A teacher can pass their own id directly to preview
    their own uploads.

    Visibility: records with no teacher_id (added before this feature
    existed) are global — visible to everyone. Records added afterwards are
    scoped to the uploading teacher's own students only.
    """
    resolved_teacher_id = teacher_id
    if student_id and not resolved_teacher_id:
        try:
            student = users_collection.find_one({"_id": ObjectId(student_id)})
        except Exception:
            student = None
        resolved_teacher_id = student.get("teacher_id") if student else None

    visibility = [{"teacher_id": {"$in": ["", None]}}, {"teacher_id": {"$exists": False}}]
    if resolved_teacher_id:
        visibility.append({"teacher_id": resolved_teacher_id})

    grouped: dict = {}
    for rec in curriculum_topics_collection.find({"$or": visibility}, {"_id": 0}):
        key = (rec.get("grade", ""), rec.get("subject", ""), rec.get("lesson", ""))
        grouped.setdefault(key, [])
        topic = rec.get("topic", "")
        if topic and topic not in grouped[key]:
            grouped[key].append(topic)
    return {"additions": [
        {"grade": g, "subject": s, "lesson": l, "topics": topics}
        for (g, s, l), topics in grouped.items()
    ]}


# ═══════════════════════════════════════════════════════════════════════════════
#  PARENT ↔ STUDENT LINKING + NOTIFICATIONS
# ═══════════════════════════════════════════════════════════════════════════════

def _resolve_student_id(value: str) -> str:
    """Resolve a student code (STXXXXXX) or raw ObjectId string to a real
    ObjectId string. Raises HTTPException(404) if not found."""
    student = None
    if value.upper().startswith("ST") and len(value) == 8:
        student = users_collection.find_one({"student_code": value.upper(), "role": "student"})
    if not student:
        try:
            student = users_collection.find_one({"_id": ObjectId(value), "role": "student"})
        except Exception:
            student = None
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    return str(student["_id"])


class LinkChildRequest(BaseModel):
    parent_id: str
    student_code: str  # accepts STXXXXXX or raw ObjectId


@app.post("/parent/link-child")
def parent_link_child(body: LinkChildRequest):
    """Create a persistent parent→student link. Idempotent — linking the same
    child twice is silently ignored (no error, no duplicate)."""
    # Verify parent exists
    try:
        parent = users_collection.find_one({"_id": ObjectId(body.parent_id), "role": "parent"})
    except Exception:
        parent = None
    if not parent:
        raise HTTPException(status_code=404, detail="Parent account not found")

    real_student_id = _resolve_student_id(body.student_code)

    from datetime import datetime
    try:
        parent_links_collection.insert_one({
            "parent_id": body.parent_id,
            "student_id": real_student_id,
            "linked_at": datetime.utcnow(),
        })
    except Exception:
        # Duplicate (unique index) — silently succeed
        pass

    student = users_collection.find_one({"_id": ObjectId(real_student_id)})
    return {
        "message": "Child linked successfully",
        "student_id": real_student_id,
        "student_name": student["name"] if student else "Unknown",
    }


@app.get("/parent/children")
def parent_get_children(parent_id: str):
    """Return all children linked to a parent — replaces on-device storage."""
    links = parent_links_collection.find({"parent_id": parent_id})
    children = []
    for link in links:
        student = users_collection.find_one({"_id": ObjectId(link["student_id"])})
        if student:
            children.append({
                "student_id": str(student["_id"]),
                "name": student["name"],
                "email": student.get("email", ""),
                "student_code": student.get("student_code", ""),
            })
    return {"children": children}


@app.get("/student/parent-info")
def student_get_parent_info(student_id: str):
    """Return the linked parent's name and contact number for display on
    the student's settings page (read-only)."""
    link = parent_links_collection.find_one({"student_id": student_id})
    if not link:
        return {"linked": False}
    parent = users_collection.find_one({"_id": ObjectId(link["parent_id"])})
    if not parent:
        return {"linked": False}
    return {
        "linked": True,
        "parent_name": parent.get("name", ""),
        "parent_contact": parent.get("contact_number", ""),
        "parent_email": parent.get("email", ""),
    }


@app.get("/admin/student-parent")
def admin_get_student_parent(student_id: str):
    """Teacher fetches parent details for a selected student."""
    link = parent_links_collection.find_one({"student_id": student_id})
    if not link:
        return {"has_parent": False}
    parent = users_collection.find_one({"_id": ObjectId(link["parent_id"])})
    if not parent:
        return {"has_parent": False}
    return {
        "has_parent": True,
        "parent_id": str(parent["_id"]),
        "parent_name": parent.get("name", ""),
        "parent_contact": parent.get("contact_number", ""),
        "parent_email": parent.get("email", ""),
    }


class SendParentMessageRequest(BaseModel):
    teacher_id: str
    student_id: str
    message: str


@app.post("/admin/send-parent-message")
def admin_send_parent_message(body: SendParentMessageRequest):
    """Teacher sends a message to a student's parent. Stored as a notification."""
    # Verify teacher
    try:
        teacher = users_collection.find_one({"_id": ObjectId(body.teacher_id), "role": "admin"})
    except Exception:
        teacher = None
    if not teacher:
        raise HTTPException(status_code=403, detail="Not a valid teacher account")

    # Find parent link
    link = parent_links_collection.find_one({"student_id": body.student_id})
    if not link:
        raise HTTPException(status_code=404, detail="No parent linked to this student")

    from datetime import datetime
    notifications_collection.insert_one({
        "recipient_id": link["parent_id"],
        "sender_id": body.teacher_id,
        "sender_name": teacher.get("name", "Teacher"),
        "type": "parent_message",
        "message": body.message,
        "student_id": body.student_id,
        "read": False,
        "created_at": datetime.utcnow(),
    })
    return {"message": "Message sent to parent"}


class SendStudentFeedbackRequest(BaseModel):
    teacher_id: str
    student_id: str
    subject: str = ""
    lesson: str = ""
    message: str


@app.post("/admin/send-student-feedback")
def admin_send_student_feedback(body: SendStudentFeedbackRequest):
    """Teacher sends feedback to a student, shown in the student's Navbar notifications."""
    try:
        teacher = users_collection.find_one({"_id": ObjectId(body.teacher_id), "role": "admin"})
    except Exception:
        teacher = None
    if not teacher:
        raise HTTPException(status_code=403, detail="Not a valid teacher account")

    from datetime import datetime
    notifications_collection.insert_one({
        "recipient_id": body.student_id,
        "sender_id": body.teacher_id,
        "sender_name": teacher.get("name", "Teacher"),
        "type": "student_feedback",
        "subject": body.subject,
        "lesson": body.lesson,
        "message": body.message,
        "read": False,
        "created_at": datetime.utcnow(),
    })
    return {"message": "Feedback sent to student"}


@app.get("/notifications")
def get_notifications(user_id: str, type: str = None, limit: int = 20):
    """Fetch notifications for a user (student or parent)."""
    query = {"recipient_id": user_id}
    if type:
        query["type"] = type
    docs = list(notifications_collection.find(
        query, {"_id": 1, "sender_name": 1, "type": 1, "subject": 1, "lesson": 1,
                "message": 1, "read": 1, "created_at": 1, "student_id": 1}
    ).sort("created_at", -1).limit(limit))
    for d in docs:
        d["id"] = str(d.pop("_id"))
        if d.get("created_at"):
            d["created_at"] = d["created_at"].isoformat()
    return {"notifications": docs, "unread_count": notifications_collection.count_documents({"recipient_id": user_id, "read": False})}


@app.put("/notifications/read")
def mark_notification_read(notification_id: str):
    """Mark a notification as read."""
    try:
        notifications_collection.update_one(
            {"_id": ObjectId(notification_id)},
            {"$set": {"read": True}}
        )
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid notification ID")
    return {"message": "Marked as read"}

