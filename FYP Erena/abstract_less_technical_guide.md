# Abstract Edit Guide: Removing Technical Jargon

Your supervisor is right — the abstract is still cluttered with specific framework names and algorithms (like LoRA, ChromaDB, Three.js, Next.js). These belong in the **Methodology** section of your paper, not the abstract.

Here are the exact edits to make to your text to strip out the heavy jargon and reduce the word count.

### ✂️ CUT 1: Remove DB names (Paragraph 1)
**Find:** `pipeline with ChromaDB for a secure lesson retrieval`
**Replace with:** `pipeline for secure lesson retrieval`
*(Why: The specific database doesn't matter in the abstract.)*

### ✂️ CUT 2: Remove Fine-tuning algorithms (Paragraph 2)
**Find:** `fine-tuned using Low-Rank Adaptation on a custom national curriculum data set and instruction-following data`
**Replace with:** `fine-tuned on a custom national curriculum dataset`
*(Why: "Low-Rank Adaptation" and "instruction-following data" are implementation details.)*

### ✂️ CUT 3: Remove BKT specifics (Paragraph 2)
**Find:** `combining PC-BKT with a single layer LSTM-BKT and K-Means clustering`
**Replace with:** `combining statistical models with deep learning`
*(Why: Lists of algorithms are too deep for an abstract. Keep it high-level.)*

### ✂️ CUT 4: Remove Ensemble Weights (Paragraph 2)
**Find:** `using a weighted ensemble fusion (BKT: 0.70, LSTM: 0.30).`
**Replace with:** `using a weighted ensemble fusion.`

### ✂️ CUT 5: Remove Embedding models & DBs (Paragraph 2)
**Find:** `embedded using multilingual-e5-base into ChromaDB, with a dual LLM architecture using SinLlama-8B for curriculum grounded content and Llama-3.3-70B for agent orchestration.`
**Replace with:** `employing a dual-LLM architecture for curriculum-grounded content and agent orchestration.`
*(Why: The embedding model and vector DB are assumed parts of RAG. You don't need to name them here.)*

### ✂️ CUT 6: Remove Frontend frameworks (Paragraph 3)
**Find:** `rendered via Three.js streams live over WebRTC with Google Gemini TTS, and Whisper-based`
**Replace with:** `streams live with Google Gemini TTS and Whisper-based`

### ✂️ CUT 7: Remove App frameworks (Paragraph 3)
**Find:** `via a Next.js web application, a separate administrative portal with automated textbook digitization via REST API`
**Replace with:** `via a web application, a separate administrative portal with automated textbook digitization`

---

## ✅ The Clean, Non-Technical Version (~315 words)

*(This reads much more professionally for an abstract and saves ~40 words!)*

Sri Lanka faces a critical national shortage of over 30,000 qualified teachers with student-to-teacher ratios exceeding 50:1, limiting educational access for General Certificate of Education Ordinary Level and Advanced Level students [1]. Existing digital platforms provide static, prerecorded content and lack adaptive personalization, while general purpose Large Language Models lack Sri Lankan curriculum alignment. To address this gap, this final year project presents an Artificial Intelligence (AI) driven Sinhala teaching assistant that adheres to the national syllabus and dynamically adapts to each student's knowledge state. The system integrates seven core components: a curriculum-aligned Sinhala LLM (SinLlama-8B), a Hybrid Bayesian Knowledge Tracing (Hybrid-BKT) personalization engine, a Retrieval-Augmented Generation (RAG) pipeline for secure lesson retrieval, a multi-agent AI architecture, a computer-vision-based Student Engagement Detection Engine, a 3D avatar teacher delivering lessons in a human-like manner with synchronized lip movements and natural voice variations, and an administrative portal with automated textbook digitization.

SinLlama-8B [2] is used as the Sinhala supporting LLM, fine-tuned on a custom national curriculum dataset to ensure pedagogically accurate, structured and syllabus-aligned Sinhala explanations. The Hybrid-BKT engine adaptively estimates student mastery levels by combining statistical models with deep learning to profile student mastery. This enables the system to deliver personalized lessons to the student. The engine performs real-time per-answer mastery updates using a weighted ensemble fusion. To prevent AI hallucinations and deliver accurate lessons, the RAG pipeline digitizes national textbooks via paragraph-level chunking, employing a dual-LLM architecture for curriculum-grounded content and agent orchestration. These processes are orchestrated by a multi-agent architecture that coordinates specialized AI agents to govern a continuous, four-phase adaptive teaching lifecycle: pre-assessment, lesson generation and delivery, post-assessment, and continuous adaptation. A RAG-powered Q&A chatbot allows students to ask curriculum-scoped questions, complemented by integrated YouTube search to access additional resources with logging. 

An interactive 3D avatar teacher streams live with Google Gemini TTS and Whisper-based lip synchronization to ensure human-like behaviour. Simultaneously, a Student Engagement Detection Engine utilizes computer vision to analyse facial cues, head pose, and phone usage, allowing the system to monitor attentiveness and detect distraction. The system is accessible via a web application, a separate administrative portal with automated textbook digitization, and a dedicated mobile application for parents to monitor their child's academic progress in real-time.
