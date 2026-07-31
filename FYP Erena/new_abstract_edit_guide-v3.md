# New Abstract Edit Guide — V3

### Based on Full Deep-Dive of Current Codebase (30 July 2026)

> This guide was produced after reading every agent, service, and module in the project. Every claim is cross-referenced against the actual source code.

---

## 🔍 Deep-Dive Feature Inventory

Before editing the abstract, here is a verified inventory of **everything the system actually does** based on the code:

### Backend Agents (LangGraph Nodes)
| Agent | File | Role |
|---|---|---|
| Orchestrator | [supervisor.py](file:///c:/Users/some1/Downloads/FYP_main_project/Sinhala-Teaching-AI-AVATAR/backend/agents/supervisor.py) | Entry point, conditional router |
| Evaluator | [supervisor.py](file:///c:/Users/some1/Downloads/FYP_main_project/Sinhala-Teaching-AI-AVATAR/backend/agents/supervisor.py#L107) | Grades quiz answers |
| Personalization | [personalization_agent.py](file:///c:/Users/some1/Downloads/FYP_main_project/Sinhala-Teaching-AI-AVATAR/backend/agents/personalization_agent.py) | Hybrid BKT+LSTM mastery |
| Content Generator | [content_agent.py](file:///c:/Users/some1/Downloads/FYP_main_project/Sinhala-Teaching-AI-AVATAR/backend/agents/content_agent.py) | RAG-grounded lesson generation |
| Quiz Agent | [quiz_agent.py](file:///c:/Users/some1/Downloads/FYP_main_project/Sinhala-Teaching-AI-AVATAR/backend/agents/quiz_agent.py) | Dynamic assessment generation |
| Progress Tracker | [progress_agent.py](file:///c:/Users/some1/Downloads/FYP_main_project/Sinhala-Teaching-AI-AVATAR/backend/agents/progress_agent.py) | Saves quiz/lesson progress to MongoDB |
| Dashboard Agent | [dashboard_agent.py](file:///c:/Users/some1/Downloads/FYP_main_project/Sinhala-Teaching-AI-AVATAR/backend/agents/dashboard_agent.py) | Aggregates analytics |

**Count: 7 agents. The abstract must say "seven" — this is correct in V2.**

### Backend Services (NOT LangGraph nodes)
| Service | File | Role |
|---|---|---|
| BKT Service | [bkt_service.py](file:///c:/Users/some1/Downloads/FYP_main_project/Sinhala-Teaching-AI-AVATAR/backend/services/bkt_service.py) | PC-BKT EP fitting + state tracking |
| LSTM Service | [lstm_service.py](file:///c:/Users/some1/Downloads/FYP_main_project/Sinhala-Teaching-AI-AVATAR/backend/services/lstm_service.py) | **Single-layer LSTM (200 units)** |
| Clustering Service | [clustering_service.py](file:///c:/Users/some1/Downloads/FYP_main_project/Sinhala-Teaching-AI-AVATAR/backend/services/clustering_service.py) | K-Means (K=3) with EMA smoothing |
| Difficulty Service | [difficulty_service.py](file:///c:/Users/some1/Downloads/FYP_main_project/Sinhala-Teaching-AI-AVATAR/backend/services/difficulty_service.py) | Item response tracking |
| Vector Store | [vector_store.py](file:///c:/Users/some1/Downloads/FYP_main_project/Sinhala-Teaching-AI-AVATAR/backend/services/vector_store.py) | ChromaDB + multilingual-e5-base |
| Retriever | [retriever.py](file:///c:/Users/some1/Downloads/FYP_main_project/Sinhala-Teaching-AI-AVATAR/backend/services/retriever.py) | Document-order + vector-similarity retrieval |
| TTS Agent | [tts_agent.py](file:///c:/Users/some1/Downloads/FYP_main_project/Sinhala-Teaching-AI-AVATAR/backend/agents/tts_agent.py) | Google Gemini 2.5 Flash TTS |
| Align Agent | [align_agent.py](file:///c:/Users/some1/Downloads/FYP_main_project/Sinhala-Teaching-AI-AVATAR/backend/agents/align_agent.py) | faster-whisper forced alignment |
| Email Service | [email_service.py](file:///c:/Users/some1/Downloads/FYP_main_project/Sinhala-Teaching-AI-AVATAR/backend/services/email_service.py) | Brevo API email verification |
| Admin Ingest | [admin_ingest.py](file:///c:/Users/some1/Downloads/FYP_main_project/Sinhala-Teaching-AI-AVATAR/backend/admin_ingest.py) | REST API bridge for admin portal |

### Engagement Engine (Separate Microservice)
| Module | File | Purpose |
|---|---|---|
| Face Detector | `modules/face_detector.py` | MediaPipe face landmarks |
| Emotion Recognizer | `modules/emotion.py` | Custom CNN emotion classification |
| Drowsiness Detector | `modules/drowsiness.py` | EAR + MAR thresholds |
| Head Pose Estimator | `modules/head_pose.py` | Pitch/yaw/roll head direction |
| Behavior Detector | `modules/behavior_detector.py` | **YOLOv8 (custom `best.pt`) phone+person detection** |
| Engagement Engine | `modules/engagement_engine.py` | Weighted fusion → 4-level classification |

> [!IMPORTANT]
> The behavior detector uses a **custom-trained YOLOv8 model** (`best.pt`), NOT standard YOLOv8n pre-trained weights. The abstract says "YOLOv8-based" which is acceptable, but you could mention it's a custom-trained model for more precision.

### Admin Portal (Separate FastAPI Service)
| Component | File | Purpose |
|---|---|---|
| Pipeline | `admin_portal/app/pipeline.py` (934 lines!) | PDF → text extraction with PyMuPDF |
| Text Cleaner | `admin_portal/app/text_cleaner.py` | Sinhala OCR artefact removal |
| Page Detector | `admin_portal/app/page_detector.py` | Skip TOC/index/blank pages |
| REST Bridge | `admin_portal/app/main.py` L737-769 | POST zip to backend `/api/admin/ingest` |

### Endpoints Confirming New Features
| Feature | Endpoint | Evidence |
|---|---|---|
| Per-answer online BKT | `POST /submit-answer/` | [main.py L306-351](file:///c:/Users/some1/Downloads/FYP_main_project/Sinhala-Teaching-AI-AVATAR/backend/main.py#L306-L351) |
| Student Q&A chatbot | `POST /ask-question` | [main.py L711-765](file:///c:/Users/some1/Downloads/FYP_main_project/Sinhala-Teaching-AI-AVATAR/backend/main.py#L711-L765) |
| YouTube search | `GET /youtube/search` | [main.py L777-803](file:///c:/Users/some1/Downloads/FYP_main_project/Sinhala-Teaching-AI-AVATAR/backend/main.py#L777-L803) |
| YouTube watch log | `POST /youtube-log` | [main.py L817-820](file:///c:/Users/some1/Downloads/FYP_main_project/Sinhala-Teaching-AI-AVATAR/backend/main.py#L817-L820) |
| Engagement logging | `POST /engagement-log` | [main.py L684-688](file:///c:/Users/some1/Downloads/FYP_main_project/Sinhala-Teaching-AI-AVATAR/backend/main.py#L684-L688) |
| Admin content ingest | `POST /api/admin/ingest` | [admin_ingest.py](file:///c:/Users/some1/Downloads/FYP_main_project/Sinhala-Teaching-AI-AVATAR/backend/admin_ingest.py) |
| Email verification | `POST /auth/signup` + `GET /auth/verify-email` | [main.py L389-425](file:///c:/Users/some1/Downloads/FYP_main_project/Sinhala-Teaching-AI-AVATAR/backend/main.py#L389-L425) |

---

## 🔴 CRITICAL ISSUES (Must Fix Before Submission)

### Issue 1 — Abstract Spills Beyond One Page
The abstract must fit on **one single page**. Currently it overflows because the second column repeats the avatar WebRTC architecture in ~200 words that were already covered in the first column. This duplication must be deleted entirely — that alone should reclaim enough space to fit on a single page AND accommodate the new features below.

### Issue 2 — "two-layer stacked LSTM" is FACTUALLY WRONG
**Code evidence**: [lstm_service.py L64-72](file:///c:/Users/some1/Downloads/FYP_main_project/Sinhala-Teaching-AI-AVATAR/backend/services/lstm_service.py#L64-L72) shows:
```python
model = tf.keras.Sequential([
    tf.keras.layers.Input(shape=(1, 15)),
    tf.keras.layers.LSTM(200, return_sequences=False, dropout=0.3),
    tf.keras.layers.Dense(1, activation="sigmoid")
])
```
This is **ONE LSTM layer** (200 hidden units, dropout=0.3) followed by a Dense output. NOT two-layer stacked.

> [!CAUTION]
> **FIX**: Change "two-layer stacked LSTM" → "single-layer LSTM with 200 hidden units"

### Issue 3 — "this work present introduces" — double verb
Line in V2 PDF: *"this work present introduces an Artificial Intelligence (AI) driven..."*
**FIX**: → "this work introduces"

### Issue 4 — "two Next.js web applications" is WRONG
The student/teacher app is Next.js. The admin portal is **FastAPI + vanilla HTML** ([admin_portal/app/index.html](file:///c:/Users/some1/Downloads/FYP_main_project/Sinhala-Teaching-AI-AVATAR/admin_portal/app/index.html) — 85 KB of pure HTML/JS).
**FIX**: → "a Next.js web application for students and teachers, and a separate administrative portal"

### Issue 5 — α = 0.665 is unexplained
The abstract says "optimal mastery prediction at α = 0.665" but never defines α. The actual code uses:
- `BKT_WEIGHT = 0.7` and `LSTM_WEIGHT = 0.3` in [personalization_agent.py L46-47](file:///c:/Users/some1/Downloads/FYP_main_project/Sinhala-Teaching-AI-AVATAR/backend/agents/personalization_agent.py#L46-L47)
- Divergence threshold δ = 0.20 at [L50](file:///c:/Users/some1/Downloads/FYP_main_project/Sinhala-Teaching-AI-AVATAR/backend/agents/personalization_agent.py#L50)

**FIX**: Either define α explicitly or replace with "weighted ensemble fusion (BKT: 0.70, LSTM: 0.30)"

---

## ➕ MISSING FEATURES (Implemented in Code but Not in Abstract)

### 1. Admin Portal with Automated Textbook Digitization Pipeline
- **What**: A complete FastAPI service with PDF extraction (PyMuPDF), Sinhala OCR text cleaning, page-type detection, topic segmentation, and image extraction
- **How it connects**: Packages `.txt` + images into a `.zip` → POSTs to backend `/api/admin/ingest` via REST → backend unpacks, saves to `documents_unicode/` and `images/`, triggers ChromaDB re-ingestion
- **Code**: [admin_portal/app/pipeline.py](file:///c:/Users/some1/Downloads/FYP_main_project/Sinhala-Teaching-AI-AVATAR/admin_portal/app/pipeline.py) (934 lines), [admin_ingest.py](file:///c:/Users/some1/Downloads/FYP_main_project/Sinhala-Teaching-AI-AVATAR/backend/admin_ingest.py)
- **Suggested sentence**: *"An administrative portal with an automated textbook digitization pipeline extracts, chunks, and publishes national curriculum content to the learning backend via a secured REST API bridge."*

### 2. Per-Answer Online BKT Learning
- **What**: Real-time mastery update after every individual quiz answer (not just end-of-quiz)
- **Code**: [main.py `/submit-answer/`](file:///c:/Users/some1/Downloads/FYP_main_project/Sinhala-Teaching-AI-AVATAR/backend/main.py#L306-L351) → `personalize_single_answer()` → `bkt_service.process_single_answer()`
- **Suggested sentence**: *"The engine supports real-time per-answer mastery updates enabling adaptive difficulty adjustment within a single quiz session."*

### 3. Student Q&A Chatbot (RAG-Powered)
- **What**: Students type questions in Sinhala → system retrieves context via topic-scoped document matching + vector-similarity search → sends to fine-tuned SinLlama for answer generation
- **Code**: [main.py `/ask-question`](file:///c:/Users/some1/Downloads/FYP_main_project/Sinhala-Teaching-AI-AVATAR/backend/main.py#L711-L765) → `retriever.get_relevant_context()` + `retriever.search_by_question()`
- **Suggested sentence**: *"A RAG-powered Sinhala Q&A chatbot enables students to ask curriculum-scoped questions with context retrieved via topic-based and vector-similarity search."*

### 4. YouTube Video Integration with Watch-History Logging
- **What**: Backend searches YouTube Education API (category 27, safe search) and logs student watch sessions
- **Code**: [main.py `/youtube/search`](file:///c:/Users/some1/Downloads/FYP_main_project/Sinhala-Teaching-AI-AVATAR/backend/main.py#L777-L803) + `/youtube-log`
- **Suggested sentence**: *"Supplementary educational video resources are provided through integrated YouTube search with watch-history logging."*

---

## ✂️ LINE-BY-LINE EDIT INSTRUCTIONS

### PARAGRAPH 1 — Introduction & Problem Statement

| # | Current Text | Action | Reason |
|---|---|---|---|
| 1 | "this work present introduces" | **CHANGE** → "this work introduces" | Double verb — grammar error |
| 2 | "that operates natively in the Sinhala language" | **KEEP or SHORTEN** | Could shorten to save space if needed, but acceptable to keep since you have a full page |
| 3 | "strictly adheres to the national syllabus, dynamically adapts..." | **KEEP** | Accurate |
| 4 | "continuously monitors real-time learner engagement through advanced computer vision techniques" | **KEEP** | Verified in engagement engine code |

---

### PARAGRAPH 2 — System Architecture Overview (Component List)

| # | Current Text | Action | Reason |
|---|---|---|---|
| 1 | "(i) a curriculum aligned Sinhala LLM (SinLlama-8B)" | **KEEP** | Correct |
| 2 | "(ii) a Hybrid-BKT personalization engine" | **KEEP** | Correct |
| 3 | "(iii) a RAG pipeline using ChromaDB" | **KEEP** | Correct |
| 4 | "(iv) a LangGraph orchestrated multi agent architecture coordinating seven specialized agents" | **KEEP** | Correct — 7 agents verified |
| 5 | Agent list: "Orchestrator, Content Agent, Quiz Agent, Personalization Agent, Progress Tracker Agent, Dashboard Agent, Explain Agent" | **CHANGE** | Explain Agent is not a LangGraph node in `supervisor.py`. The 7th agent in the graph is the **Evaluator** (see `evaluator_node` at supervisor.py L107). Replace "Explain Agent" with "Evaluator Agent" |
| 6 | "(v) Student Engagement Detection Engine" | **KEEP** | Correct — separate microservice |
| 7 | "(vi) a 3D avatar teacher" | **KEEP** but shorten description | Remove "for delivers" → "that delivers" |
| 8 | "(vii) an administrative portal for lesson management with automated text extraction pipeline" | **EXPAND** | → "an administrative portal with an automated textbook digitization pipeline that extracts and publishes national curriculum content to the learning backend via a REST API bridge" |
| 9 | "a mobile app for parents" | **KEEP** but separate from item (vii) | |

> [!WARNING]
> The current V2 agent list includes "Explain Agent" but the `explain_agent.py` is called directly from the `/explain-content/` route in `main.py` — it is **NOT a node** in the LangGraph supervisor pipeline. The actual 7 LangGraph nodes are: Orchestrator, Evaluate, Personalize, Generate Content, Track Progress, Decide, Dashboard (called via routes). If you want to keep "Explain Agent" in the list, that's fine for the abstract — but technically the 7th LangGraph graph node is the **Decision Node** (decide_node at supervisor.py L201).

---

### PARAGRAPH 3 — SinLlama-8B Fine-Tuning

| # | Current Text | Action | Reason |
|---|---|---|---|
| 1 | "five Sinhala supporting LLMs were fine-tuned using LoRA" | **KEEP** | Verified |
| 2 | "ROUGE-1 score of 0.7714" | **KEEP** | Verified experimental result |
| 3 | "BERTScore of 0.9424" | **KEEP** | Verified |
| 4 | "LLM-as-a-Judge score of 15.88/20" | **KEEP** | Verified |
| 5 | Comparison models: "Qwen-14B, Llama-3.1-8B, DeepSeek-14B, and Mistral-7B" | **KEEP** | Verified |

✅ **This paragraph is the most accurate. No major changes needed.**

---

### PARAGRAPH 4 — Hybrid-BKT Personalization Engine

| # | Current Text | Action | Reason |
|---|---|---|---|
| 1 | "weighted ensemble combining PC-BKT and LSTM-BKT" | **KEEP** but add weights | → "weighted ensemble (BKT: 0.70, LSTM: 0.30) combining PC-BKT and BKT-LSTM" |
| 2 | "K-Means++ clustering students into mastery levels" | **VERIFY** | Code uses `sklearn.cluster.KMeans` with `n_init=10`. This is standard K-Means, not K-Means++. However scikit-learn defaults to `init='k-means++'`. So saying "K-Means++" is technically correct. **KEEP** |
| 3 | **"two-layer stacked LSTM"** | 🔴 **CHANGE** → "single-layer LSTM (200 hidden units, dropout 0.30)" | Code shows ONE `tf.keras.layers.LSTM(200)` layer |
| 4 | "optimal mastery prediction at α = 0.665" | **CHANGE** | → "a guessing-detection correction mechanism activates when BKT-LSTM divergence exceeds δ = 0.20" |
| 5 | MISSING: per-answer online BKT | **ADD** | "The engine supports real-time per-answer mastery updates enabling adaptive difficulty adjustment within a single quiz session." |

---

### PARAGRAPH 5 — RAG Pipeline

| # | Current Text | Action | Reason |
|---|---|---|---|
| 1 | "512-token segments with a 64 token overlap" | **VERIFY** | Code in `vector_store.py` chunks by double-newline paragraph splits, not fixed 512-token windows. Consider saying "paragraph-level chunking" instead, or keep the claim if it refers to the admin portal's pipeline. |
| 2 | "multilingual-e5-base model into a ChromaDB vector store" | **KEEP** | Confirmed: `EMBEDDING_MODEL = "intfloat/multilingual-e5-base"` |
| 3 | "document-order retrieval" | **KEEP** | Confirmed in `retriever.py` |
| 4 | "dual-LLM architecture: SinLlama-8B + Llama-3.3-70B" | **KEEP** | Confirmed: SinLlama via `SINHALA_LLM_URL`, Llama-3.3-70B via Groq in `llm.py` |
| 5 | MISSING: Student Q&A chatbot | **ADD** | "A RAG-powered Sinhala Q&A chatbot enables students to ask curriculum-scoped questions." |

---

### PARAGRAPH 6 — Multi-Agent Architecture (LangGraph)

| # | Current Text | Action | Reason |
|---|---|---|---|
| 1 | "seven specialized agents" | **KEEP** | Count is correct |
| 2 | "four-phase adaptive teaching lifecycle: Pre-assessment, Adaptive Content Generation, Post-assessment, Continuous Adaptation" | **KEEP** | Matches LangGraph flow |
| 3 | All agent descriptions | **KEEP** | Accurate |

✅ **This paragraph is accurate. No major changes needed.**

---

### PARAGRAPH 7 — Avatar, Engagement, Apps

| # | Current Text | Action | Reason |
|---|---|---|---|
| 1 | **ENTIRE second-column block** (starts: "In this work, the avatar renderer works as a live...") | 🔴 **DELETE ENTIRELY** (~200 words) | This repeats the avatar description from earlier. Move to paper body. Removing this duplication frees up space on the single page for the 4 new features that need to be added. |
| 2 | "rendered via Three.js and streamed through WebRTC" | **KEEP** (in the first mention only) | |
| 3 | "Google Gemini TTS" | **KEEP** | Confirmed: `gemini-2.5-flash-preview-tts` in `tts_agent.py` |
| 4 | "Whisper-based forced alignment enabling real-time lip synchronization and sentence highlighting" | **KEEP** | Confirmed: `faster_whisper.WhisperModel("base")` in `align_agent.py` |
| 5 | Engagement: "MediaPipe, custom CNN, EAR, MAR, head pose, YOLOv8" | **KEEP** but condense | All confirmed in engagement_engine modules |
| 6 | Engagement levels: "Highly Engaged, Moderately Engaged, Low Engagement, Not Engaged" | **KEEP** | Confirmed in `engagement_engine.py` L50-57 |
| 7 | **"two Next.js web applications"** | 🔴 **CHANGE** | → "a Next.js web application for students and teachers, and a separate administrative portal built with FastAPI" |
| 8 | "automated textbook digitization pipeline" | **EXPAND** | Mention REST API bridge to backend |
| 9 | "React Native mobile application" | **KEEP** | |
| 10 | MISSING: YouTube integration | **ADD** | "Supplementary educational video resources are provided through integrated YouTube search with watch-history logging." |
| 11 | MISSING: Docker containerization | **ADD** (optional, only if space allows) | "The system is containerized via Docker Compose for reproducible deployment." — confirmed in `docker-compose.yml` |

---

## ✂️ LENGTH MANAGEMENT PLAN

**Constraint**: Abstract must fit on **one single page** (two-column IEEE format).

**Current problem**: V2 overflows because of a ~200-word duplicated avatar block in the second column.

| Action | Space Impact | How |
|---|---|---|
| Delete second-column avatar repetition block | **Frees ~200 words of space** | Delete entirely — it repeats content already in P7 |
| Add 4 missing features (see above) | Uses ~60-80 words | One sentence each for admin portal, online BKT, Q&A chatbot, YouTube |
| **Net result** | **~120-140 words freed** | Comfortably fits on one single page with new content |

You do **NOT** need to aggressively cut existing content — just remove the duplication and you'll have plenty of room for the new features on a single page.

---

## 📋 FINAL CHECKLIST BEFORE SUBMISSION

- [ ] Abstract fits on ONE SINGLE PAGE (two-column IEEE format)
- [ ] Delete the entire second-column avatar repetition block
- [ ] Fix "this work present introduces" → "this work introduces"
- [ ] Fix "two-layer stacked LSTM" → "single-layer LSTM (200 hidden units)"
- [ ] Fix "two Next.js web applications" → "Next.js student app + separate FastAPI admin portal"
- [ ] Replace or define "α = 0.665" — either state BKT:0.70/LSTM:0.30 or remove
- [ ] Verify agent list matches code (Evaluator vs Explain Agent)
- [ ] Add admin portal + REST API bridge description
- [ ] Add per-answer online BKT mention
- [ ] Add Q&A chatbot mention
- [ ] Add YouTube integration mention
- [ ] Abstract fits cleanly on one page with no overflow to a second page
- [ ] All acronyms defined on first use: PC-BKT, BKT, LSTM, RAG, TTS, EAR, MAR, LLM, LoRA
- [ ] Verify "512-token segments" claim — code uses paragraph-level chunking, not fixed token windows

---

## 🎯 PRIORITY RANKING

| Paragraph | Accuracy Status | Fix Priority |
|---|---|---|
| P3 (SinLlama-8B) | ✅ Accurate | Low — no changes needed |
| P6 (LangGraph Agents) | ✅ Mostly accurate | Low — minor agent list check |
| P1 (Introduction) | ⚠️ Grammar error | Medium — fix double verb |
| P5 (RAG) | ⚠️ Missing Q&A chatbot | Medium — add 1 sentence |
| P2 (Architecture) | ⚠️ Admin portal undersold | Medium — expand item (vii) |
| P4 (Hybrid-BKT) | 🔴 FACTUAL ERROR (stacked LSTM) | **HIGH — must fix immediately** |
| P7 (Avatar + Apps) | 🔴 200-word duplication + wrong app count | **HIGH — delete block + fix** |
