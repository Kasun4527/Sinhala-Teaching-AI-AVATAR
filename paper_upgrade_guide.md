# 📝 Conference Paper Upgrade Guide — V8 Edition

**Paper:** An AI-Driven Personalized Sinhala Teaching Assistant for Secondary Education Using Curriculum Aligned Large Language Models
**Source PDF:** [AI-Based Sinhala Assistant_V8.pdf](file:///c:/Users/some1/Downloads/FYP_main_project/Sinhala-Teaching-AI-AVATAR/Research%20paper/AI-Based%20Sinhala%20Assistant_V8.pdf)
**Text reference:** [V8_extracted.txt](file:///c:/Users/some1/Downloads/FYP_main_project/Sinhala-Teaching-AI-AVATAR/Research%20paper/V8_extracted.txt)

This document provides **precise, section-by-section** upgrade instructions for V8, grounded in the actual codebase implementation. V8 has already addressed several issues from V7 (ChromaDB, multilingual-e5-base, dual-LLM mention in abstract, title improvement). This guide focuses on **what still needs to change**.

---

## CHANGE LOG LEGEND

| Symbol | Meaning |
|---|---|
| 🔴 **CRITICAL** | Factual error or major omission — must fix before submission |
| 🟡 **IMPORTANT** | Significant codebase feature not yet documented — strengthens contribution claims |
| 🟢 **ENHANCEMENT** | Supervisor-requested elaboration or improved writing |
| ✅ **ALREADY FIXED in V8** | Issue from V7 that V8 has correctly resolved |

---

## V8 vs V7: What Was Already Fixed

Before listing changes, here is what V8 already corrected from V7:

| Item | V7 Status | V8 Status |
|---|---|---|
| FAISS → ChromaDB | ❌ Said "FAISS" | ✅ Says "ChromaDB" (line 32, 326) |
| Embedding model | ❌ Said "MiniLM-L12-v2 (384-dim)" | ✅ Says "multilingual-e5-base" (line 324) |
| Dual-LLM in abstract | ❌ Not mentioned | ✅ Mentioned (lines 43-46) |
| Avatar/Gemini TTS in abstract | ❌ Not mentioned | ✅ Mentioned (lines 62-63) |
| BKT equations shown | ❌ Only formula (1) | ✅ Full update equations (lines 365-374) |
| Title improved | ❌ Generic title | ✅ More descriptive title |
| α = 0.665 two-stage search | ❌ Said α = 0.65 | ✅ Says α = 0.665 with two-stage search (line 430) |

---

## 1. ABSTRACT (Lines 7–63)

### 🔴 Change 1: Fix typo "multilingual-e5-bas"
**Location:** Abstract, line 32-33:
> `"multilingual-e5-bas"`

**Replace with:**
> `"multilingual-e5-base"`

**Rationale:** Simple typo — the missing "e" in the model name.

---

### 🟡 Change 2: Add per-answer real-time adaptation to abstract
**Location:** After line 42 (`"...tailored to individual proficiency levels."`) and before the dual-LLM sentence (line 43).

**Insert:**
> `"A per-answer online learning mechanism provides real-time adaptive signals during quiz interactions, enabling within-session difficulty adjustment and hint provision."`

**Rationale:** This is a key novelty implemented in [personalize_single_answer()](file:///c:/Users/some1/Downloads/FYP_main_project/Sinhala-Teaching-AI-AVATAR/backend/agents/personalization_agent.py#L248-L336) and the `/submit-answer/` endpoint in [main.py](file:///c:/Users/some1/Downloads/FYP_main_project/Sinhala-Teaching-AI-AVATAR/backend/main.py).

---

## 2. SECTION I — INTRODUCTION (Lines 67–139)

### 🟡 Change 3: Add explicit contributions list
**Location:** After the four research questions paragraph (lines 118-132), before the road-map paragraph (line 133).

> [!IMPORTANT]
> V8 removed the explicit numbered contributions list that V7 had. IEEE conference papers are **significantly strengthened** by an explicit contributions list. Strongly recommend re-adding it.

**Insert:**
> The principal contributions of this paper are fivefold:
>
> 1. A Hybrid-BKT personalisation engine that blends the interpretability of Personalised Clustered BKT with the temporal modelling capacity of LSTM networks through a weighted ensemble (α = 0.665), reaching 56.2% accuracy and 0.49 RMSE on 47 knowledge components — surpassing Standard BKT (48.1%) and standalone BKT-LSTM (54.7%).
>
> 2. A comparative evaluation of five Sinhala-supporting LLMs (SinLlama-7B, Qwen-14B, Llama-3.1-8B, DeepSeek-14B, Mistral-7B), fine-tuned on 3,547 curriculum-derived QA pairs, demonstrating that the language-specific SinLlama model achieves markedly higher semantic fidelity (ROUGE-1: 0.7714, BERTScore: 0.9424) than general-purpose multilingual alternatives.
>
> 3. A curriculum-grounded RAG pipeline using ChromaDB-indexed Sinhala textbook embeddings (multilingual-e5-base, 768-dimensional) with dual-mode retrieval — document-order for content generation and similarity-ranked for quiz generation — that constrains generated content to verified syllabus material.
>
> 4. A LangGraph-orchestrated multi-agent architecture comprising seven dedicated agents — Orchestrator, Evaluator, Personalization, Content Generator, Quiz Generator, Explain, and Progress Tracker — coordinating adaptive learning workflows through a stateful StateGraph supervisor with conditional routing and a dual-LLM inference strategy.
>
> 5. A fully operational prototype deployed as a web application (Next.js) and mobile application (React Native / Expo), featuring an interactive AI Avatar teacher powered by Gemini TTS and WebRTC-based real-time video streaming, a RAG-powered conversational chatbot, a teacher analytics dashboard, and a parent monitoring module.

---

## 3. SECTION III-A — System Architecture Overview (Lines 256–285)

### 🟢 Change 4: Expand architecture layers (Supervisor feedback #1 and #2)
**Location:** Replace lines 258-285 (the five-layer list and trailing paragraph).

V8's current text is brief and vague — the supervisor specifically asked for more detail on web/mobile apps, end users, functions, and full system architecture.

**Replace with:**
> The proposed system follows a modular architecture comprising six integrated layers, as illustrated in Fig. 1. The functionality of each layer is described below:
>
> 1. *User Interface Layer* — Three role-specific interfaces served across web (Next.js / Tailwind CSS) and mobile (React Native / Expo) platforms:
>    - *Student Interface:* provides lesson browsing with hierarchical subject → lesson → topic navigation, pre-quiz and post-quiz sequences with real-time adaptive feedback, a RAG-powered conversational chatbot for ad-hoc Sinhala Q&A, and an interactive AI Avatar teacher that delivers spoken lesson explanations through a WebRTC video stream powered by Gemini TTS.
>    - *Teacher/Admin Dashboard:* visualises per-student quiz performance trends (initial vs. final quiz marks), topic-wise mastery levels, lesson completion percentages, and engagement session histories. Teachers can view all registered students, drill into subject-level progress, and inspect individual topic details including delivered content and student Q&A logs.
>    - *Parent Mobile Interface:* provides child progress summaries and comparative rank tracking for parental oversight.
>
> 2. *REST API Gateway* — All client–server communication flows through well-defined endpoints implemented with Python FastAPI. The gateway handles JWT-based authentication, email verification, role-based access control, and CORS configuration.
>
> 3. *Multi-Agent AI Layer* — Seven task-specific agents orchestrated via a LangGraph StateGraph supervisor for adaptive workflow management (detailed in Section III-E).
>
> 4. *RAG-Based Knowledge Engine* — A retrieval pipeline that grounds all generated content in ChromaDB-indexed, vectorised Sinhala textbooks using the intfloat/multilingual-e5-base embedding model (detailed in Section III-C).
>
> 5. *Hybrid-BKT Student Modelling Engine* — A personalisation engine combining PC-BKT with LSTM-based temporal prediction for mastery estimation and adaptive content delivery (detailed in Section III-D).
>
> 6. *Persistent Data Layer* — MongoDB stores user profiles, enrollment records, student progress, delivered content, engagement sessions, and Q&A interaction logs across purpose-specific collections with indexed queries for personalisation services.
>
> Each layer communicates through the FastAPI REST gateway, ensuring horizontal scalability and component modularity. A dual-LLM strategy governs inference: a general-purpose Llama-3.3-70B model (accessed via Groq Cloud API) handles rapid structured generation for agent orchestration, while the fine-tuned SinLlama-7B model (self-hosted) handles curriculum-grounded RAG responses where high Sinhala semantic fidelity is required.

---

## 4. SECTION III-C — RAG Pipeline (Lines 307–346)

### 🟡 Change 5: Add dual-mode retrieval detail
**Location:** After line 342 (`"...curriculum-relevant information."`) and before the multimodal paragraph (line 343).

**Insert new paragraph:**
> The retriever supports two complementary retrieval modes: (a) a document-order mode for lesson content generation that fetches all chunks matching the source file and sorts by paragraph index to preserve narrative coherence, and (b) a vector-similarity-ranking mode for quiz generation that returns the k most semantically relevant chunks. Both modes include post-retrieval filtering to remove garbled OCR artefacts and non-Sinhala content through a Unicode character-ratio threshold (Sinhala character proportion ≥ 0.30).

**Rationale:** [retriever.py](file:///c:/Users/some1/Downloads/FYP_main_project/Sinhala-Teaching-AI-AVATAR/backend/services/retriever.py) lines 103-174 implement both `use_vector_ranking=False` (document order via `collection.get()`) and `use_vector_ranking=True` (similarity search), plus `is_garbled()` and `clean_chunk()` post-processing — a technically novel retrieval design not mentioned in V8.

---

## 5. SECTION III-D — Hybrid-BKT Engine (Lines 347–435)

### 🔴 Change 6: Reconcile α values — V8 has internal inconsistency
**Location:** Line 430 says `α = 0.665`, but Table IV (line 676) says `"0.65 (selected)"` and the Discussion (line 692) says `"0.65 PC-BKT"`.

> [!CAUTION]
> **Internal inconsistency in V8:** The body text claims α = 0.665 from a two-stage grid search (line 430-435), but Table IV still shows "0.65 (selected)" (line 676), and the Discussion still says "0.65 PC-BKT + 0.35 LSTM" (line 692). Additionally, the codebase at [personalization_agent.py](file:///c:/Users/some1/Downloads/FYP_main_project/Sinhala-Teaching-AI-AVATAR/backend/agents/personalization_agent.py) lines 46-47 shows `BKT_WEIGHT = 0.7` and `LSTM_WEIGHT = 0.3`.
>
> **You must decide which is canonical** and make it consistent everywhere:
> - Option A: Use α = 0.665 (as V8 text says) → update Table IV, Discussion, and codebase
> - Option B: Use α = 0.70 (as codebase says) → update V8 text, Table IV, and Discussion

---

### 🟡 Change 7: Add LSTM→BKT feedback correction mechanism
**Location:** After the Hybrid-BKT subsection (c) around line 435, before Section III-E.

**Insert new subsection:**
> (d) *LSTM→BKT Feedback Correction:* To detect potential guessing behaviour, the system monitors divergence between BKT and LSTM mastery estimates. When the BKT-derived mastery exceeds the LSTM prediction by more than a threshold δ = 0.20, the system suspects that correct answers may have resulted from guessing rather than genuine understanding. In such cases, a negative feedback correction is applied:
>
> P_hybrid(t) = P_hybrid(t) − 0.5 · (P_{PC-BKT}(t) − P_{LSTM}(t))
>
> This feedback mechanism addresses the known limitation of standard BKT, which cannot distinguish lucky guesses from true mastery when the guess rate P(G) is high. The corrected hybrid mastery is clipped to [0.0, 0.99].

**Rationale:** This is implemented at [personalization_agent.py](file:///c:/Users/some1/Downloads/FYP_main_project/Sinhala-Teaching-AI-AVATAR/backend/agents/personalization_agent.py) lines 49-50 and 174-182 (labeled "Bug #6 Fix"). It is a genuinely novel mechanism not found in standard BKT literature.

---

## 6. SECTION III-E — Multi-Agent Orchestration (Lines 436–458)

### 🟢 Change 8: Expand agent descriptions (Supervisor feedback #3)
**Location:** Replace lines 437-458 entirely.

V8 currently lists only 4 agents in a brief bullet list. The codebase has 7+ distinct agents with significant orchestration logic.

**Replace with:**
> The adaptive learning workflow is orchestrated by a LangGraph StateGraph supervisor that coordinates seven dedicated agents through conditional routing. All agents share a common typed state object (LearningState) managed by LangGraph, ensuring consistent learner context across transitions. The Orchestrator node serves as the central router, inspecting the current state — quiz type, score availability, mastery computation status, and content generation status — to determine which agent to invoke next.
>
> 1. *Orchestrator Node* — the entry point for every learning request. It inspects the shared LearningState and routes execution to the appropriate agent based on conditional logic: if answers are not yet evaluated, it routes to the Evaluator; if mastery has not been computed, it routes to the Personalisation Agent; if content has not been generated, it routes to the Content Generator; otherwise, it routes to the Progress Tracker. After each agent completes, control returns to the Orchestrator for re-evaluation, creating an iterative refinement loop.
>
> 2. *Evaluator Agent* — grades student answers by comparing submitted responses against correct answers, computes a normalised score (0–10 scale), and assigns an initial instructional tier classification: Beginner (score < 5), Intermediate (5 ≤ score < 8), or Advanced (score ≥ 8).
>
> 3. *Personalisation Agent* — the core of the adaptive engine. It executes the full Hybrid-BKT pipeline: builds composite skill identifiers from subject/lesson/topic, converts answers to binary correctness vectors, processes them through the PC-BKT engine with cluster-driven priors, runs LSTM temporal prediction, computes hybrid mastery via weighted fusion, applies the LSTM→BKT feedback correction, and generates adaptive learning signals (hint_required, adapt_difficulty, remediation_needed). This agent overrides the Evaluator's initial tier assignment with the hybrid mastery-derived level, ensuring that all content delivery decisions are governed by the Hybrid-BKT engine.
>
> 4. *Content Generator Agent* — draws on the RAG pipeline to produce mastery-aware, tier-appropriate personalised lessons. For Advanced students, full retrieved textbook context is returned directly. For Beginner and Intermediate students, the fine-tuned SinLlama model generates a simplified introduction that is prepended to the retrieved textbook content.
>
> 5. *Quiz Agent* — dynamically constructs five-question multiple-choice quizzes in Sinhala by sending RAG-retrieved context to the fine-tuned model with curriculum-aligned quiz generation prompts. Includes retry logic (up to 3 attempts), robust JSON extraction with regex fallback parsing for malformed model output, and automatic option shuffling to prevent positional bias.
>
> 6. *Explain Agent* — provides context-aware explanations by sending lesson content to SinLlama for simplified re-explanation. This agent strips image tags from content before processing and produces speakable text specifically designed for the Avatar TTS pipeline.
>
> 7. *Progress Tracker Agent* — persists all interaction data to MongoDB: pre-quiz results, delivered content records, post-quiz results, mastery values, BKT-derived levels, and engagement session analytics.
>
> A Decision Agent evaluates post-quiz outcomes to determine whether the student should advance to the next knowledge component (score ≥ 6/10) or repeat the current lesson with alternative content. The graph topology ensures that every request passes through a minimum of four nodes (Orchestrator → Evaluator → Personalisation → Content Generator → Progress Tracker → Decision), with the Orchestrator re-evaluating state after each agent transition.

---

## 7. SECTION III-F — Adaptive Assessment Cycle (Lines 459–487)

### 🟡 Change 9: Add Phase 2.5 — Real-Time Per-Answer Online Learning
**Location:** After Phase 2 paragraph (line 477) and before Phase 3 (line 478).

**Insert new phase:**
> *Phase 2.5 (Real-Time Per-Answer Adaptation):* During quiz interactions, the system supports an online learning mode where each individual student answer triggers an incremental BKT update via a dedicated API endpoint. For each answer, the Personalisation Agent executes a lightweight pipeline: (a) a single-step BKT mastery update, (b) an LSTM prediction based on the updated mastery state, (c) hybrid fusion with feedback correction, and (d) generation of real-time adaptive signals. Two signals are returned to the frontend: *hint_required* — set to true when hybrid mastery falls below 0.40 or the LSTM predicts a mastery drop exceeding 0.10; and *adapt_difficulty* — adjusts the difficulty of subsequent questions within the same quiz session ("easier", "maintain", or "harder"). This per-answer mechanism provides sub-second feedback (< 200 ms per update) and enables the system to adapt *within* a quiz rather than only *between* quizzes, addressing a known limitation of batch-mode knowledge tracing.

**Rationale:** Implemented in [personalization_agent.py](file:///c:/Users/some1/Downloads/FYP_main_project/Sinhala-Teaching-AI-AVATAR/backend/agents/personalization_agent.py) `personalize_single_answer()` (lines 248-336).

---

## 8. NEW SECTION III-G — Interactive AI Avatar and Speech Pipeline

### 🟢 Change 10: Add dedicated Avatar subsection (Supervisor feedback #3)
**Location:** After Section III-F (Adaptive Assessment Cycle), before Section IV (Results).

V8 mentions the Avatar only once in the abstract (line 62-63) and briefly in the Discussion limitations (lines 718-724) but never describes how it actually works. The supervisor specifically asked for more about the Avatar.

**Insert new subsection:**
> *G. Interactive AI Avatar Teacher*
>
> To enhance learner engagement and simulate a classroom teaching experience, the system incorporates an interactive AI Avatar that delivers spoken Sinhala lesson explanations. The Avatar pipeline operates in three stages:
>
> First, the Explain Agent processes lesson content retrieved from the RAG pipeline, generating a simplified spoken-form explanation by sending the text to the fine-tuned SinLlama model. Image reference tags are stripped to produce clean, speakable text.
>
> Second, the cleaned text is synthesised into Sinhala speech using Google Gemini TTS (gemini-2.5-flash-preview-tts model with the "Aoede" voice preset), producing 24 kHz mono 16-bit PCM audio wrapped in a WAV container. Audio is generated server-side and streamed to the frontend.
>
> Third, the generated audio drives a lip-synced 3D avatar rendered via an external avatar rendering service (AVTR-1). The avatar video is delivered to the browser through a WebRTC peer-to-peer connection with ICE server negotiation, providing low-latency real-time streaming. Students can select from multiple avatar identities and background environments. A sentence-tracking mechanism on the frontend synchronises text highlighting on the lesson page with the avatar's estimated speech progress, calculated from average speaking pace (130 words per minute).
>
> Additionally, a floating RAG-powered conversational chatbot is available on all lesson pages, allowing students to ask ad-hoc questions in Sinhala at any point. Questions are processed through the same RAG pipeline and SinLlama model, with all Q&A interactions persisted to MongoDB for subsequent teacher review.

---

## 9. SECTION III-H — Frontend Implementation

### 🟢 Change 11: Add dedicated frontend subsection (Supervisor feedback #1)
**Location:** After the new Section III-G, before Section IV. V8 has **no dedicated frontend section** (V7 had a brief Section III-H that V8 removed).

> [!IMPORTANT]
> The supervisor explicitly asked: *"You can elaborate more about web and mobile apps here, their purposes, end users of each, functions."* V8 removed the frontend section entirely. This must be re-added with more detail.

**Insert new subsection:**
> *H. Frontend Implementation*
>
> 1) *Web Application:* The primary web application is built using Next.js (React) with Tailwind CSS. It enforces role-based access control through JWT-based authentication with email verification. The student interface comprises the following modules: (a) subject enrollment and hierarchical sidebar navigation displaying subjects → lessons → topics with real-time completion indicators; (b) an adaptive learning flow with guided pre-quiz, lesson content delivery, and post-quiz pages; (c) the interactive AI Avatar teacher described in Section III-G; and (d) the RAG-powered conversational chatbot.
>
> 2) *Teacher/Admin Dashboard:* A dedicated analytics interface accessible via the web application. Teachers can: (a) view all registered students, (b) select a student to inspect enrolled subjects and per-subject lesson completion percentages, (c) drill into topic-level details showing initial quiz marks, final quiz marks, BKT mastery levels, and delivered content, and (d) review student Q&A history to identify common misconceptions.
>
> 3) *Mobile Application:* A companion mobile application built with Expo and React Native (TypeScript) provides a parent-facing interface for monitoring child progress, including subject-wise completion summaries and comparative rank tracking.
>
> 4) *Engagement Tracking:* The system logs detailed engagement session data including average, minimum, and maximum scores, session duration, and a timestamped timeline recording score changes and detected emotions at each checkpoint. This data is stored persistently and visualised on the teacher dashboard.

---

## 10. SECTION V — DISCUSSION (Lines 684–724)

### 🟡 Change 12: Add discussion of real-time per-answer adaptation
**Location:** After the third finding paragraph (RAG, line 713), before the limitations paragraph (line 714).

**Insert new paragraph:**
> Fourth, the per-answer online learning mechanism represents a practical advance over batch-mode knowledge tracing. By executing a lightweight BKT-LSTM-fusion pipeline for each individual student response, the system generates real-time adaptive signals — hint provision, difficulty adjustment, and remediation triggers — within a single quiz session. This within-session adaptation addresses a recognised limitation of existing ITS implementations, which typically update student models only after an entire assessment is completed [11].

---

### 🔴 Change 13: Update Avatar/TTS limitation to reflect current state
**Location:** Lines 718-724:
> `"Text-to-Speech (TTS), Automatic Speech Recognition (ASR) and Avatar-based interaction capabilities remain basic."`

**Replace with:**
> `"While the Gemini TTS integration produces high-quality synthesised Sinhala speech for the Avatar teacher, Automatic Speech Recognition (ASR) based voice input from students has not yet been implemented; all student interaction is currently text-based. Furthermore, the Avatar rendering pipeline depends on an external WebRTC service, introducing a dependency on network latency and third-party service availability."`

**Rationale:** TTS is no longer "basic" — it uses Gemini TTS (`gemini-2.5-flash-preview-tts`) in [tts_agent.py](file:///c:/Users/some1/Downloads/FYP_main_project/Sinhala-Teaching-AI-AVATAR/backend/agents/tts_agent.py). The real limitation is ASR (not yet implemented) and external service dependency.

---

## 11. SECTION VI — CONCLUSION (Lines 725–748)

### 🟡 Change 14: Add Avatar and per-answer adaptation to Conclusion
**Location:** After line 739 (`"...parent monitoring."`) and before the Future Work paragraph (line 740).

**Insert:**
> `"An interactive AI Avatar teacher powered by Gemini TTS and WebRTC-based video streaming delivers spoken Sinhala lesson explanations, while a per-answer online learning mechanism enables within-session adaptive difficulty adjustment and hint provision."`

---

### 🔴 Change 15: Update Future Work — TTS is now implemented
**Location:** Line 743:
> `"enhancing Sinhala TTS and ASR components"`

**Replace with:**
> `"extending the Gemini TTS-powered Avatar with ASR-based voice input for bidirectional spoken interaction"`

**Rationale:** TTS is implemented. Only ASR remains as future work.

---

## 12. TABLE IV — Ensemble Weight Sensitivity (Lines 654–683)

### 🔴 Change 16: Update Table IV to match α = 0.665
**Location:** Line 676: `"0.65 (selected)"`

V8's body text describes a two-stage grid search finding α = 0.665, but Table IV still shows `"0.65 (selected)"` — carried over from V7.

**Replace table row with:**
> `"0.665 (selected) | 56.2 | 0.49 | 0.60"`

Also consider adding a row for 0.70 to show the fine-grained search around the optimum.

---

## 13. DISCUSSION — α Consistency Fix

### 🔴 Change 17: Fix α value in Discussion
**Location:** Line 692:
> `"The weighted ensemble (0.65 PC-BKT + 0.35 LSTM)"`

**Replace with:**
> `"The weighted ensemble (α = 0.665 for PC-BKT, 1−α = 0.335 for LSTM)"`

---

## 14. MINOR WRITING FIXES

### 🔴 Change 18: Fix duplicate phrase in RAG section
**Location:** Line 309:
> `"grounded in verified in verified curriculum resources"`

**Replace with:**
> `"grounded in verified curriculum resources"`

---

### 🟢 Change 19: Fix grammatical issue in Introduction
**Location:** Lines 98-106 — awkward sentence structure:
> `"The absence of an Artificial Intelligence (AI) based educational system that (a) operates natively in the Sinhala medium, (b) strictly adheres to national syllabus content, (c) dynamically adapts to each student's evolving knowledge state, and (d) provides verifiable, curriculum-grounded responses rather than unchecked generative output, are the observations that point to the research gap."`

**Replace with:**
> `"The absence of an AI-based educational system that (a) operates natively in the Sinhala medium, (b) strictly adheres to national syllabus content, (c) dynamically adapts to each student's evolving knowledge state, and (d) provides verifiable, curriculum-grounded responses rather than unchecked generative output constitutes the research gap."`

---

## RE-EVALUATION CHECKLIST

After applying all changes, verify:

| # | Check | Status |
|---|---|---|
| 1 | **Typo "e5-bas" fixed** → "e5-base" in abstract | ☐ |
| 2 | **Duplicate "verified in verified" fixed** → single "verified" | ☐ |
| 3 | **Contributions list re-added** to Introduction | ☐ |
| 4 | **Architecture expanded** — 6 layers with role-specific frontend detail (Supervisor #1, #2) | ☐ |
| 5 | **Dual-mode retrieval documented** — document-order + similarity-ranked | ☐ |
| 6 | **α consistency resolved** — same value in body text, Table IV, and Discussion | ☐ |
| 7 | **LSTM→BKT feedback correction** — new subsection (d) with equation | ☐ |
| 8 | **Multi-agent count updated to 7** — all agents named and described (Supervisor #3) | ☐ |
| 9 | **Per-answer online learning** — Phase 2.5 with adaptive signals documented | ☐ |
| 10 | **Avatar Teacher section added** — Gemini TTS, WebRTC, AVTR-1, sentence tracking (Supervisor #3) | ☐ |
| 11 | **Frontend section re-added** — web/mobile/dashboard/engagement (Supervisor #1) | ☐ |
| 12 | **Discussion updated** — per-answer adaptation finding added | ☐ |
| 13 | **TTS limitation updated** — no longer "basic", ASR is the real gap | ☐ |
| 14 | **Conclusion updated** — Avatar + per-answer mentioned | ☐ |
| 15 | **Future Work updated** — TTS moved from future to implemented | ☐ |
| 16 | **Codebase α check** — paper α matches [personalization_agent.py](file:///c:/Users/some1/Downloads/FYP_main_project/Sinhala-Teaching-AI-AVATAR/backend/agents/personalization_agent.py) BKT_WEIGHT | ☐ |

> [!CAUTION]
> **Critical Decision Still Required:** The codebase has `BKT_WEIGHT = 0.7` while V8 now says α = 0.665. These differ. If 0.665 is the experimentally validated optimum from your grid search and 0.70 is just a rounded production value, document 0.665 in the paper and note that the production system uses a rounded value. Otherwise, re-run the sensitivity analysis.

> [!TIP]
> **Page count consideration:** V8 is 7 pages. Adding sections III-G (Avatar) and III-H (Frontend) plus expanding III-A and III-E will add approximately 1–1.5 pages. If the conference has a strict page limit (e.g., 6 or 8 pages), you may need to shorten the BKT equations section (III-D lines 352-401) since the standard BKT update equations are well-known and can be cited rather than fully reproduced.
