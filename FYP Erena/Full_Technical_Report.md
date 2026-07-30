# An AI-Driven Personalized Sinhala Teaching Assistant with Real-Time Student Engagement Detection for Secondary Education

## Full Technical Report — System Evolution & New Contributions

---

## Abstract

This report documents the complete technical evolution of the AI-driven Sinhala Teaching Assistant from its initial research prototype to a fully deployed, production-grade intelligent tutoring system. The original system integrated four core components: a curriculum-aligned Sinhala LLM (SinLlama-8B), a Hybrid Bayesian Knowledge Tracing (Hybrid-BKT) personalization engine, a Retrieval-Augmented Generation (RAG) pipeline, and a LangGraph-orchestrated multi-agent architecture. Since the original publication, the system has undergone significant architectural expansion, introducing five major new capabilities: (1) a real-time computer vision-based Student Engagement Detection Engine, (2) Whisper-based forced speech alignment for the AI Avatar, (3) YouTube video integration with watch-time analytics, (4) a comprehensive teacher analytics dashboard, and (5) full Docker containerization for cloud deployment. This report details each enhancement, the technical implementation decisions, and the resulting system architecture.

---

## I. Introduction

### 1.1 Background

Sri Lanka faces a shortage of more than 30,000 qualified teachers, with student-to-teacher ratios exceeding 50:1 in rural provinces. Only 63.3% of O/L candidates qualify for A/L studies, and a mere 15% of A/L candidates secure university admission. The original system was designed to address these educational disparities through an AI-based personalized tutoring platform operating natively in the Sinhala language.

### 1.2 Purpose of This Report

This report serves as a comprehensive changelog and technical reference documenting all modifications, additions, and architectural decisions made since the original IEEE conference paper submission. It is structured to clearly distinguish between **retained components** (unchanged from the original paper), **modified components** (existing features that were enhanced), and **new components** (entirely new subsystems added to the platform).

---

## II. System Architecture Overview

### 2.1 Original Architecture (4 Components)

The original system comprised four integrated components:

| # | Component | Technology | Purpose |
|---|-----------|------------|---------|
| 1 | Curriculum-Aligned LLM | SinLlama-8B + LoRA fine-tuning | Sinhala educational content generation |
| 2 | Hybrid-BKT Engine | PC-BKT + BKT-LSTM ensemble (α=0.665) | Adaptive mastery estimation |
| 3 | RAG Pipeline | ChromaDB + multilingual-e5-base | Curriculum-grounded content retrieval |
| 4 | Multi-Agent Orchestration | LangGraph StateGraph + 7 agents | Adaptive workflow management |

### 2.2 Expanded Architecture (Post-Update)

The system now comprises **six integrated layers** with **five new major capabilities**:

| # | Layer | Status | Description |
|---|-------|--------|-------------|
| 1 | User Interface Module | **Modified** | Three role-specific interfaces (student, teacher, parent) across web and mobile |
| 2 | REST API Gateway | **Modified** | FastAPI with expanded endpoints for engagement, YouTube, and analytics |
| 3 | Multi-Agent AI Layer | **Modified** | LangGraph with new Align Agent added |
| 4 | RAG-Based Knowledge Engine | **Retained** | ChromaDB + multilingual-e5-base (unchanged) |
| 5 | Hybrid-BKT Personalization Engine | **Retained** | PC-BKT + BKT-LSTM ensemble (unchanged) |
| 6 | Persistent Data Layer | **Modified** | MongoDB with new collections for engagement and YouTube data |

Additionally, a **completely new standalone microservice** was introduced:

| # | New Component | Technology | Purpose |
|---|---------------|------------|---------|
| 7 | Student Engagement Detection Engine | Flask + PyTorch + YOLOv8 + MediaPipe | Real-time webcam-based engagement monitoring |

---

## III. Retained Components (Unchanged)

The following core components remain unchanged from the original paper and continue to function as originally described.

