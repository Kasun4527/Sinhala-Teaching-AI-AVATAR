from fastapi import FastAPI
from pydantic import BaseModel
from typing import Optional
from agents.content_agent import generate_content
from agents.quiz_agent import generate_quiz, evaluate_answers
from agents.adaptation_agent import decide_next_step
from agents.student_agent import get_level
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException
from db import users_collection, questions_collection
from models.User import User
from auth.security import hash_password
from jose import jwt
from auth.security import verify_password
from agents.supervisor import learning_graph
from hybrid_bkt.inference import predict_next_response, update_student_hybrid_state, train_hybrid_model, get_hybrid_mastery
from subjects.buddhism.adapter import get_student_interactions
import pandas as pd
from subjects.buddhism import buddhism_card

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

groq_key = os.getenv("GROQ_API_KEY")
print("GROQ API key configured:", bool(groq_key))

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
    student_id: str
    level: Optional[str] = None        

# -------- Routes --------

@app.get("/")
def home():
    return {"message": "Adaptive Learning AI Running 🚀"}

@app.get("/pre-quiz/")
def pre_quiz(subject: str, lesson: str, topic: str):
    if subject.lower() == "buddhism":
        docs = list(questions_collection.find({"kc_id": topic}).limit(3))
        if docs:
            questions = []
            for doc in docs:
                questions.append({
                    "question": doc.get("question_text", ""),
                    "options": [
                        doc.get("option_a", ""),
                        doc.get("option_b", ""),
                        doc.get("option_c", ""),
                        doc.get("option_d", "")
                    ],
                    "answer": doc.get("correct_answer", "A"),
                    "kc_id": doc.get("kc_id", topic)
                })
            return {"quiz": {"questions": questions}}
            
    quiz = generate_quiz(subject, lesson, topic, "Beginner", "pre")
    return {"quiz": quiz}


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
        "decision": None
    })

    return {
        "score": final_state["score"],
        "level": final_state["level"],
        "content": final_state["content"],
        "rag_prompt": final_state.get("rag_prompt")
    }


@app.get("/post-quiz/")
def post_quiz(subject: str, lesson: str, topic: str, level: str):
    if subject.lower() == "buddhism":
        docs = list(questions_collection.find({"kc_id": topic}).limit(5))
        if docs:
            questions = []
            for doc in docs:
                questions.append({
                    "question": doc.get("question_text", ""),
                    "options": [
                        doc.get("option_a", ""),
                        doc.get("option_b", ""),
                        doc.get("option_c", ""),
                        doc.get("option_d", "")
                    ],
                    "answer": doc.get("correct_answer", "A"),
                    "kc_id": doc.get("kc_id", topic)
                })
            return {"quiz": {"questions": questions}}

    quiz = generate_quiz(subject, lesson, topic, level, "post")
    return {"quiz": quiz}



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
        "decision": None
    })

    # Add BKT specific feedback
    feedback_message = None
    if data.subject.lower() == "buddhism":
        try:
            from hybrid_bkt.inference import get_hybrid_mastery
            state = get_hybrid_mastery(data.student_id)
            if state and "kc_states" in state and data.topic in state["kc_states"]:
                p_know = state["kc_states"][data.topic]["p_know"]
                if p_know > 0.85:
                    feedback_message = f"You are highly skilled in {data.topic}!"
                elif p_know > 0.6:
                    feedback_message = f"You have a good understanding of {data.topic}."
                else:
                    feedback_message = f"You seem to be struggling with {data.topic}, let's review it."
        except Exception as e:
            print("Error generating BKT feedback:", e)

    return {
        "score": final_state["score"],
        "level": final_state["level"],
        "decision": final_state["decision"],
        "content": final_state.get("content"),
        "rag_prompt": final_state.get("rag_prompt"),
        "bkt_feedback": feedback_message
    }

@app.get("/get-lesson/")
def get_lesson(subject: str, lesson: str, topic: str, level: str):
    
    content = generate_content(subject, lesson, topic, level)

    # normalize response: generate_content may return a dict {content, rag_prompt}
    if isinstance(content, dict):
        return {"content": content.get("content"), "rag_prompt": content.get("rag_prompt")}
    return {"content": content, "rag_prompt": None}




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

# -------- Hybrid BKT Routes --------

class InteractionData(BaseModel):
    student_id: str
    skill_id: str
    subject: str = "Buddhism"
    is_correct: bool
    difficulty: Optional[float] = 5.0

@app.post("/hybrid/train")
def train_hybrid(epochs: int = 30):
    try:
        interactions = get_student_interactions()
        df = pd.DataFrame(interactions)
        result = train_hybrid_model(df, epochs)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/hybrid/mastery/{student_id}")
def get_mastery(student_id: str):
    try:
        state = get_hybrid_mastery(student_id)
        return state
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/hybrid/predict")
def predict_bkt(student_id: str, skill_id: str, subject: str = "Buddhism", difficulty: float = 5.0):
    try:
        prediction = predict_next_response(student_id, skill_id, difficulty)
        return {"student_id": student_id, "skill_id": skill_id, "subject": subject, "prediction": prediction}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/model/update")
def update_bkt(data: InteractionData):
    try:
        result = update_student_hybrid_state(data.student_id, data.skill_id, data.is_correct, data.difficulty)
        return {"message": "Hybrid BKT state updated successfully", "new_p_L": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/hybrid/status")
def bkt_status(subject: str = "Buddhism"):
    return {"status": "ready", "subject": subject}