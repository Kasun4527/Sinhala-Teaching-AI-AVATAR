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
import logging
from fastapi import APIRouter, HTTPException
from db import users_collection, questions_collection
from models.User import User
from auth.security import hash_password
from jose import jwt
from auth.security import verify_password
from agents.supervisor import learning_graph
from hybrid_bkt.inference import predict_next_response, update_student_hybrid_state, train_hybrid_model, get_hybrid_mastery
from subjects.buddhism.adapter import (
    get_student_interactions,
    log_interaction,
    get_pre_quiz_questions_for_grade_11,
    get_post_quiz_questions_for_grade_11,
    get_kc_info,
    ingest_grade_11_quiz_bank,
    initialize_grade_11_buddhism_topics,
    get_pre_quiz_questions_for_lesson,
    get_post_quiz_questions_for_lesson,
    GRADE_11_BUDDHISM_KCS
)
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

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],  # frontend ports
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize BKT engine on app startup
@app.on_event("startup")
async def initialize_bkt_engine():
    """Initialize BKT engine with Grade 11 KC IDs on startup"""
    from hybrid_bkt.pc_bkt_engine import pc_bkt_engine
    
    # Register Grade 11 KCs if not already registered
    grade_11_kc_ids = ["11.1.1", "11.1.2", "11.2.1"]
    for kc_id in grade_11_kc_ids:
        if kc_id not in pc_bkt_engine.kc_ids:
            pc_bkt_engine.kc_ids.append(kc_id)
            # Initialize BKT parameters for new KC
            pc_bkt_engine.p_guess[kc_id] = 0.2
            pc_bkt_engine.p_slip[kc_id] = 0.1
            logger.info(f"📚 Registered KC {kc_id} in BKT engine")
    
    # Save updated engine state
    pc_bkt_engine.save_to_db()
    logger.info(f"✅ BKT engine initialized with {len(pc_bkt_engine.kc_ids)} KCs")

# -------- Request Models --------

