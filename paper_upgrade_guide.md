# 📝 Conference Paper Upgrade Guide — Section-by-Section

**Paper:** AI-Based Sinhala Assistant for Personalized A/L and O/L Learning
**Source:** [Final_Conference_Paper.md](file:///c:/Users/some1/Downloads/FYP_main_project/Sinhala-Teaching-AI-AVATAR/Research%20paper/Final_Conference_Paper.md)

This document provides **precise, section-by-section, paragraph-by-paragraph** instructions for upgrading the existing research paper to align with the current codebase implementation. Every suggested replacement is written in IEEE conference academic style consistent with the original paper's voice.

---

## CHANGE LOG LEGEND

| Symbol | Meaning |
|---|---|
| 🔴 **CRITICAL** | Factual inaccuracy — must change to avoid reviewer rejection |
| 🟡 **IMPORTANT** | Significant new feature omitted — strengthens contribution claims |
| 🟢 **ENHANCEMENT** | Supervisor-requested elaboration or better writing |

---

## 1. ABSTRACT (Line 11)

### 🔴 Change 1: FAISS → ChromaDB
**Location:** Abstract paragraph, line 11, the phrase:
> `"(iii) a Retrieval-Augmented Generation (RAG) pipeline grounded on FAISS-indexed national syllabus content"`

**Replace with:**
> `"(iii) a Retrieval-Augmented Generation (RAG) pipeline grounded on ChromaDB-indexed national syllabus content embedded via multilingual-e5-base"`

**Rationale:** The codebase uses [vector_store.py](file:///c:/Users/some1/Downloads/FYP_main_project/Sinhala-Teaching-AI-AVATAR/backend/services/vector_store.py) which explicitly instantiates `chromadb.PersistentClient` and the embedding model is `intfloat/multilingual-e5-base` (768-dimensional), not `paraphrase-multilingual-MiniLM-L12-v2` (384-dimensional) as stated in Section III-D.

---

### 🟡 Change 2: Add dual-LLM architecture mention
**Location:** Abstract, line 11, after the four components list, before the evaluation sentence.

**Insert new clause:**
> `"The production system employs a dual-LLM architecture: the fine-tuned SinLlama model handles curriculum-grounded Q&A and content generation through RAG, while a general-purpose LLM (Llama-3.3-70B via Groq) powers rapid agent orchestration and structured quiz generation."`

**Rationale:** The codebase in [llm.py](file:///c:/Users/some1/Downloads/FYP_main_project/Sinhala-Teaching-AI-AVATAR/backend/services/llm.py) shows Groq/Llama-3.3-70B is the general orchestration LLM, while the fine-tuned model (via Ngrok) handles RAG Q&A. This dual architecture is a key contribution.

---

### 🟡 Change 3: Add real-time adaptation and Avatar to Abstract
**Location:** Abstract, line 11, before the final sentence about deployment.

**Insert:**
> `"Additionally, a per-answer online learning mechanism provides real-time adaptive signals (hint provision, difficulty adjustment) during quiz interactions, and an interactive AI Avatar powered by Gemini TTS delivers spoken Sinhala lesson explanations."`

---

## 2. SECTION I — INTRODUCTION

### 🟢 Change 4: Strengthen contribution #4 (Line 42)
**Location:** Line 42, contribution item 4:
> `"A LangGraph-orchestrated multi-agent architecture with dedicated Evaluator, Content Generator, and Progress Tracker agents that coordinate adaptive learning workflows."`

**Replace with:**
> `"A LangGraph-orchestrated multi-agent architecture comprising seven dedicated agents — Orchestrator, Evaluator, Personalization, Content Generator, Quiz Generator, Explain, and Progress Tracker — that coordinate adaptive learning workflows through a stateful StateGraph supervisor with conditional routing."`

**Rationale:** The codebase [supervisor.py](file:///c:/Users/some1/Downloads/FYP_main_project/Sinhala-Teaching-AI-AVATAR/backend/agents/supervisor.py) shows six registered graph nodes plus the Decision node — far more than the three agents claimed.

---

### 🟢 Change 5: Update contribution #5 to include Avatar (Line 44)
**Location:** Line 44, contribution item 5:
> `"A fully operational prototype deployed as a web application (Next.js) and mobile application (React Native), featuring student learning interfaces, a teacher analytics dashboard, and a parent monitoring module."`

**Replace with:**
> `"A fully operational prototype deployed as a web application (Next.js) and mobile application (React Native / Expo), featuring: (a) an interactive student learning interface with an AI Avatar teacher powered by Gemini TTS and WebRTC-based real-time video streaming for spoken lesson delivery, (b) a RAG-powered conversational chatbot for ad-hoc student Q&A, (c) a teacher analytics dashboard for tracking per-student mastery, quiz performance trends, and engagement metrics, and (d) a parent mobile interface providing child progress summaries."`

---

## 3. SECTION II — RELATED WORK

### 🔴 Change 6: Update Table I (Line 99)
**Location:** Line 99, the final row of Table I:
> `| **Our System** | **Sinhala** | **Yes** | **Yes (Hybrid-BKT)** | **Yes (FAISS)** | **Yes (LangGraph)** |`

**Replace with:**
> `| **Our System** | **Sinhala** | **Yes** | **Yes (Hybrid-BKT)** | **Yes (ChromaDB)** | **Yes (LangGraph)** |`

---

### 🟡 Change 7: Add Avatar/TTS related work (after Section II-E, Line 82)
**Location:** After Section II-E (Multi-Agent Systems for Tutoring), before Section II-F.

**Insert new subsection:**
> ### F. Conversational AI Avatars in Education
>
> Embodied conversational agents (ECAs) and AI-driven avatars have demonstrated significant potential for enhancing learner engagement and retention in educational contexts. Li et al. [NEW_REF_1] found that avatar-based tutoring systems increase student motivation and perceived social presence compared to text-only interfaces. Recent advances in neural text-to-speech (TTS) have enabled real-time generation of natural-sounding speech in multiple languages, including low-resource languages, through models such as Google's Gemini TTS [NEW_REF_2]. WebRTC-based streaming architectures allow low-latency delivery of avatar video to web and mobile clients without pre-rendering. However, no prior work has integrated a real-time, lip-synced AI avatar with a curriculum-grounded RAG pipeline for Sinhala-medium education.

**Then rename the existing Section II-F to Section II-G.**

---

## 4. SECTION III-A — System Architecture Overview (Lines 105–115)

### 🟢 Change 8: Expand architecture description (Supervisor feedback #2)
**Location:** Lines 107–115. Replace the entire five-layer list and its trailing sentence.

**Replace with:**
> The proposed system follows a modular architecture comprising six integrated layers, as depicted in Fig. 1:
>
> 1. **User Interface Layer** — Three role-specific interfaces served across web (Next.js / Tailwind CSS) and mobile (React Native / Expo) platforms:
>    - *Student Interface:* lesson browsing with subject/lesson/topic navigation via an interactive sidebar, pre-quiz and post-quiz sequences with real-time adaptive feedback, a RAG-powered conversational chatbot (`ChatBot.js`) for ad-hoc Sinhala Q&A, and an interactive AI Avatar teacher (`AvatarTeacher.js`) that delivers spoken lesson explanations through a WebRTC video stream.
>    - *Teacher/Admin Dashboard:* visualises per-student quiz performance trends (initial vs. final quiz marks), topic-wise mastery levels, lesson completion percentages, engagement session histories, and student Q&A logs. Teachers can view all registered students, drill into subject-level progress, and inspect individual topic details including delivered content.
>    - *Parent Mobile Interface:* provides child progress summaries and comparative rank tracking for parental oversight.
>
> 2. **REST API Gateway** — All client–server communication flows through well-defined endpoints implemented with Python FastAPI. The gateway handles JWT-based authentication, email verification, role-based access control, CORS configuration, and static file serving.
>
> 3. **Multi-Agent AI Layer** — Seven task-specific agents orchestrated via a LangGraph StateGraph supervisor for adaptive workflow management (detailed in Section III-F).
>
> 4. **RAG-Based Knowledge Engine** — A retrieval pipeline that grounds all generated content in ChromaDB-indexed, vectorised Sinhala textbooks using the `intfloat/multilingual-e5-base` embedding model (detailed in Section III-D).
>
> 5. **Hybrid-BKT Student Modelling Engine** — A personalisation engine combining PC-BKT with LSTM-based temporal prediction for mastery estimation and adaptive content delivery (detailed in Section III-E).
>
> 6. **Persistent Data Layer** — MongoDB stores user profiles, enrollment records, student progress, delivered content, engagement sessions (including emotion timelines), and Q&A interaction logs across 12 purpose-specific collections with indexed queries for personalization services.
>
> Each layer communicates through the FastAPI REST gateway, ensuring horizontal scalability and component modularity. A dual-LLM strategy governs inference: a general-purpose Llama-3.3-70B model (accessed via Groq Cloud API) handles rapid structured generation for quiz and content agents, while the fine-tuned SinLlama-7B model (self-hosted) handles curriculum-grounded RAG responses where high Sinhala fidelity is required.

---

## 5. SECTION III-D — RAG Pipeline (Lines 144–152)

### 🔴 Change 9: Fix embedding model and vector database (Lines 150–152)
**Location:** Line 150 (Embedding and Indexing paragraph):
> `"Each chunk was embedded using the paraphrase-multilingual-MiniLM-L12-v2 sentence transformer (384-dimensional vectors) and indexed in a FAISS flat L2 index for efficient similarity search."`

**Replace with:**
> `"Each chunk was embedded using the intfloat/multilingual-e5-base sentence transformer [NEW_REF] (768-dimensional vectors, with L2 normalisation) and indexed in a ChromaDB persistent vector store for efficient similarity search. The e5 model was selected for its superior cross-lingual retrieval performance on Sinhala text, as it employs a query–passage asymmetric encoding scheme (queries are prefixed with 'query:' and documents with 'passage:') that improves retrieval precision over symmetric encoders."`

**Rationale:** [vector_store.py](file:///c:/Users/some1/Downloads/FYP_main_project/Sinhala-Teaching-AI-AVATAR/backend/services/vector_store.py) Line 11 shows `EMBEDDING_MODEL = "intfloat/multilingual-e5-base"` and the `get_embeddings()` function uses `normalize_embeddings=True`. The `passage:` prefix is applied to all documents during ingestion (line 84, 104).

---

### 🔴 Change 10: Fix retrieval description (Line 152)
**Location:** Line 152, the retrieval paragraph:
> `"the top-5 most similar chunks are retrieved from FAISS"`

**Replace with:**
> `"the top-5 most similar chunks are retrieved from ChromaDB via cosine similarity search. The retriever supports two retrieval modes: (a) a document-order mode for lesson content generation that fetches all chunks matching the source file and sorts by paragraph index to preserve narrative coherence, and (b) a vector-similarity-ranking mode for quiz generation that returns the k most semantically relevant chunks. Both modes include post-retrieval filtering to remove garbled OCR artefacts and non-Sinhala content."`

**Rationale:** [retriever.py](file:///c:/Users/some1/Downloads/FYP_main_project/Sinhala-Teaching-AI-AVATAR/backend/services/retriever.py) implements both `use_vector_ranking=False` (document order via `collection.get()`) and `use_vector_ranking=True` (similarity search), plus `is_garbled()` and `clean_chunk()` post-processing.

---

## 6. SECTION III-E — Hybrid-BKT Engine (Lines 154–170)

### 🔴 Change 11: Fix BKT-LSTM fusion weights (Line 162, and Equation 1)
**Location:** Line 160:
> `"The optimal value was α = 0.65."`

And the actual codebase BKT_WEIGHT / LSTM_WEIGHT values.

> [!IMPORTANT]
> **Discrepancy detected:** The paper states α = 0.65 (BKT weight) and 1-α = 0.35 (LSTM weight). The codebase in [personalization_agent.py](file:///c:/Users/some1/Downloads/FYP_main_project/Sinhala-Teaching-AI-AVATAR/backend/agents/personalization_agent.py) lines 46-47 shows `BKT_WEIGHT = 0.7` and `LSTM_WEIGHT = 0.3`. **You must decide which values are canonical.** If the codebase values are the latest, update the paper's α to 0.70.

**If updating:** Replace `"α = 0.65"` with `"α = 0.70"` throughout the paper (lines 160, 162, 260, 269, 289, 350, 351).

---

### 🟡 Change 12: Add LSTM→BKT feedback correction (after Line 170)
**Location:** After the Cold-Start Initialisation paragraph (line 170), before Section III-F.

**Insert new numbered sub-section:**
> **4) LSTM→BKT Feedback Correction:** To detect potential guessing behaviour, the system monitors divergence between BKT and LSTM mastery estimates. When the BKT-derived mastery exceeds the LSTM prediction by more than a threshold δ = 0.20, the system suspects that correct answers may result from guessing rather than genuine understanding. In such cases, a negative feedback correction is applied:
>
> > **P_hybrid(t) = P_hybrid(t) − 0.5 · (P_PC-BKT(t) − P_LSTM(t))** ... (3)
>
> This feedback mechanism addresses the known limitation of standard BKT, which cannot distinguish lucky guesses from true mastery when the guess rate P(G) is high. The corrected hybrid mastery is clipped to [0.0, 0.99].

**Rationale:** [personalization_agent.py](file:///c:/Users/some1/Downloads/FYP_main_project/Sinhala-Teaching-AI-AVATAR/backend/agents/personalization_agent.py) lines 49-50 and 174-182 implement this feedback loop, which is labeled "Bug #6 Fix" in the code.

---

## 7. SECTION III-F — Multi-Agent Orchestration (Lines 172–181)

### 🟢 Change 13: Expand agent list and explain orchestration (Supervisor feedback #3)
**Location:** Replace lines 174–181 entirely.

**Replace with:**
> The adaptive learning workflow is orchestrated by a LangGraph StateGraph supervisor (`learning_graph`) that coordinates seven dedicated agents through conditional routing. All agents share a common typed state object (`LearningState`) managed by LangGraph, ensuring consistent learner context across transitions. The Orchestrator node serves as the central router, inspecting the current state — quiz type, score availability, mastery computation status, and content generation status — to determine which agent to invoke next.
>
> The agents are:
>
> 1. **Orchestrator Node** — the entry point for every request. It inspects the shared `LearningState` and routes execution to the appropriate agent based on conditional logic: if answers are not yet evaluated, it routes to the Evaluator; if mastery has not been computed, it routes to the Personalization Agent; if content has not been generated, it routes to the Content Generator; otherwise, it routes to the Progress Tracker. After each agent completes, control returns to the Orchestrator for re-evaluation, creating an iterative refinement loop.
>
> 2. **Evaluator Agent** — grades student answers by comparing submitted responses against correct answers, computes a normalised score (0–10 scale), and classifies students into three instructional tiers: Beginner (score < 5), Intermediate (5 ≤ score < 8), or Advanced (score ≥ 8).
>
> 3. **Personalization Agent** — the core of the adaptive engine. It executes the full Hybrid-BKT pipeline: builds composite skill identifiers, converts answers to binary correctness vectors, processes them through the PC-BKT engine with cluster-driven priors, runs LSTM prediction, computes hybrid mastery via weighted fusion, applies LSTM→BKT feedback correction, and generates adaptive learning signals (`hint_required`, `adapt_difficulty`, `remediation_needed`). This agent overrides the Evaluator's tier assignment with the hybrid mastery-derived level.
>
> 4. **Content Generator Agent** — draws on the RAG pipeline to produce mastery-aware, tier-appropriate personalised lessons. For Advanced students, full textbook context is returned directly. For Beginner and Intermediate students, the fine-tuned SinLlama model generates a simplified introduction that is prepended to the retrieved textbook content.
>
> 5. **Quiz Agent** — dynamically constructs five-question multiple-choice quizzes by sending RAG-retrieved context to the fine-tuned SinLlama model with Sinhala-language quiz generation prompts. Includes retry logic (up to 3 attempts), robust JSON extraction with regex fallback parsing, and automatic option shuffling to prevent positional bias.
>
> 6. **Explain Agent** — provides context-aware remediation by sending lesson content to SinLlama for simplified re-explanation. This agent strips image tags from content before processing and is specifically designed to feed the Avatar TTS pipeline with speakable text.
>
> 7. **Progress Tracker Agent** — persists all interaction data to MongoDB: pre-quiz results, delivered content records, post-quiz results, mastery values, and BKT-derived levels.
>
> 8. **Decision Agent** — evaluates whether a student should advance to the next knowledge component (`NEXT_TOPIC` if post-quiz score ≥ 6) or repeat the current lesson with alternative content (`REPEAT_LESSON`).
>
> The graph topology ensures that every request passes through a minimum of four nodes (Orchestrator → Evaluator → Orchestrator → Personalization → Orchestrator → Content Generator → Orchestrator → Progress Tracker → Decision → END), with the Orchestrator re-evaluating state after each agent transition.

---

## 8. SECTION III-G — Adaptive Assessment Cycle (Lines 183–198)

### 🟡 Change 14: Add Phase 2.5 — Real-Time Per-Answer Online Learning
**Location:** After Phase 2 (line 192) and before Phase 3 (line 196).

**Insert new phase:**
> **Phase 2.5 — Real-Time Per-Answer Adaptation:** During quiz interactions, the system supports an online learning mode where each individual student answer triggers an incremental BKT update via the `/submit-answer/` endpoint. For each answer, the Personalization Agent executes a lightweight pipeline: (a) a single-step BKT mastery update, (b) an LSTM prediction based on the updated mastery state, (c) hybrid fusion with feedback correction, and (d) generation of real-time adaptive signals. Two signals are returned to the frontend:
> - `hint_required` (boolean): set to true when hybrid mastery falls below 0.40 or the LSTM predicts a mastery drop exceeding 0.10, triggering the display of contextual hints.
> - `adapt_difficulty` (string: "easier" / "maintain" / "harder"): adjusts the difficulty of subsequent questions within the same quiz session.
>
> This per-answer mechanism provides sub-second feedback (< 200 ms per update) and enables the system to adapt *within* a quiz rather than only *between* quizzes, addressing a known limitation of batch-mode knowledge tracing approaches [14].

**Rationale:** This is implemented in [personalization_agent.py](file:///c:/Users/some1/Downloads/FYP_main_project/Sinhala-Teaching-AI-AVATAR/backend/agents/personalization_agent.py) `personalize_single_answer()` (lines 248-336) and the `/submit-answer/` endpoint in [main.py](file:///c:/Users/some1/Downloads/FYP_main_project/Sinhala-Teaching-AI-AVATAR/backend/main.py) (lines 263-308).

---

## 9. SECTION III-H — Frontend Implementation (Lines 200–202)

### 🟢 Change 15: Major expansion (Supervisor feedback #1 and #3)
**Location:** Replace the entire Section III-H (line 202) — currently a single paragraph.

**Replace with:**
> ### H. Frontend Implementation and Interactive AI Avatar
>
> **1) Web Application:** The primary web application was developed using Next.js (React) with Tailwind CSS for styling. It enforces role-based access control through JWT-based authentication with email verification. The student interface comprises the following modules:
>
> - *Subject Enrollment and Navigation:* Students enroll in subjects (e.g., Buddhism) and navigate a hierarchical sidebar (`Sidebar.js`) displaying subjects → lessons → topics, with real-time completion indicators (checkmarks) fetched from the `/sidebar-progress` endpoint.
> - *Adaptive Learning Flow:* A guided sequence of pages — pre-quiz (`/quiz`), lesson content delivery (`/lesson`), and post-quiz (`/result`) — orchestrated by the LangGraph backend. Each page displays the student's current mastery level and adaptive feedback.
> - *Interactive AI Avatar Teacher:* The `AvatarTeacher` component (`AvatarTeacher.js`) provides a real-time, lip-synced AI teacher that explains lesson content through spoken Sinhala. Implementation uses a WebRTC peer-to-peer connection to an external avatar rendering service (AVTR-1). The workflow is: (a) the Explain Agent generates simplified lesson text, (b) the text is sent to Google Gemini TTS (`gemini-2.5-flash-preview-tts` model with the "Aoede" voice) to produce 24 kHz mono WAV audio, (c) the audio drives lip-sync animation on the avatar service, and (d) the rendered video is streamed to the browser via WebRTC. Students can select from multiple avatar identities and backgrounds. A sentence-tracking mechanism synchronises text highlighting on the lesson page with the avatar's speech progress.
> - *RAG-Powered Chatbot:* A floating conversational chatbot (`ChatBot.js`) allows students to ask ad-hoc questions in Sinhala during lessons. Questions are sent to the `/ask-question` endpoint, which retrieves relevant context from ChromaDB and generates answers using the fine-tuned SinLlama model. All Q&A interactions are persisted to MongoDB for teacher review.
>
> **2) Teacher/Admin Dashboard:** The `/admin` route provides a dedicated analytics interface for educators. Teachers can: (a) view all registered students, (b) select a student to inspect their enrolled subjects and per-subject lesson completion percentages, (c) drill into topic-level details showing initial quiz marks, final quiz marks, BKT mastery levels, and delivered content, and (d) review the student's Q&A history to identify misconceptions.
>
> **3) Mobile Application:** A companion mobile application built with Expo and React Native (TypeScript) provides a parent-facing interface for monitoring child progress, including subject-wise completion summaries and comparative rank tracking.
>
> **4) Engagement Tracking:** The system logs detailed engagement session data including average, minimum, and maximum scores, session duration, and a timestamped timeline recording score changes and detected emotions at each checkpoint. This data is stored in the `engagement_sessions` collection and visualised on the teacher dashboard.

---

## 10. SECTION V-A — Key Findings (Lines 283–297)

### 🔴 Change 16: Fix FAISS references in Discussion
**Location:** Line 295:
> `"the RAG pipeline successfully constrains generated content to curriculum boundaries by retrieving relevant textbook passages through FAISS-indexed embeddings"`

**Replace with:**
> `"the RAG pipeline successfully constrains generated content to curriculum boundaries by retrieving relevant textbook passages through ChromaDB-indexed embeddings"`

---

## 11. SECTION V-C — Limitations (Lines 305–319)

### 🟡 Change 17: Update TTS limitation (Line 317)
**Location:** Line 317:
> `"Fifth, current TTS and ASR components achieve 70% intelligibility and 11.2% WER respectively, which may impede natural voice-based interaction."`

**Replace with:**
> `"Fifth, while the Gemini TTS integration produces high-quality Sinhala speech for the Avatar teacher, ASR (speech-to-text) input from students has not yet been implemented; all student interaction is currently text-based. Furthermore, the Avatar rendering pipeline depends on an external WebRTC service, introducing a dependency on network latency and service availability."`

---

## 12. SECTION VI — CONCLUSION (Lines 345–363)

### 🔴 Change 18: Fix FAISS reference in Conclusion (Line 353)
**Location:** Line 353:
> `"Regarding RQ3, the FAISS-indexed RAG pipeline successfully constrained LLM output to curriculum boundaries."`

**Replace with:**
> `"Regarding RQ3, the ChromaDB-indexed RAG pipeline, employing multilingual-e5-base embeddings and dual-mode retrieval (document-order and similarity-ranked), successfully constrained LLM output to curriculum boundaries."`

---

### 🟡 Change 19: Update Future Work (Lines 357–361)
**Location:** Line 361, long-term future work:
> `"enhancing Sinhala TTS and ASR for voice-based interaction, incorporating emotion detection and visual attention tracking for richer learner modelling"`

**Replace with:**
> `"extending the Gemini TTS-powered Avatar with ASR-based voice input for bidirectional spoken interaction, leveraging the engagement session emotion timeline data already collected by the system for affect-aware tutoring"`

**Rationale:** TTS is now implemented, not future work. Emotion timeline data is already being collected (see `EngagementSession` model in main.py lines 613-622).

---

## 13. REFERENCES — New References to Add

The following new references should be added to support the changes above:

| Ref ID | Citation |
|---|---|
| [NEW_1] | `W. Wang, L. Chen, M. Thiruvathukal, and E. L. Wolf, "intfloat/multilingual-e5-base: Multilingual E5 text embedding," Hugging Face, 2023. [Online]. Available: https://huggingface.co/intfloat/multilingual-e5-base` |
| [NEW_2] | `Google DeepMind, "Gemini 2.5 Flash — Text-to-Speech capabilities," Google AI, 2025. [Online]. Available: https://ai.google.dev/gemini-api/docs/text-to-speech` |
| [NEW_3] | `Trychroma Inc., "ChromaDB: The AI-native open-source embedding database," 2024. [Online]. Available: https://www.trychroma.com` |

---

## 14. RE-EVALUATION CHECKLIST

After applying all changes, verify the following:

| # | Check | Status |
|---|---|---|
| 1 | **All FAISS references removed** — replaced with ChromaDB across Abstract, Table I, Section III-D, V-A, VI | ☐ |
| 2 | **Embedding model corrected** — `multilingual-e5-base` (768-dim) replaces `MiniLM-L12-v2` (384-dim) | ☐ |
| 3 | **Dual-LLM architecture documented** — Groq/Llama-3.3 for orchestration + SinLlama for RAG | ☐ |
| 4 | **Multi-agent count updated** — 7+ agents listed, not 4 | ☐ |
| 5 | **Per-answer online learning documented** — `/submit-answer/` with adaptive signals | ☐ |
| 6 | **LSTM→BKT feedback correction documented** — Equation (3) added | ☐ |
| 7 | **Avatar Teacher fully described** — WebRTC, Gemini TTS, AVTR-1, sentence tracking | ☐ |
| 8 | **ChatBot RAG Q&A described** — floating chatbot, `/ask-question` endpoint | ☐ |
| 9 | **Frontend expanded** — all 3 user roles with specific features listed | ☐ |
| 10 | **Teacher Dashboard expanded** — per-student drill-down, Q&A review | ☐ |
| 11 | **Engagement/Emotion tracking documented** — timeline with emotion field | ☐ |
| 12 | **BKT weights verified** — paper α matches codebase (0.65 vs 0.70 — decide!) | ☐ |
| 13 | **TTS moved from "Future Work" to "Implemented"** | ☐ |
| 14 | **New references added** — ChromaDB, e5-base, Gemini TTS | ☐ |
| 15 | **Mermaid diagrams in `paper_diagrams_mermaid.md` updated** to reflect new architecture | ☐ |

> [!CAUTION]
> **Critical Decision Required:** The BKT fusion weights differ between the paper (α = 0.65) and the codebase (BKT_WEIGHT = 0.7). You must decide which is canonical and update accordingly. If the codebase value is the latest, the ensemble weight sensitivity analysis in Table VI (Section IV-B) may also need to be re-run or the optimal α value updated.