### 3.1 Curriculum-Aligned LLM (SinLlama-8B)

- **Architecture**: SinLlama-8B fine-tuned using Low-Rank Adaptation (LoRA/QLoRA)
- **Training Data**: 3,547 Buddhism curriculum QA pairs synthetically generated from national syllabus materials
- **Evaluation Results** (unchanged):

| Model | ROUGE-1 | ROUGE-2 | ROUGE-L | BERTScore | Judge Score (/20) |
|-------|---------|---------|---------|-----------|-------------------|
| **SinLlama-8B** | **0.7714** | **0.6418** | **0.6111** | **0.9424** | **15.88** |
| Mistral-7B | 0.4925 | 0.2280 | 0.1594 | 0.8555 | 14.97 |
| Llama-3.1-8B | 0.3983 | 0.1949 | 0.1418 | 0.8799 | 13.59 |
| DeepSeek-14B | 0.4485 | 0.2304 | 0.1845 | 0.8659 | 13.58 |
| Qwen-14B | 0.3310 | 0.1678 | 0.1059 | 0.8022 | 11.75 |

### 3.2 RAG Pipeline

- **Embedding Model**: intfloat/multilingual-e5-base (768-dimensional vectors)
- **Vector Store**: ChromaDB (local, persistent)
- **Chunking Strategy**: 512 tokens with 64-token overlap
- **Retrieval Modes**: Document-order (lesson content) and vector-similarity (quiz generation)
- **Status**: Fully retained with no architectural changes

### 3.3 Hybrid-BKT Personalization Engine

- **Ensemble Formula**: P_hybrid(t) = 0.665 × P_PC-BKT(t) + 0.335 × P_LSTM(t)
- **Feedback Correction Threshold**: δ = 0.20
- **Evaluation Results** (unchanged):

| Metric | Standard BKT | BKT-LSTM | Hybrid-BKT |
|--------|-------------|----------|------------|
| AUC | 0.60 | 0.59 | **0.60** |
| Accuracy | 48.1% | 54.7% | **56.2%** |
| RMSE | 0.51 | 0.53 | **0.49** |

### 3.4 Adaptive Assessment Cycle

The four-phase learning cycle remains unchanged:
1. **Phase 1 (Pre-Assessment)**: Dynamically generated pre-quiz aligned to Bloom's taxonomy
2. **Phase 2 (Adaptive Content Generation)**: Three mastery tiers (Beginner < 0.60, Intermediate 0.60–0.85, Advanced ≥ 0.85)
3. **Phase 3 (Post-Assessment)**: Updated mastery measurement with advancement/repetition/remediation decisions
4. **Phase 4 (Continuous Adaptation)**: Ongoing capability matrix updates and periodic cluster retraining

---

## IV. Modified Components (Enhanced)

### 4.1 Multi-Agent Architecture — New Align Agent

**What Changed**: A new **Align Agent** was added to the existing 7-agent LangGraph architecture, bringing the total to 8 specialized agents.

**Original Agents** (retained):
1. Orchestrator Node — entry point, conditional routing
2. Evaluator Agent — quiz grading, mastery classification
3. Personalisation Agent — Hybrid-BKT pipeline execution
4. Content Generator Agent — RAG-powered lesson generation
5. Quiz Agent — dynamic MCQ generation in Sinhala
6. Explain Agent — simplified re-explanations for Avatar TTS
7. Progress Tracker Agent — persistent interaction logging

**New Agent**:

8. **Align Agent** (`align_agent.py`) — Whisper-based forced alignment for Avatar speech synchronization

**Technical Details**:
- Uses `faster-whisper` (base model, CPU, int8 quantization) for word-level timestamp extraction
- Language: Sinhala (`si`)
- Beam size: 1 (optimized for speed)
- VAD filter enabled to skip silence regions
- Two-function pipeline:
  - `get_word_timestamps(wav_bytes)` → extracts word-level timestamps from WAV audio
  - `words_to_sentence_segments(text, words)` → maps word timestamps onto sentence boundaries from the original text
