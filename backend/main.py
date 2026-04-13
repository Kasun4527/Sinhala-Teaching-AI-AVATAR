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
    topic: str
    student_answers: list
    correct_answers: list

# -------- Routes --------

@app.get("/")
def home():
    return {"message": "Adaptive Learning AI Running 🚀"}


@app.get("/start-learning/")
def start_learning(topic: str):
    level = "beginner"

    content = generate_content(topic, level)
    quiz = generate_quiz(topic, level)

    return {
        "level": level,
        "content": content,
        "quiz": quiz
    }


@app.post("/submit-quiz/")
def submit_quiz(data: QuizSubmission):
    score = evaluate_answers(
        data.student_answers,
        data.correct_answers
    )

    decision = decide_next_step(score)
    level = get_level(score)

    next_content = generate_content(data.topic, level)

    return {
        "score": score,
        "decision": decision,
        "next_level": level,
        "next_content": next_content
    }