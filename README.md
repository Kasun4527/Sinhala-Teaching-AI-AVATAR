# 🎓 Sinhala-Teaching-AI-AVATAR

An intelligent, adaptive AI-powered e-learning platform designed to teach Sinhala. This project leverages a state-of-the-art **Hybrid PC-BKT (Predictive Cognitive Bayesian Knowledge Tracing) + BKT-LSTM** engine to dynamically track student mastery, adapt content difficulty in real-time, and provide an unparalleled personalized learning experience.

---

## ✨ Key Features

### 🧠 Advanced Personalization Engine
- **Hybrid PC-BKT + LSTM Fusion**: Combines traditional mathematical probability (BKT) with deep learning sequence prediction (LSTM) to calculate a highly accurate "Hybrid Mastery" score for every student on every skill.
- **Real-Time Adaptation**: As students answer questions online, the system instantly evaluates their mastery, triggering adaptive signals (`hint_required`, `adapt_difficulty`) to dynamically serve easier or harder questions mid-quiz.
- **Cross-Lesson Knowledge Transfer**: Students don't start from scratch on every lesson. The system calculates a `transfer_L0` baseline using their historical mastery in related topics within the same subject.
- **Behavioral Clustering**: Uses Exponential Moving Average (EMA) K-Means clustering to profile students into behavioral groups (Fast Learner, Struggling, Careless). These profiles dynamically adjust the Bayesian priors (Learn Rate, Guess Rate, Slip Rate) to match the student's unique learning style.
- **IRT-Style Problem Difficulty**: Continuously recalculates the difficulty of individual questions based on global student success rates.

### 🤖 Multi-Agent AI System
Powered by **LangGraph** and **Groq**, the backend utilizes specialized agents to orchestrate the learning journey:
- **Personalization Agent**: The core orchestrator that evaluates quizzes, manages the BKT-LSTM pipeline, and triggers remediation.
- **Content Agent**: Generates highly contextual lesson content dynamically.
- **Quiz Agent**: Creates tailored quizzes and evaluates student answers.
- **Explain Agent**: Provides simplified, context-aware explanations when a student is stuck.

### 🗣️ Interactive AI Avatar
- Integrated Text-to-Speech (TTS) engine to generate realistic teacher speech (`/generate-tts/`) for a fully immersive avatar-driven experience.
- RAG-powered Q&A endpoint (`/ask-question`) for students to ask questions and receive context-aware Sinhala answers.

---

## 🛠️ Technology Stack

**Frontend**
- React.js / Vite
- Tailwind CSS

**Backend**
- Python / FastAPI
- MongoDB (via Azure CosmosDB compatibility)
- TensorFlow / Keras (For LSTM model)
- LangChain / LangGraph (For multi-agent orchestration)
- ChromaDB (Local Vector Store for RAG)
- Groq Cloud API (For LLM Inference)

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- Python 3.10+
- MongoDB instance (Local or Atlas)
- Groq API Key

### Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment (optional but recommended):
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows use: venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Set up your `.env` file in the `backend/` directory:
   ```env
   GROQ_API_KEY=your_groq_api_key_here
   MONGO_URI=your_mongodb_connection_string
   SECRET_KEY=your_jwt_secret_key
   ```
5. **(Critical)** Generate the LSTM Weights and Skill Map. The personalization engine requires the pre-trained neural network:
   ```bash
   python -m training.train_lstm
   ```
6. Start the FastAPI server:
   ```bash
   uvicorn main:app --reload
   ```
   The backend will be available at `http://127.0.0.1:8000`.

### Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   The frontend will be available at `http://localhost:3000`.

---

## 🏗️ Architecture Overview

The backend logic revolves around continuous evaluation and state persistence. The flow is as follows:
1. **Enrollment**: A student enrolls in a subject (e.g., Buddhism).
2. **Online Learning**: As the student interacts with a lesson or takes a quiz, their answers are sent to `/submit-answer/`.
3. **Evaluation**: The Personalization Agent calculates a raw BKT mastery score and queries the TensorFlow LSTM model for a sequential prediction.
4. **Fusion & Adaptation**: The scores are fused into `hybrid_mastery`. If the student is struggling, the system updates the difficulty curve and enables hints.
5. **Clustering**: Post-quiz, K-Means clustering re-evaluates the student's learning profile.

Detailed technical breakdowns can be found in the `personalization_report_0705.md` file.

---

## 📜 License
This project was developed as a Final Year Project (FYP). All rights reserved.