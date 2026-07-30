# Accurate System Architecture & Agent Breakdown Report

## I. Executive Summary
This report details the exact architectural state of the AI-Driven Personalized Sinhala Teaching Assistant, following a comprehensive deep dive and merge of the latest `kasun-dev` branch updates. It corrects previous misconceptions regarding the multi-agent architecture and provides a "1000% accurate" blueprint of how the system's LangGraph orchestration, auxiliary AI services, and recently updated agents function in the production environment.

---

## II. Clarification: The "Multi-Agent" Architecture

Previous documentation incorrectly stated that the system consisted of a single LangGraph coordinating eight agents. **This is factually inaccurate.** 

The system actually utilizes a **Hybrid Multi-Agent Pattern**, which divides the AI workload into two distinct categories:
1. **The Core Orchestration Graph (LangGraph)**: Manages the stateful flow of the student's learning lifecycle.
2. **Decoupled Service & Utility Agents**: Standalone AI modules that perform specialized tasks outside the main state graph, often serving specific API endpoints.

### 2.1 The Core Orchestration Graph (LangGraph)
Defined in `backend/agents/supervisor.py`, the core learning loop is governed by a LangGraph `StateGraph`. This graph passes a `LearningState` object (containing the student ID, topic, quiz scores, and mastery levels) between the following designated nodes:

*   **Orchestrator Node**: Acts as the conditional router. It examines the current `LearningState` and dynamically determines the next node in the graph (e.g., routing to evaluation if a quiz was just submitted, or content generation if mastery is low).
*   **Evaluator Node** (via `EvaluatorAgent`): Grades student quiz answers against the correct answers and assigns a raw score.
*   **Personalization Node** (via `PersonalizationAgent`): The heart of the adaptive system. It executes the Hybrid-BKT logic (combining PC-BKT and BKT-LSTM) to calculate the student's exact mastery level.
*   **Content Generator Node** (via `ContentGeneratorAgent`): Uses the RAG pipeline to fetch relevant textbook chunks from ChromaDB and generates a personalized lesson using the SinLlama-8B model.
*   **Progress Tracker Node** (via `ProgressTrackerAgent`): Persists the current state, quiz scores, and mastery levels into the MongoDB database.
*   **Decision Node**: A simple logic node that determines whether the student has achieved sufficient mastery (Score ≥ 6) to proceed to the next topic, or if they must repeat the current lesson.

### 2.2 Decoupled Service & Utility Agents
The remaining files in the `backend/agents/` directory are **not** nodes within the LangGraph. They are independent service agents that handle highly specialized, asynchronous, or frontend-triggered tasks:

*   **Quiz Agent** (`quiz_agent.py`): Called directly by FastAPI routes. It dynamically generates Sinhala MCQ quizzes using the Llama-3.3-70B model via Groq. **Recent `kasun-dev` Updates**: This agent now features advanced filtering to drop generated questions that reference unseeable textbook figures (e.g., "රූපය 5.36"), and includes an aggressive retry mechanism to ensure exactly 10 questions are generated, preventing malformed quizzes.
*   **Explain Agent** (`explain_agent.py`): A text-simplification agent. It is heavily utilized by the `ContentGeneratorAgent` to break down complex Sinhala paragraphs into easily spoken, pedagogical explanations suitable for TTS.
*   **TTS Agent** (`tts_agent.py`): Interfaces with the Google Gemini 2.5 Flash TTS API to generate 24kHz female voice audio from Sinhala text.
*   **Align Agent** (`align_agent.py`): Utilizes the `faster-whisper` library (running in Sinhala language mode on CPU) to extract word-level timestamps from the generated TTS audio. This is what enables the frontend 3D avatar to have synchronized lip movements and sentence-level text highlighting.
*   **Dashboard Agent** (`dashboard_agent.py`): An administrative data-aggregation agent. It bypasses the learning graph entirely to query MongoDB and compile analytics (progress, mastery, engagement) for the Teacher Dashboard.
*   **Adaptation / Student Agents** (`adaptation_agent.py`, `student_agent.py`): Simple, deterministic, rule-based threshold functions used as helpers.

---

## III. The 5 Core System Pillars (Updated & Verified)

With the agent architecture clarified, the overall system rests on five verified pillars:

### 1. Curriculum-Aligned LLM (SinLlama-8B)
*   **Function**: Generates the actual educational content.
*   **Status**: Fine-tuned via LoRA on 3,547 national syllabus QA pairs. Outperforms Qwen-14B, Llama-3.1-8B, and Mistral-7B in Sinhala semantic fidelity.
*   **Recent Update**: The `ContentGeneratorAgent` was updated in `kasun-dev` to include robust English-contamination checks. If the model accidentally code-switches to English mid-sentence, the agent intercepts it and falls back to the verified raw textbook context, ensuring the student never sees broken text.

### 2. RAG Pipeline
*   **Function**: Grounds the LLM in verified textbook facts.
*   **Status**: Uses `multilingual-e5-base` embeddings stored in ChromaDB (512-token chunks, 64-token overlap).
*   **Recent Update**: Minor Unicode spacing fixes were applied to the raw textbook `.txt` files in `kasun-dev` to ensure image tags (e.g., `[IMAGE: IMAGE_302.png]`) are parsed perfectly by the frontend without breaking the text flow.

### 3. Hybrid-BKT Engine
*   **Function**: Calculates student mastery dynamically.
*   **Status**: Combines PC-BKT (K-Means++) and BKT-LSTM. The optimal weighting is $\alpha=0.665$, with a guessing detection threshold of $\delta=0.20$.

### 4. Interactive AI Avatar & Speech Sync
*   **Function**: Delivers the lesson visually and audibly.
*   **Status**: The frontend renders a Three.js WebRTC stream. The backend uses the **TTS Agent** (Gemini) for voice and the **Align Agent** (Whisper) for exact timestamping, allowing the frontend to highlight text in sync with the spoken words.

### 5. Real-Time Student Engagement Engine
*   **Function**: Monitors student attention via webcam.
*   **Status**: Operates as a completely independent Flask microservice. It uses MediaPipe (Face Landmarks), a custom CNN (Emotion), EAR/MAR (Drowsiness/Yawning), Head Pose Estimation (Gaze), and YOLOv8 (Phone Detection) to generate a 0-100 continuous engagement score.

---

## IV. Conclusion

The Sinhala Teaching AI Avatar is a production-grade system employing a dual-orchestration strategy. It utilizes a stateful LangGraph for managing the core pedagogical learning loop (BKT evaluation and progression), while relying on a suite of decoupled Service Agents for dynamic quiz generation, speech synthesis, timestamp alignment, and real-time engagement detection. The recent merges from `kasun-dev` have significantly fortified the system by adding robust error handling, figure-reference filtering in quizzes, and English-contamination safeguards in the content generation pipeline.