- Handles image tag stripping (`[IMAGE:...]` placeholders) before text splitting
- Supports Sinhala sentence-ending punctuation (`.`, `!`, `?`, `।`, `෴`)
- Fallback: character-ratio estimation when Whisper returns no words

### 4.2 Interactive AI Avatar — Enhanced with Speech Alignment

**What Changed**: The Avatar pipeline was enhanced from a basic TTS playback to a fully synchronized text-highlighting experience.

**Original Implementation**:
- Explain Agent → SinLlama simplified text → Gemini TTS → WebRTC → 3D Avatar playback

**New Implementation**:
- Explain Agent → SinLlama simplified text → Gemini TTS (24 kHz) → **Whisper Forced Alignment** → WebRTC → 3D Avatar with **synchronized sentence highlighting**
- The frontend now receives sentence-level timestamps and highlights the corresponding text in real time as the avatar speaks
- Multiple selectable avatar identities are supported via the `AvatarSelector.js` component

### 4.3 User Interface — Expanded Frontend

**What Changed**: Significant UI enhancements across multiple pages.

**New Frontend Components**:

| Component | File | Purpose |
|-----------|------|---------|
| YouTubePanel | `YouTubePanel.js` | In-lesson YouTube video search, playback, and watch-time tracking |
| AvatarSelector | `AvatarSelector.js` | Multiple selectable 3D avatar teacher identities |
| Avatar3DCanvas | `Avatar3DCanvas.js` | Enhanced 3D rendering canvas for the avatar |
| HexPattern | `HexPattern.js` | Visual pattern component for UI aesthetics |

**Modified Frontend Pages**:

| Page | Changes |
|------|---------|
| `lesson/page.js` | Added engagement engine integration, YouTube panel, enhanced avatar interaction |
| `admin/dashboard/page.js` | Complete overhaul with per-student analytics, mastery visualization, engagement histories |
| `api/generate-tts/route.js` | Enhanced TTS pipeline with forced alignment support |

### 4.4 REST API Gateway — New Endpoints

**What Changed**: The FastAPI backend was expanded with new endpoint categories.