class QuizSubmission(BaseModel):
    subject: str
    lesson: str
    topic: Optional[str] = None
    student_answers: list
    correct_answers: list
    student_id: str
    level: Optional[str] = None
    kc_ids: Optional[list] = None  # Added to support combined lesson quizzes

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
    print("\n🚀 [DEBUG] Received POST request to /submit-pre-quiz/", flush=True)
    # Buddhism specific logic (Grade 11 combined lesson quizzes)
    logger.info(f"🔍 Received quiz submission for subject: {data.subject}")
    if data.subject and data.subject.lower() == "buddhism":
        try:
            # 1. Update BKT for each interaction
            if data.student_answers and data.correct_answers:
                # Use kc_ids if provided (lesson level), otherwise use topic (kc level)
                kc_list = data.kc_ids if (data.kc_ids and len(data.kc_ids) > 0) else [data.topic] * len(data.student_answers)
                
                score_count = 0
                for q_idx, (student_ans, correct_ans, kc_id) in enumerate(zip(data.student_answers, data.correct_answers, kc_list)):
                    # Use the same normalization as in grade-11 endpoints
                    def normalize(ans):
                        if ans is None: return None
                        if isinstance(ans, int): return ans
                        ans_str = str(ans).strip().lower()
                        if ans_str in ['a', '0']: return 0
                        if ans_str in ['b', '1']: return 1
                        if ans_str in ['c', '2']: return 2
                        if ans_str in ['d', '3']: return 3
                        return None
                    
                    is_correct = normalize(student_ans) == normalize(correct_ans)
                    if is_correct: score_count += 1
                    
                    # Update Hybrid BKT state
                    if kc_id:
                        update_student_hybrid_state(data.student_id, kc_id, is_correct, difficulty=5.0)
                        
                        # Log BKT parameters
                        mastery = get_hybrid_mastery(data.student_id)
                        kc_state = mastery.get("kc_states", {}).get(kc_id, {})
                        pl = kc_state.get('p_know', 'N/A')
                        pt = mastery.get('p_transit', 'N/A')
                        pg = kc_state.get('p_guess', 'N/A')
                        ps = kc_state.get('p_slip', 'N/A')
                        print(f"Q {q_idx+1} ({kc_id}) - Pl: {pl} - Pt: {pt} - Pg: {pg} - Ps: {ps}", flush=True)
                        logger.info(f"Q {q_idx+1} ({kc_id}) - Pl: {pl} - Pt: {pt} - Pg: {pg} - Ps: {ps}")
                
                # 2. Calculate average score (scaled to 10 for the graph)
                total = len(data.student_answers)
                calculated_score = (score_count / total * 10) if total > 0 else 0
                
                # 3. Invoke learning graph with the calculated score
                final_state = learning_graph.invoke({
                    "student_id": data.student_id,
                    "subject": data.subject,
                    "lesson": data.lesson,
                    "topic": data.topic or data.lesson, # Fallback if topic is null
                    "student_answers": data.student_answers,
                    "correct_answers": data.correct_answers,
                    "quiz_type": "pre",
                    "quiz": None,
                    "score": calculated_score, # Pass the score we calculated
                    "level": None,
                    "content": None,
                    "decision": None
                })
                
                logger.info(f"✅ Buddhism Pre-Quiz submitted: Score {score_count}/{total} for student {data.student_id}")
                
                # Sample prompt log as requested by user
                student_level = final_state.get("level", "Beginner")
                sample_prompt_log = f"+generate a lesson on {data.lesson} and {data.topic or 'all subtopics'} for a student in level {student_level}"
                print(f"\n[PROMPT SAMPLE]\n{sample_prompt_log}\n", flush=True)
                logger.info(f"[PROMPT SAMPLE] {sample_prompt_log}")
                
                return {
                    "score": final_state["score"],
                    "level": final_state["level"],
                    "content": final_state["content"],
                    "rag_prompt": final_state.get("rag_prompt")
                }
        except Exception as e:
            logger.error(f"❌ Buddhism pre-quiz submission failed: {e}")
            # Fallback to general logic if Buddhism specific fails

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
    print("\n🚀 [DEBUG] Received POST request to /submit-post-quiz/", flush=True)
    # Buddhism specific logic
    if data.subject.lower() == "buddhism":
        try:
            kc_list = data.kc_ids if (data.kc_ids and len(data.kc_ids) > 0) else [data.topic] * len(data.student_answers)
            score_count = 0
            
            def normalize(ans):
                if ans is None: return None
                if isinstance(ans, int): return ans
                ans_str = str(ans).strip().lower()
                if ans_str in ['a', '0']: return 0
                if ans_str in ['b', '1']: return 1
                if ans_str in ['c', '2']: return 2
                if ans_str in ['d', '3']: return 3
                return None

            for q_idx, (student_ans, correct_ans, kc_id) in enumerate(zip(data.student_answers, data.correct_answers, kc_list)):
                is_correct = normalize(student_ans) == normalize(correct_ans)
                if is_correct: score_count += 1
                if kc_id:
                    update_student_hybrid_state(data.student_id, kc_id, is_correct, difficulty=5.0)
                    
                    # Log BKT parameters
                    mastery = get_hybrid_mastery(data.student_id)
                    kc_state = mastery.get("kc_states", {}).get(kc_id, {})
                    pl = kc_state.get('p_know', 'N/A')
                    pt = mastery.get('p_transit', 'N/A')
                    pg = kc_state.get('p_guess', 'N/A')
                    ps = kc_state.get('p_slip', 'N/A')
                    print(f"Q {q_idx+1} ({kc_id}) - Pl: {pl} - Pt: {pt} - Pg: {pg} - Ps: {ps}", flush=True)
                    logger.info(f"Q {q_idx+1} ({kc_id}) - Pl: {pl} - Pt: {pt} - Pg: {pg} - Ps: {ps}")
            
            total = len(data.student_answers)
            calculated_score = (score_count / total * 10) if total > 0 else 0
            
            final_state = learning_graph.invoke({
                "student_id": data.student_id,
                "subject": data.subject,
                "lesson": data.lesson,
                "topic": data.topic or data.lesson,
                "student_answers": data.student_answers,
                "correct_answers": data.correct_answers,
                "quiz_type": "post",
                "quiz": None,
                "score": calculated_score,
                "level": data.level,
                "content": None,
                "decision": None
            })
            
            # Add BKT feedback
            feedback_message = None
            state = get_hybrid_mastery(data.student_id)
            target_kc = data.topic if data.topic else (data.kc_ids[0] if data.kc_ids else None)
            
            if target_kc and state and "kc_states" in state and target_kc in state["kc_states"]:
                p_know = state["kc_states"][target_kc]["p_know"]
                if p_know > 0.85: feedback_message = f"✨ You have mastered {target_kc}!"
                elif p_know > 0.6: feedback_message = f"👍 Great progress on {target_kc}."
                else: feedback_message = f"📚 Let's keep working on {target_kc}."

            return {
                "score": final_state["score"],
                "level": final_state["level"],
                "decision": final_state["decision"],
                "content": final_state.get("content"),
                "rag_prompt": final_state.get("rag_prompt"),
                "bkt_feedback": feedback_message
            }
        except Exception as e:
            logger.error(f"❌ Buddhism post-quiz submission failed: {e}")

    # General subject logic
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

    return {
        "score": final_state["score"],
        "level": final_state["level"],
        "decision": final_state["decision"],
        "content": final_state.get("content"),
        "rag_prompt": final_state.get("rag_prompt"),
        "bkt_feedback": None
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


# ========== GRADE 11 BUDDHISM ENDPOINTS ==========

@app.get("/grade-11/topics")
def get_grade_11_topics():
    """Get all Grade 11 Buddhism knowledge components"""
    return {
        "grade": 11,
        "subject": "Buddhism",
        "topics": GRADE_11_BUDDHISM_KCS
    }

@app.get("/grade-11/pre-quiz/")
def grade_11_pre_quiz(kc_id: str):
    """Get pre-quiz questions for Grade 11 Buddhism KC"""
    if kc_id not in GRADE_11_BUDDHISM_KCS:
        raise HTTPException(status_code=404, detail="Knowledge Component not found")
    
    kc_info = get_kc_info(kc_id, grade=11)
    questions = get_pre_quiz_questions_for_grade_11(kc_id, limit=5)
    
    if not questions:
        return {"error": "No questions available", "kc_id": kc_id}
    
    formatted_questions = []
    for doc in questions:
        formatted_questions.append({
            "question_id": doc.get("question_id"),
            "question": doc.get("question_text", ""),
            "options": [
                doc.get("option_a", ""),
                doc.get("option_b", ""),
                doc.get("option_c", ""),
                doc.get("option_d", "")
            ],
            "correct_answer": doc.get("correct_answer", "A"),
            "answer": doc.get("correct_answer", "A"),
            "skill_tag": doc.get("skill_tag"),
            "difficulty": doc.get("difficulty"),
            "blooms_level": doc.get("blooms_level"),
            "kc_id": kc_id
        })
    
    return {
        "quiz_type": "pre",
        "kc_id": kc_id,
        "kc_name": kc_info.get("name") if kc_info else "",
        "questions": formatted_questions,
        "quiz": {
            "questions": formatted_questions
        }
    }

@app.get("/grade-11/post-quiz/")
def grade_11_post_quiz(kc_id: str, student_id: str):
    """Get post-quiz questions for Grade 11 Buddhism KC with adaptive difficulty"""
    if kc_id not in GRADE_11_BUDDHISM_KCS:
        raise HTTPException(status_code=404, detail="Knowledge Component not found")
    
    kc_info = get_kc_info(kc_id, grade=11)
    
    # Get student's current mastery level
    try:
        mastery_state = get_hybrid_mastery(student_id)
        p_know = mastery_state.get("kc_states", {}).get(kc_id, {}).get("p_know", 0.5)
    except:
        p_know = 0.5
    
    # Select questions based on mastery level
    questions = get_post_quiz_questions_for_grade_11(kc_id, limit=5)
    
    if not questions:
        return {"error": "No questions available", "kc_id": kc_id}
    
    formatted_questions = []
    for doc in questions:
        formatted_questions.append({
            "question_id": doc.get("question_id"),
            "question": doc.get("question_text", ""),
            "options": [
                doc.get("option_a", ""),
                doc.get("option_b", ""),
                doc.get("option_c", ""),
                doc.get("option_d", "")
            ],
            "correct_answer": doc.get("correct_answer", "A"),
            "answer": doc.get("correct_answer", "A"),
            "skill_tag": doc.get("skill_tag"),
            "difficulty": doc.get("difficulty"),
            "blooms_level": doc.get("blooms_level"),
            "kc_id": kc_id
        })
    
    return {
        "quiz_type": "post",
        "kc_id": kc_id,
        "kc_name": kc_info.get("name") if kc_info else "",
        "student_mastery": p_know,
        "questions": formatted_questions,
        "quiz": {
            "questions": formatted_questions
        }
    }

@app.get("/grade-11/lesson/pre-quiz/")
def grade_11_lesson_pre_quiz(lesson: int):
    """Get combined pre-quiz questions for all KCs in a lesson"""
    questions = get_pre_quiz_questions_for_lesson(lesson, limit_per_kc=5)
    
    if not questions:
        return {"error": f"No questions available for lesson {lesson}"}
    
    formatted_questions = []
    for doc in questions:
        formatted_questions.append({
            "question_id": doc.get("question_id"),
            "question": doc.get("question_text", ""),
            "options": [
                doc.get("option_a", ""),
                doc.get("option_b", ""),
                doc.get("option_c", ""),
                doc.get("option_d", "")
            ],
            "correct_answer": doc.get("correct_answer", "A"),
            "answer": doc.get("correct_answer", "A"),
            "skill_tag": doc.get("skill_tag"),
            "difficulty": doc.get("difficulty"),
            "blooms_level": doc.get("blooms_level"),
            "kc_id": doc.get("kc_id")
        })
    
    logger.info(f"📚 Loaded {len(formatted_questions)} pre-quiz questions for lesson {lesson}")
    
    return {
        "quiz_type": "pre",
        "lesson": lesson,
        "questions": formatted_questions,
        "quiz": {
            "questions": formatted_questions
        }
    }

@app.get("/grade-11/lesson/post-quiz/")
def grade_11_lesson_post_quiz(lesson: int, student_id: str):
    """Get combined post-quiz questions for all KCs in a lesson with adaptive difficulty"""
    questions = get_post_quiz_questions_for_lesson(lesson, limit_per_kc=5)
    
    if not questions:
        return {"error": f"No questions available for lesson {lesson}"}
    
    # Get student's mastery levels
    try:
        mastery_state = get_hybrid_mastery(student_id)
        kc_states = mastery_state.get("kc_states", {})
    except:
        kc_states = {}
    
    formatted_questions = []
    for doc in questions:
        formatted_questions.append({
            "question_id": doc.get("question_id"),
            "question": doc.get("question_text", ""),
            "options": [
                doc.get("option_a", ""),
                doc.get("option_b", ""),
                doc.get("option_c", ""),
                doc.get("option_d", "")
            ],
            "correct_answer": doc.get("correct_answer", "A"),
            "answer": doc.get("correct_answer", "A"),
            "skill_tag": doc.get("skill_tag"),
            "difficulty": doc.get("difficulty"),
            "blooms_level": doc.get("blooms_level"),
            "kc_id": doc.get("kc_id")
        })
    
    logger.info(f"📚 Loaded {len(formatted_questions)} post-quiz questions for lesson {lesson}")
    
    return {
        "quiz_type": "post",
        "lesson": lesson,
        "kc_states": kc_states,
        "questions": formatted_questions,
        "quiz": {
            "questions": formatted_questions
        }
    }

class Grade11LessonQuizSubmission(BaseModel):
    student_id: str
    lesson: int
    student_answers: list  # List of selected answers
    correct_answers: list  # List of correct answers
    kc_ids: list  # List of KC IDs answered

class Grade11QuizSubmission(BaseModel):
    student_id: str
    kc_id: str
    student_answers: list  # List of selected answers
    correct_answers: list  # List of correct answers
    response_times: list = []  # Optional: time taken per question


@app.post("/grade-11/submit-quiz/")
def submit_grade_11_quiz(data: Grade11QuizSubmission):
    print("\n🚀 [DEBUG] Received POST request to /grade-11/submit-quiz/", flush=True)
    """Submit Grade 11 Buddhism quiz and update student modeling

    Logs per-question BKT parameters (P_l, P_t, P_g, P_s) before updating,
    records post-update P_l, and returns `bkt_logs` and a sample generation prompt.
    """
    # Validate KC
    if data.kc_id not in GRADE_11_BUDDHISM_KCS:
        raise HTTPException(status_code=404, detail="Knowledge Component not found")

    kc_info = GRADE_11_BUDDHISM_KCS.get(data.kc_id, {})

    # Normalize answers for comparison (handle index, letter, or text)
    def normalize_answer(ans):
        """Normalize answer to index position (0, 1, 2, 3)"""
        if ans is None:
            return None
        if isinstance(ans, int):
            return ans
        ans_str = str(ans).strip().lower()
        if ans_str in ['a', '0']: return 0
        if ans_str in ['b', '1']: return 1
        if ans_str in ['c', '2']: return 2
        if ans_str in ['d', '3']: return 3
        return None

    score = 0
    correct_responses = []
    bkt_logs = []

    logger.info(f"🧾 Scoring quiz for {data.student_id} on KC {data.kc_id}")
    logger.info(f"   Student answers: {data.student_answers}")
    logger.info(f"   Correct answers: {data.correct_answers}")

    for i, (student_ans, correct_ans) in enumerate(zip(data.student_answers, data.correct_answers)):
        norm_student = normalize_answer(student_ans)
        norm_correct = normalize_answer(correct_ans)
        is_correct = norm_student == norm_correct
        logger.info(f"   Q{i+1}: student={student_ans}({norm_student}) vs correct={correct_ans}({norm_correct}) = {is_correct}")

        # Capture pre-update BKT parameters
        try:
            mastery_before = get_hybrid_mastery(data.student_id)
            kc_state_before = mastery_before.get("kc_states", {}).get(data.kc_id, {})
            p_l_before = kc_state_before.get("p_know", 0.0)
            p_g = kc_state_before.get("p_guess", 0.2)
            p_s = kc_state_before.get("p_slip", 0.1)
            p_t = mastery_before.get("p_transit", 0.1)
        except Exception:
            p_l_before = p_g = p_s = p_t = 0.0

        logger.info(f"   Q{i+1} PRE BKT -> P_l:{p_l_before:.4f} P_t:{p_t:.4f} P_g:{p_g:.4f} P_s:{p_s:.4f}")

        # Update BKT for each question
        try:
            new_p = update_student_hybrid_state(
                data.student_id,
                data.kc_id,
                is_correct,
                difficulty=5.0
            )
        except Exception as e:
            logger.warning(f"BKT update failed: {e}")
            new_p = None

        # Capture post-update P_l
        try:
            mastery_after = get_hybrid_mastery(data.student_id)
            p_l_after = mastery_after.get("kc_states", {}).get(data.kc_id, {}).get("p_know", None)
        except Exception:
            p_l_after = None

        bkt_logs.append({
            "question_index": i + 1,
            "pre": {"p_l": round(p_l_before, 4), "p_t": round(p_t, 4), "p_g": round(p_g, 4), "p_s": round(p_s, 4)},
            "post": {"p_l": round(p_l_after, 4) if p_l_after is not None else None}
        })

        score += int(is_correct)
        correct_responses.append(is_correct)

    total_questions = len(data.student_answers)
    score_percentage = (score / total_questions * 100) if total_questions > 0 else 0

    # Get updated mastery state and compute student level
    try:
        mastery = get_hybrid_mastery(data.student_id)
        p_know = mastery.get("kc_states", {}).get(data.kc_id, {}).get("p_know", 0.0)
    except Exception:
        p_know = 0.0

    level = "Beginner" if p_know < 0.35 else "Intermediate" if p_know < 0.6 else "Advanced" if p_know < 0.85 else "Expert"

    # Generate a sample lesson generation prompt for visibility
    final_prompt = f"generate a lesson on lesson {kc_info.get('lesson')} and subtopic {kc_info.get('topic')} for a student in level {level}"
    logger.info(f"🔎 Final generation prompt: {final_prompt}")

    # Generate BKT feedback
    bkt_feedback = ""
    if p_know > 0.85:
        bkt_feedback = f"✨ Excellent! You've mastered {kc_info.get('name', data.kc_id)}!"
    elif p_know > 0.6:
        bkt_feedback = f"👍 Good progress on {kc_info.get('name', data.kc_id)}. Keep practicing!"
    elif p_know > 0.35:
        bkt_feedback = f"📚 You're making progress. Review the content and try again."
    else:
        bkt_feedback = f"🔄 Let's review {kc_info.get('name', data.kc_id)} together."

    # Log interaction for analytics
    log_interaction(data.student_id, data.kc_id, score > (total_questions // 2), grade=11)

    logger.info(f"✅ Final score for {data.student_id}: {score}/{total_questions} ({score_percentage}%)")

    return {
        "student_id": data.student_id,
        "kc_id": data.kc_id,
        "score": score,
        "total_questions": total_questions,
        "score_percentage": round(score_percentage, 2),
        "correct_responses": correct_responses,
        "mastery_level": round(p_know, 3),
        "bkt_feedback": bkt_feedback,
        "level": level,
        "bkt_logs": bkt_logs,
        "generation_prompt": final_prompt,
        "next_recommendation": kc_info.get("content", "")
    }

@app.post("/grade-11/lesson/submit-quiz/")
def submit_grade_11_lesson_quiz(data: Grade11LessonQuizSubmission):
    print("\n🚀 [DEBUG] Received POST request to /grade-11/lesson/submit-quiz/", flush=True)
    """Submit combined lesson quiz and update BKT for all KCs

    Log per-question BKT parameters and return a `bkt_logs` list and a sample generation prompt.
    """
    def normalize_answer(ans):
        """Normalize answer to index position (0, 1, 2, 3)"""
        if ans is None:
            return None
        if isinstance(ans, int):
            return ans
        ans_str = str(ans).strip().lower()
        if ans_str in ['a', '0']: return 0
        if ans_str in ['b', '1']: return 1
        if ans_str in ['c', '2']: return 2
        if ans_str in ['d', '3']: return 3
        return None

    score = 0
    correct_responses = []
    bkt_logs = []

    logger.info(f"🧾 Scoring lesson {data.lesson} for {data.student_id} ({len(data.kc_ids)} KCs)")
    logger.info(f"   Student answers: {data.student_answers}")
    logger.info(f"   Correct answers: {data.correct_answers}")

    for i, (student_ans, correct_ans, kc_id) in enumerate(zip(data.student_answers, data.correct_answers, data.kc_ids)):
        norm_student = normalize_answer(student_ans)
        norm_correct = normalize_answer(correct_ans)
        is_correct = norm_student == norm_correct
        logger.info(f"   Q{i+1} (KC {kc_id}): student={student_ans}({norm_student}) vs correct={correct_ans}({norm_correct}) = {is_correct}")

        # Pre-update BKT params
        try:
            mastery_before = get_hybrid_mastery(data.student_id)
            kc_state_before = mastery_before.get("kc_states", {}).get(kc_id, {})
            p_l_before = kc_state_before.get("p_know", 0.0)
            p_g = kc_state_before.get("p_guess", 0.2)
            p_s = kc_state_before.get("p_slip", 0.1)
            p_t = mastery_before.get("p_transit", 0.1)
        except Exception:
            p_l_before = p_g = p_s = p_t = 0.0

        logger.info(f"   Q{i+1} PRE BKT (KC {kc_id}) -> P_l:{p_l_before:.4f} P_t:{p_t:.4f} P_g:{p_g:.4f} P_s:{p_s:.4f}")

        # Update
        try:
            update_student_hybrid_state(
                data.student_id,
                kc_id,
                is_correct,
                difficulty=5.0
            )
        except Exception as e:
            logger.warning(f"BKT update failed for KC {kc_id}: {e}")

        # Post-update
        try:
            mastery_after = get_hybrid_mastery(data.student_id)
            p_l_after = mastery_after.get("kc_states", {}).get(kc_id, {}).get("p_know", None)
        except Exception:
            p_l_after = None

        bkt_logs.append({
            "question_index": i + 1,
            "kc_id": kc_id,
            "pre": {"p_l": round(p_l_before, 4), "p_t": round(p_t, 4), "p_g": round(p_g, 4), "p_s": round(p_s, 4)},
            "post": {"p_l": round(p_l_after, 4) if p_l_after is not None else None}
        })

        score += int(is_correct)
        correct_responses.append(is_correct)

    total_questions = len(data.student_answers)
    score_percentage = (score / total_questions * 100) if total_questions > 0 else 0

    # Get updated mastery states for all KCs
    try:
        mastery = get_hybrid_mastery(data.student_id)
        kc_masteries = {}
        for kc_id in data.kc_ids:
            p_know = mastery.get("kc_states", {}).get(kc_id, {}).get("p_know", 0.0)
            kc_masteries[kc_id] = p_know
        avg_mastery = sum(kc_masteries.values()) / len(kc_masteries) if kc_masteries else 0.0
    except Exception:
        kc_masteries = {}
        avg_mastery = 0.0

    level = "Beginner" if avg_mastery < 0.35 else "Intermediate" if avg_mastery < 0.6 else "Advanced" if avg_mastery < 0.85 else "Expert"

    # Sample generation prompt for lesson overview
    # Use first KC topic if available
    first_kc = data.kc_ids[0] if data.kc_ids else None
    kc_info = GRADE_11_BUDDHISM_KCS.get(first_kc, {}) if first_kc else {}
    final_prompt = f"generate a lesson on lesson {data.lesson} and subtopic {kc_info.get('topic', '')} for a student in level {level}"
    logger.info(f"🔎 Final generation prompt: {final_prompt}")

    # Log interactions for all KCs
    for kc_id in data.kc_ids:
        log_interaction(data.student_id, kc_id, score > (total_questions // 2), grade=11)

    logger.info(f"✅ Final score for lesson {data.lesson}: {score}/{total_questions} ({score_percentage}%)")
    logger.info(f"📊 KC Masteries: {kc_masteries}")

    return {
        "student_id": data.student_id,
        "lesson": data.lesson,
        "score": score,
        "total_questions": total_questions,
        "score_percentage": round(score_percentage, 2),
        "correct_responses": correct_responses,
        "kc_masteries": {k: round(v, 3) for k, v in kc_masteries.items()},
        "average_mastery": round(avg_mastery, 3),
        "level": level,
        "bkt_feedback": f"📈 Lesson {data.lesson} completed! Average mastery: {round(avg_mastery*100)}%",
        "bkt_logs": bkt_logs,
        "generation_prompt": final_prompt
    }


@app.get("/grade-11/student-progress/")
def get_student_progress_grade_11(student_id: str):
    """Get student's progress across all Grade 11 Buddhism KCs"""
    try:
        mastery = get_hybrid_mastery(student_id)

        # compute overall mastery as average p_know across grade-11 KCs
        kc_states_mastery = []
        for kc_id in GRADE_11_BUDDHISM_KCS.keys():
            p = mastery.get("kc_states", {}).get(kc_id, {}).get("p_know", 0.0)
            kc_states_mastery.append(float(p))

        overall_mastery = sum(kc_states_mastery) / len(kc_states_mastery) if kc_states_mastery else 0.0

        progress = {
            "student_id": student_id,
            "overall_mastery": round(overall_mastery, 3),
            "kc_states": {}
        }

        for kc_id, kc_info in GRADE_11_BUDDHISM_KCS.items():
            kc_state = mastery.get("kc_states", {}).get(kc_id, {})
            p_know = kc_state.get("p_know", 0.0)
            progress["kc_states"][kc_id] = {
                "name": kc_info.get("name"),
                "lesson": kc_info.get("lesson"),
                "mastery_level": round(p_know, 3),
                "attempts": kc_state.get("num_attempts", 0),
                "status": "Mastered" if p_know > 0.85 else "In Progress" if p_know > 0.35 else "Starting"
            }

        return progress
    except Exception as e:
        logger.error(f"Error getting progress: {e}")
        return {"error": str(e), "student_id": student_id}

@app.post("/grade-11/init-quiz-bank/")
def init_grade_11_quiz_bank(csv_filepath: str = "data/grade_11_buddhism_quiz_bank.csv"):
    """Initialize Grade 11 Buddhism quiz bank (Admin only)"""
    try:
        # Initialize topics
        initialize_grade_11_buddhism_topics()
        
        # Ingest quiz bank
        count = ingest_grade_11_quiz_bank(csv_filepath)
        
        return {
            "status": "success",
            "message": f"Initialized Grade 11 Buddhism with {count} questions",
            "questions_loaded": count,
            "knowledge_components": len(GRADE_11_BUDDHISM_KCS)
        }
    except Exception as e:
        logger.error(f"Initialization error: {e}")
        raise HTTPException(status_code=500, detail=str(e))