# 🔍 Discrepancy Analysis: Old Research Paper vs. Current Implementation

Based on my deep dive into the current project codebase (`backend/main.py`, `README.md`, `production_branch_guidelines.md`) and the old research paper (`Final_Conference_Paper.md`, `AI-Based Sinhala Assistant_V7.pdf`), I have identified several major discrepancies. 

The project has evolved significantly since the paper was written. Here is a detailed breakdown of what has changed, been added, or implemented differently.

---

## 1. Vector Database: FAISS vs. ChromaDB
*   **Old Paper Claim:** States that the RAG pipeline uses **FAISS** (Facebook AI Similarity Search) to index textbook content (Section III-D).
*   **Current Reality:** The codebase explicitly uses **ChromaDB**. The `main.py` and production guidelines discuss configuring `chromadb.PersistentClient` for local development and `chromadb.HttpClient` for cloud production. 
*   **Action for Next Paper:** Update all references from FAISS to ChromaDB.

## 2. LLM Strategy: Single Model vs. Hybrid API Approach
*   **Old Paper Claim:** Implies that the fine-tuned **SinLlama-7B** is used for all content generation across the board (content, quizzes, etc.).
*   **Current Reality:** The system uses a hybrid approach. 
    *   **Groq API (llama-3.3):** Used for general rapid generation (Content Agent, Quiz Agent).
    *   **Fine-tuned Sinhala Model (via Ngrok):** Specifically routed for the RAG-powered Q&A endpoint (`/ask-question`) where high Sinhala fidelity and curriculum constraints are required.
*   **Action for Next Paper:** Acknowledge this dual-LLM architecture. Using Groq for backend orchestration/structuring and the fine-tuned model for student-facing RAG is a massive architectural improvement for speed and cost.

## 3. Multi-Agent Architecture Expansion
*   **Old Paper Claim:** Lists only four agents: Orchestrator, Evaluator, Content Generator, and Progress Tracker.
*   **Current Reality:** The LangGraph implementation has expanded significantly. The codebase now includes:
    *   `Personalization Agent` (handles BKT-LSTM updates)
    *   `Quiz Agent` (handles quiz generation)
    *   `Explain Agent` (provides simplified explanations via `/explain-content/`)
    *   `TTS Agent` (Text-to-Speech)
    *   `Decision Agent / Adaptation Agent` (`decide_next_step`)
    *   `Dashboard Agent` (Teacher/Admin analytics)
*   **Action for Next Paper:** Expand the Multi-Agent Orchestration section to include these new specialized agents, emphasizing how LangGraph routes between them.

## 4. Real-Time "Per-Answer" Adaptive Assessment (Online Learning)
*   **Old Paper Claim:** The assessment cycle relies entirely on a "Pre-Quiz" and "Post-Quiz" phase to evaluate mastery and assign tiers.
*   **Current Reality:** The codebase includes a powerful new feature (labeled `Bug #10: Single answer submission model for per-answer online learning`). The `/submit-answer/` endpoint performs an **incremental BKT update for a single answer**. 
    *   It generates real-time adaptive signals like `hint_required` and `adapt_difficulty`.
*   **Action for Next Paper:** This is a huge methodological novelty! You are no longer just doing batch updates at the end of a quiz; you are doing real-time, per-interaction mastery updates. This needs a dedicated section.

## 5. Text-to-Speech (TTS) Integration
*   **Old Paper Claim:** Mentions TTS, ASR, and Avatar capabilities as "basic" or "future work" in the Limitations section.
*   **Current Reality:** The codebase has a fully functioning `/generate-tts/` endpoint powered by **Google Gemini TTS**, producing WAV audio for the interactive teacher Avatar.
*   **Action for Next Paper:** Move TTS from "Future Works" to "Implemented Features" and discuss the multimodal learning experience (Text + Audio Avatar).

## 6. Engagement & Emotion Tracking
*   **Old Paper Claim:** The Progress Tracker maintains "interaction logs and mastery histories."
*   **Current Reality:** The `EngagementSession` model in `main.py` tracks much more, including `duration_seconds` and a `timeline` that logs `{"time": "HH:MM:SS", "score": float, "emotion": str}`. 
*   **Action for Next Paper:** If emotion detection (likely from the frontend Avatar interactions) is actively being logged, this is a major addition to the student modeling capability. 

## 7. Cloud/DevOps Maturity (Async & Docker)
*   **Old Paper Claim:** Focuses mostly on the theoretical model and offline metrics.
*   **Current Reality:** The project has matured into a production-ready application.
    *   Endpoints have been migrated to `asyncio` (`await asyncio.to_thread`) to prevent blocking the FastAPI server during heavy LangGraph/LSTM inferences.
    *   MongoDB is deployed via Azure CosmosDB compatibility.
    *   Docker and environment variable abstraction have been implemented for cloud deployment.
*   **Action for Next Paper:** Add a brief "System Deployment and Scalability" sub-section in the Methodology to highlight the async orchestration and cloud readiness.

---
**Summary for Paper Revision:**
The old paper accurately describes the *core mathematical engine* (Hybrid-BKT) and the *initial concept* (RAG). However, the actual codebase has evolved into a much more complex, asynchronous, hybrid-LLM, multi-agent system with real-time per-answer adaptation and TTS Avatar integration. 

Updating the paper with these new implementations will significantly strengthen the system's perceived technical depth.
