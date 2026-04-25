from fastapi import FastAPI
from pydantic import BaseModel
from agents.content_agent import generate_content
from agents.quiz_agent import generate_quiz, evaluate_answers
from agents.adaptation_agent import decide_next_step
from agents.student_agent import get_level
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException
from db import users_collection
from models.User import User
from auth.security import hash_password
from jose import jwt
from auth.security import verify_password

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
# -------- Request Models --------

class QuizSubmission(BaseModel):
    subject: str
    lesson: str
    topic: str
    student_answers: list
    correct_answers: list
    student_id: str        # ✅ add this

# -------- Routes --------

@app.get("/")
def home():
    return {"message": "Adaptive Learning AI Running 🚀"}

@app.get("/pre-quiz/")
def pre_quiz(subject: str, lesson: str, topic: str):
    quiz = generate_quiz(subject, lesson, topic, "Beginner", "pre")
    
    return {"quiz": quiz}


@app.post("/submit-pre-quiz/")
def submit_pre_quiz(data: QuizSubmission):

    result = evaluate_answers(
        data.student_answers,
        data.correct_answers
    )

    level = result["level"]
    score = result["score"]

    content = generate_content(data.topic, level, data.subject, data.lesson)

    # ✅ Save pre quiz result
    save_pre_quiz_result(
        student_id=data.student_id,
        subject=data.subject,
        lesson=data.lesson,
        topic=data.topic,
        level=level,
        score=score
    )

    # ✅ Save delivered content
    save_delivered_content(
        student_id=data.student_id,
        subject=data.subject,
        lesson=data.lesson,
        topic=data.topic,
        level=level,
        content=content
    )

    return {
        "score": score,
        "level": level,
        "content": content
    }


@app.get("/post-quiz/")
def post_quiz(subject: str, lesson: str, topic: str, level: str):
    quiz = generate_quiz(subject, lesson, topic, level, "post")

    return {"quiz": quiz}



@app.post("/submit-post-quiz/")
def submit_post_quiz(data: QuizSubmission):

    result = evaluate_answers(
        data.student_answers,
        data.correct_answers
    )

    score = result["score"]

    # ✅ Save post quiz result
    save_post_quiz_result(
        student_id=data.student_id,
        subject=data.subject,
        lesson=data.lesson,
        topic=data.topic,
        score=score
    )

    if score >= 6:
        decision = "NEXT_TOPIC"
    else:
        decision = "REPEAT_LESSON"

    return {
        "score": score,
        "level": result["level"],
        "decision": decision
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



load_dotenv()
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"


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