from fastapi import FastAPI
from pydantic import BaseModel

from agents.content_agent import generate_content
from agents.quiz_agent import generate_quiz, evaluate_answers
from agents.adaptation_agent import decide_next_step
from agents.student_agent import get_level
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv


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

    content = generate_content(data.topic, level, data.subject, data.lesson)

    return {
        "score": result["score"],
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