# 🎓 Sinhala-Teaching-AI-AVATAR: Deep Dive & Technical Analysis

As a Senior Software Lead Engineer, I have conducted a thorough deep dive into the `Sinhala-Teaching-AI-AVATAR` repository. This project is a sophisticated, AI-driven personalized e-learning platform specifically designed for Sinhala-medium secondary education (G.C.E O/L and A/L). 

Below is a comprehensive breakdown of the project's architecture, novel methodologies, technical implementation, and user flows.

---

## 🏗️ 1. High-Level System Architecture

The system employs a decoupled, modular architecture orchestrated by a multi-agent AI layer.

*   **Frontend (User Interface):** Built with React.js / Vite and Tailwind CSS. It serves student, teacher, and parent dashboards and features an interactive Avatar interface.
*   **Backend (REST API):** Developed using Python and FastAPI, serving as the central hub connecting the frontend to the database and AI engines.
*   **Database Layer:** Uses MongoDB (via Azure CosmosDB compatibility) for persistent state management (user profiles, enrollments, interaction logs, engagement tracking).
*   **Vector Database:** Local ChromaDB instance used for indexing curriculum-aligned educational content (textbook text and images).
*   **AI Agent Orchestration:** Powered by LangChain and LangGraph to manage stateful learning workflows and agent routing.
*   **External AI Services:**
    *   **Groq API (llama-3.3):** For rapid language model inference during dynamic content and quiz generation.
    *   **Custom Fine-tuned Sinhala LLM (SinLlama-7B):** Hosted externally (e.g., via Ngrok) for high-fidelity, curriculum-grounded Sinhala response generation.
    *   **Google Gemini TTS:** Powers the text-to-speech engine for the interactive AI Avatar.

---

## 🧠 2. Core Methodologies & Technical Novelties

The project stands out by addressing specific gaps in low-resource language educational tech using state-of-the-art AI.

### A. The Hybrid Personalization Engine (PC-BKT + LSTM)
Standard Bayesian Knowledge Tracing (BKT) assumes uniform priors across all students. This project introduces a highly novel **Hybrid-BKT engine**:
1.  **Personalized Clustered BKT (PC-BKT):** Groups students into behavioral clusters (High, Medium, Low ability) using **K-Means++ clustering** on a capability matrix. This dynamically sets personalized priors (Learn Rate, Guess Rate, Slip Rate) based on student interaction histories.
2.  **Temporal Modelling (BKT-LSTM):** A two-layer stacked LSTM network (128 units/layer) predicts future mastery trajectories based on BKT states, question difficulty, and attempt counts. It captures forgetting effects and non-monotonic learning behaviors.
3.  **Hybrid Fusion:** The final mastery score is a weighted ensemble: `(0.65 * PC-BKT) + (0.35 * LSTM)`. This maintains the pedagogical interpretability of BKT while leveraging the predictive power of deep learning.

### B. Curriculum-Grounded RAG Pipeline
To combat AI hallucinations, all generated content is constrained by a Retrieval-Augmented Generation (RAG) pipeline:
*   **Data Source:** Digitized Sinhala national textbooks (e.g., Grade 11 Buddhism).
*   **Embedding:** Uses `intfloat/multilingual-e5-base` to create 768-dimensional embeddings of 512-token document chunks.
*   **Mastery-Aware Prompting:** When retrieving context via ChromaDB, the student's current mastery level (Beginner/Intermediate/Advanced) is injected into the prompt, ensuring the fine-tuned SinLlama-7B model tailors the complexity of its Sinhala response.

---

## ⚙️ 3. Multi-Agent Orchestration (LangGraph)

Instead of a monolithic backend, the learning journey is driven by a decentralized multi-agent system managed by a `LangGraph StateGraph` supervisor (`learning_graph`).

*   **Orchestrator Node:** Routes data based on quiz type, scoring, and mastery progression.
*   **Evaluator Agent:** Grades student answers, updates the BKT states, and categorizes students into Beginner (<50%), Intermediate (50-85%), or Advanced (>85%).
*   **Content Generator Agent:** Triggers the RAG pipeline to generate personalized lessons tailored to the Evaluator's assigned tier.
*   **Quiz Agent:** Dynamically constructs quizzes aligned with Bloom's Taxonomy (Remember, Understand, Apply).
*   **Explain Agent:** Provides context-aware remediation and simplified explanations when students struggle.
*   **Progress Tracker Agent:** Logs interactions and mastery histories persistently into MongoDB.

---

## 🔄 4. User Learning Flows

### The Adaptive Assessment Cycle
1.  **Pre-Assessment (`/submit-pre-quiz/`):** Student takes an initial quiz. The Evaluator Agent calculates the baseline Hybrid Mastery.
2.  **Content Delivery (`/get-lesson/`):** If mastery is low, foundational content with heavy scaffolding is generated. If high, enrichment material is provided.
3.  **Real-Time Online Learning (`/submit-answer/`):** As the student answers questions, an incremental BKT update occurs per answer. The system generates real-time adaptive signals (`hint_required`, `adapt_difficulty`).
4.  **Post-Assessment (`/submit-post-quiz/`):** The student takes a follow-up quiz. If the threshold (≥ 0.85) is met, they advance; otherwise, they receive remedial content and repeat the cycle.

### Ad-Hoc Q&A Workflow (`/ask-question`)
Students can ask open-ended questions. The backend retrieves the top 5 relevant document chunks from ChromaDB and sends them, along with the student's question, to the custom Fine-tuned SinLlama-7B endpoint to generate an accurate, localized response.

---

## 🌿 5. DevOps & Deployment Strategy

The project implements a mature branch management strategy to separate local development from cloud deployment:

*   **`main` Branch (Local Dev):** Optimized for seamless local execution. Utilizes SQLite-based local ChromaDB and `os.getenv` fallbacks. Recent upgrades include wrapping LangGraph invocations in `asyncio.to_thread` to prevent FastAPI from blocking under load.
*   **`production` Branch (Cloud Setup):** Strictly configured for cloud environments (DigitalOcean/Azure). 
    *   Enforces strict CORS origins (`learnsinhala.lk`).
    *   Uses a `Dockerfile` for containerized deployment.
    *   Switches ChromaDB to `HttpClient` mode to connect to a dedicated remote vector database droplet.
    *   Removes all local `.env` and `__pycache__` garbage, relying on Cloud UI for environment variable injection.

---
**Conclusion:** 
The `Sinhala-Teaching-AI-AVATAR` is a highly advanced piece of educational technology. By seamlessly merging deterministic Bayesian probability with deep learning predictions, and grounding Sinhala LLM generations in a robust multi-agent RAG architecture, it represents a significant leap forward for personalized, low-resource language education.