**New API Endpoints**:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/youtube/search` | GET | Search YouTube Data API v3 for educational videos |
| `/youtube-log` | POST | Log student YouTube watch sessions (video ID, title, watched seconds, timestamp) |
| `/admin/youtube-history` | GET | Retrieve YouTube watch history for a specific student/subject/topic |
| `/generate-tts` | POST | Enhanced with forced alignment timestamp data |

**New Database Collections** (MongoDB):

| Collection | Purpose |
|------------|---------|
| `youtube_watch_sessions` | Stores per-student YouTube watch history with timestamps |
| `engagement_sessions` | Stores engagement detection session data |

### 4.5 Deployment Infrastructure — Docker Containerization

**What Changed**: The system moved from manual local deployment to a fully containerized architecture.

**Docker Compose Configuration** (`docker-compose.yml`):

| Service | Port | Base Image | Purpose |
|---------|------|------------|---------|
| `backend` | 8000 | Python | FastAPI server with all agents, RAG, BKT |
| `frontend` | 3000 | Node.js | Next.js web application |
| `engagement_engine` | 5000 | Python | Flask-based CV engagement microservice |

**Key Design Decisions**:
- Environment variables are injected via `.env` file (gitignored)
- Frontend build args (`NEXT_PUBLIC_BACKEND_URL`, `NEXT_PUBLIC_ENGAGEMENT_URL`) are baked at build time
- All services restart automatically (`unless-stopped` policy)
- The frontend `depends_on` both backend and engagement engine

---

## V. New Components (Added)

### 5.1 Student Engagement Detection Engine

**This is the single largest new addition to the system** — a completely standalone microservice that did not exist in the original paper.

#### 5.1.1 Architecture

The Engagement Engine is a Flask-based Python microservice that processes webcam video frames sent from the frontend as base64-encoded JPEG images. It runs as an independent service on port 5000, completely decoupled from the main FastAPI backend.

#### 5.1.2 Sub-Modules

The engine comprises six specialized computer vision modules:

**Module 1: Face Detector** (`face_detector.py`)
- Uses MediaPipe Face Mesh to extract 468 facial landmarks from each frame
- Provides the foundational landmark data consumed by all downstream modules
- Returns both landmarks and face bounding box coordinates

**Module 2: Emotion Recognition** (`emotion.py`)
- Custom 7-class Convolutional Neural Network (CNN) trained on facial expression data
- Architecture: 3 convolutional blocks (32→64→128 filters), each with Conv2d → BatchNorm → ReLU → MaxPool → Dropout, followed by a fully connected classifier (128×6×6 → 256 → 7)
- Input: 48×48 grayscale face ROI
- Output: emotion label + confidence score
- Classes: angry, disgust, fear, happy, neutral, sad, surprise
- Pre-trained weights loaded from `models/emotion_model_best.pt`

**Module 3: Drowsiness Detection** (`drowsiness.py`)
- Computes Eye Aspect Ratio (EAR) from facial landmarks to detect eye closure
- Computes Mouth Aspect Ratio (MAR) from facial landmarks to detect yawning
- Implements temporal debouncing via frame counters (`closed_counter`, `yawn_counter`) to avoid false positives from natural blinks
- Per-session state isolation: each student session gets its own `DrowsinessDetector` instance to maintain accurate counters

**Module 4: Head Pose Estimation** (`head_pose.py`)
- Estimates 3D head orientation (pitch, yaw, roll) from facial landmarks
- Classifies gaze direction (Forward, Left, Right, Up, Down)
- Detects "looking away" state indicating off-screen attention

**Module 5: Behavior Detection** (`behavior_detector.py`)
- Uses YOLOv8 nano model (`yolov8n.pt`) for real-time object detection
- Detects two critical objects:
  - **Phone/cell phone** (COCO class 67) — indicates distraction
  - **Person** (COCO class 0) — verifies student presence at desk
- Returns boolean flags: `phone_detected`, `person_present`

**Module 6: Engagement Engine** (`engagement_engine.py`)
- Fuses all sub-module outputs into a single 0–100 engagement score using a weighted formula:

| Signal | Weight | Scoring Logic |
|--------|--------|---------------|
| Emotion | 0.25 | happy=1.0, neutral=0.7, surprise=0.6, sad=0.3, fear/angry=0.2, disgust=0.1 |
| Eye (EAR) | 0.25 | EAR < 0.20 → 0.0, EAR < 0.25 → 0.4, else → 1.0 |
| Mouth (MAR) | 0.15 | MAR > 0.6 → 0.0 (yawning), else → 1.0 |
| Head Pose | 0.20 | Looking away → 0.3, else → 1.0 |
| Behavior | 0.15 | YOLOv8-based phone/presence score |

- **Final Classification**:

| Score Range | State Label |
|-------------|-------------|
| > 75 | Highly Engaged 😊 |
| > 50 | Moderately Engaged 😐 |
| > 30 | Low Engagement 😴 |
| ≤ 30 | Not Engaged ⚠️ |

#### 5.1.3 API Interface

| Endpoint | Method | Input | Output |
|----------|--------|-------|--------|
| `/api/health` | GET | — | `{"status": "ok"}` |
| `/api/frame` | POST | `{session_id, frame_b64}` | `{current: {state, score, emotion, ear, mar, drowsy, yawning, head_direction, phone_detected, looking_away, person_present}}` |

#### 5.1.4 Testing

The engagement engine includes 7 dedicated test files covering each sub-module independently:
- `test_face.py` — face detection validation
- `test_emotion.py` — emotion classification accuracy
- `test_drowsiness.py` — EAR/MAR threshold testing
- `test_head_pose.py` — gaze direction validation
- `test_behavior.py` — YOLOv8 phone detection testing
- `test_yawn.py` — yawn detection testing
- `test_engagement.py` — full pipeline integration testing

### 5.2 YouTube Video Integration

**Purpose**: Provides supplementary educational content through curriculum-relevant YouTube videos, searchable and viewable directly within the lesson interface.

**Architecture**:
- **Backend**: YouTube Data API v3 integration via `/youtube/search` endpoint
- **Frontend**: `YouTubePanel.js` component with embedded YouTube IFrame Player API
- **Analytics**: Per-student watch-time logging to MongoDB (`youtube_watch_sessions` collection)
- **Data Captured**: student_id, subject, lesson, topic, video_id, video_title, video_url, watched_seconds, started_at
- **Teacher Dashboard**: Watch history visible to teachers via `/admin/youtube-history` endpoint

### 5.3 Teacher Analytics Dashboard

**Purpose**: Comprehensive administrative interface for teachers to monitor student progress, mastery levels, and engagement.

**Features** (`admin/dashboard/page.js`):
- Per-student quiz performance trend visualization
- Topic-wise mastery level breakdown
- Lesson completion percentage tracking
- Engagement session history viewing
- YouTube watch history per student/subject/topic
- Improvement summary analytics

**Backend Support** (`dashboard_agent.py`):
- `get_all_students()` — retrieve enrolled student list
- `get_student_subjects()` — per-student subject enrollment
- `get_lesson_progress()` — lesson-level completion data
- `get_topic_details()` — topic-level mastery breakdown
- `get_improvement_summary()` — pre-quiz vs post-quiz improvement metrics

---

## VI. Technology Stack Summary

### 6.1 Complete Technology Stack (Current)

| Layer | Technology | Version/Details |
|-------|-----------|-----------------|
| **Frontend** | Next.js | React-based SSR web application |
| **Mobile** | React Native / Expo | Cross-platform mobile application |
| **Backend** | Python FastAPI | REST API with async support |
| **Agent Framework** | LangGraph (LangChain) | Stateful multi-agent orchestration |
| **LLM Inference** | Groq Cloud API | Llama-3.3-70B for agent orchestration |
| **Sinhala LLM** | SinLlama-8B | Fine-tuned via LoRA, self-hosted |
| **Vector Database** | ChromaDB | Local persistent vector store |
| **Embedding Model** | multilingual-e5-base | 768-dimensional sentence embeddings |
| **Database** | MongoDB | User profiles, progress, interactions |
| **TTS** | Google Gemini TTS | gemini-2.5-flash-preview-tts, 24 kHz |
| **Speech Alignment** | faster-whisper | Base model, CPU, int8, Sinhala |
| **3D Avatar** | Three.js + WebRTC | Lip-synced avatar with FBX animations |
| **Emotion Recognition** | PyTorch CNN | Custom 7-class model (48×48 grayscale) |
| **Object Detection** | YOLOv8 nano | Phone detection + person presence |
| **Face Analysis** | MediaPipe Face Mesh | 468-point facial landmark extraction |
| **Containerization** | Docker Compose | 3-service orchestration |
| **Video Integration** | YouTube Data API v3 | Search + IFrame Player |
| **Authentication** | JWT (python-jose) | Role-based access control |
| **Email** | Gmail SMTP + Brevo | Verification and notifications |

### 6.2 External API Dependencies

| API | Purpose | Environment Variable |
|-----|---------|---------------------|
| Groq Cloud | LLM inference (Llama-3.3-70B) | `GROQ_API_KEY` |
| Google Gemini | TTS speech synthesis | `GEMINI_API_KEY` / `GOOGLE_API_KEY` |
| YouTube Data API v3 | Video search | `YOUTUBE_API_KEY` |
| MongoDB Atlas | Cloud database | `MONGODB_URI` |
| Brevo | Transactional email | `BREVO_API_KEY` |

---

## VII. Summary of All Changes

### 7.1 Change Classification Matrix

| Component | Status | Category | Impact |
|-----------|--------|----------|--------|
| SinLlama-8B LLM | ✅ Retained | Core AI | No change |
| Hybrid-BKT Engine | ✅ Retained | Core AI | No change |
| RAG Pipeline (ChromaDB) | ✅ Retained | Core AI | No change |
| Adaptive Assessment Cycle | ✅ Retained | Core Logic | No change |
| Multi-Agent Architecture | 🔄 Modified | Core AI | +1 new agent (Align Agent) |
| AI Avatar Teacher | 🔄 Modified | UX | +Whisper alignment, +avatar selection |
| Frontend UI | 🔄 Modified | UX | +YouTube panel, +dashboard, +engagement UI |
| REST API Gateway | 🔄 Modified | Infrastructure | +YouTube, +analytics endpoints |
| MongoDB Schema | 🔄 Modified | Data | +2 new collections |
| Engagement Detection Engine | 🆕 New | Core AI | Entirely new microservice |
| YouTube Integration | 🆕 New | Feature | Search, playback, analytics |
| Teacher Dashboard | 🆕 New | Feature | Student analytics visualization |
| Docker Deployment | 🆕 New | Infrastructure | 3-service containerization |
| Whisper Speech Alignment | 🆕 New | Core AI | Word-level timestamp extraction |

### 7.2 File-Level Changes

**New Files Added** (key files only):

| File | Purpose |
|------|---------|
| `engagement_engine/app.py` | Engagement microservice entry point |
| `engagement_engine/modules/emotion.py` | Custom CNN emotion recognizer |
| `engagement_engine/modules/drowsiness.py` | EAR/MAR drowsiness detector |
| `engagement_engine/modules/head_pose.py` | Head orientation estimator |
| `engagement_engine/modules/face_detector.py` | MediaPipe face landmark extractor |
| `engagement_engine/modules/behavior_detector.py` | YOLOv8 phone/person detector |
| `engagement_engine/modules/engagement_engine.py` | Weighted fusion scoring engine |
| `engagement_engine/models/emotion_model_best.pt` | Pre-trained emotion CNN weights |
| `engagement_engine/models/best.pt` | YOLOv8 trained weights |
| `backend/agents/align_agent.py` | Whisper forced alignment agent |
| `frontend/components/YouTubePanel.js` | YouTube search and playback UI |
| `docker-compose.yml` | Docker service orchestration |
| `backend/Dockerfile` | Backend container definition |
| `frontend/Dockerfile` | Frontend container definition |
| `engagement_engine/Dockerfile` | Engagement engine container definition |
| `.env.example` | Environment variable template |

---

## VIII. Conclusion

The AI-driven Sinhala Teaching Assistant has evolved from a research prototype with four core AI components into a comprehensive, production-deployed intelligent tutoring platform. The five major additions — real-time engagement detection, Whisper-based speech alignment, YouTube integration, teacher analytics, and Docker containerization — collectively transform the system from an academic proof-of-concept into a deployable educational product. The engagement detection engine, in particular, represents a significant novel contribution, providing real-time computer vision-based monitoring of student attentiveness through emotion recognition, drowsiness detection, head pose estimation, and phone usage detection — capabilities that were entirely absent from the original system design.

To the best of our knowledge, no existing system simultaneously integrates curriculum-aligned language models, hybrid knowledge tracing, RAG-based content grounding, multi-agent orchestration, and real-time computer vision-based engagement detection within a unified framework for low-resource language secondary education.

---

*Report generated: July 2026*
*Project: Sinhala-Teaching-AI-AVATAR — Final Year Project*
