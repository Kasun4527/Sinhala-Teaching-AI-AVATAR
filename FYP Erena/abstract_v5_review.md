# Abstract V5 — Review & Suggestions

**Word count**: ~420 words (body only, excluding title/authors/references)
**Target**: ~350 words | **Still need to cut**: ~70 words
**Pages**: Overflows to page 2 (references spill over)

---

## 🔴 GRAMMAR & TYPO FIXES (Must Fix)

| # | Current Text | Fix | Issue |
|---|---|---|---|
| 1 | "...Sinhala explanations.**Hybrid** Bayesian" | Add space before "Hybrid" | Missing space between sentences |
| 2 | "...correction mechanism.**The** RAG pipeline" | Add space before "The" | Missing space between sentences |
| 3 | "ChromaDB**. with** a dual LLM" | → "ChromaDB**,** with a dual LLM" | Period should be comma (same sentence) |
| 4 | "coordinates seven agents**. Orchestrator**" | → "coordinates seven agents**:** Orchestrator" | Should be colon, not period — it's a list |
| 5 | "Dashboard **agent** governing" | → "Dashboard — governing" | "agent" breaks the parallel list; add dash |
| 6 | "This engine combines PC-BKT with a single layer LSTM-BKT. **This enables** K-Means clustering **students**" | → "combining PC-BKT with a single-layer LSTM (200 hidden units) and K-Means clustering **for learner** profiling" | "This enables K-Means clustering students" is awkward grammar + "This...This" repetition |

---

## 📝 STUDENT TONE ADJUSTMENTS

Your V5 sometimes reads like a product brochure. For a student FYP/research paper, use **humble, factual, evidence-based** language:

| Current (product tone) | → Suggested (student tone) | Why |
|---|---|---|
| "To bridge this gap, this work introduces" | "To address this gap, this work presents" | "introduces" sounds like a product launch; "presents" is standard academic phrasing |
| "SinLlama-8B model was subsequently fine-tuned on instruction-following data **to enhance its ability to generate** pedagogically structured Sinhala explanations" | **DELETE this sentence entirely** | This is already implied by the LoRA fine-tuning description above it. Saves ~20 words. |
| "The engine supports real time per-answer mastery updates" | "The engine performs real-time per-answer mastery updates" | "supports" sounds like a product feature spec |
| "A RAG-powered Q&A chatbot **enables** students to ask" | "A RAG-powered Q&A chatbot **allows** students to ask" | Slightly less marketing-flavored |

---

## ✂️ SPECIFIC CUTS TO REACH ~350 WORDS

### Cut 1 — Delete SinLlama closing sentence (save ~20 words)
**DELETE:**
> SinLlama-8B model was subsequently fine-tuned on instruction-following data to enhance its ability to generate pedagogically structured Sinhala explanations.

**Why**: This is a secondary detail already covered by "fine-tuned using LoRA on a custom national curriculum data set." Move to paper body if needed.

---

### Cut 2 — Compress Hybrid-BKT intro (save ~15 words)
**FIND:**
> Hybrid Bayesian Knowledge Tracing (Hybrid-BKT) personalization engine that adaptively estimates student mastery level. This engine combines PC-BKT with a single layer LSTM-BKT. This enables K-Means clustering students into mastery levels for personalization.

**REPLACE WITH:**
> The Hybrid-BKT engine combines PC-BKT with a single-layer LSTM (200 hidden units) and K-Means clustering for learner profiling.

**Why**: "adaptively estimates student mastery level" repeats what "personalization engine" already means. "This enables...this" is repetitive.

---

### Cut 3 — Compress RAG paragraph opening (save ~10 words)
**FIND:**
> The RAG pipeline grounds the LLM in verified educational material. National textbooks were digitized via paragraph level chunking, and embedded using multilingual-e5-base into ChromaDB.

**REPLACE WITH:**
> The RAG pipeline digitizes national textbooks via paragraph-level chunking embedded using multilingual-e5-base into ChromaDB.

**Why**: "grounds the LLM in verified educational material" repeats what was already said in P1's component list.

---

### Cut 4 — Tighten agent list (save ~5 words)
**FIND:**
> Orchestrator, Evaluator, Personalization, Content Generator, Quiz, Explain, Progress Tracker, and Dashboard agent governing a four-phase adaptive teaching lifecycle.

**REPLACE WITH:**
> Orchestrator, Evaluator, Personalization, Content Generator, Quiz, Explain, Progress Tracker, and Dashboard — governing a four-phase adaptive teaching lifecycle.

---

### Cut 5 — Combine YouTube with Q&A line (save ~5 words)
**FIND:**
> A RAG-powered Q&A chatbot enables students to ask curriculum scoped questions in Sinhala and integrated YouTube search with watch-history logging.

**REPLACE WITH:**
> A RAG-powered Q&A chatbot allows students to ask curriculum-scoped questions, complemented by integrated YouTube search with watch-history logging.

**Why**: "in Sinhala" is already established. Current sentence has broken grammar ("and integrated YouTube search" is a dangling fragment).

---

## TOTAL SAVINGS

| Cut | Words Saved |
|---|---|
| SinLlama closing sentence | ~20 |
| Hybrid-BKT compression | ~15 |
| RAG opening | ~10 |
| Agent list tighten | ~5 |
| YouTube/Q&A fix | ~5 |
| **Total** | **~55-70 words** |

This brings you from ~420 → **~350-365 words** ✅

---

## ✅ REVISED V5 DRAFT (3 paragraphs, ~355 words, student tone)

Sri Lanka faces a critical national shortage of over 30,000 qualified teachers with student-to-teacher ratios exceeding 50:1 [1], limiting educational access for General Certificate of Education Ordinary Level and Advanced Level students [2]. Existing digital platforms provide static, prerecorded content and lack adaptive personalization, while general-purpose Large Language Models lack Sri Lankan curriculum alignment. To address this gap, this work presents an AI-driven Sinhala teaching assistant that adheres to the national syllabus and dynamically adapts to each student's knowledge state. The system integrates seven core components: a curriculum-aligned Sinhala LLM (SinLlama-8B), a Hybrid Bayesian Knowledge Tracing (Hybrid-BKT) personalization engine, a Retrieval-Augmented Generation (RAG) pipeline with ChromaDB, a LangGraph-orchestrated multi-agent architecture, a computer-vision-based Student Engagement Detection Engine, a 3D avatar teacher with lip synchronization, and an administrative portal with automated textbook digitization.

Five Sinhala-supporting LLMs were fine-tuned using Low-Rank Adaptation (LoRA) on a custom national curriculum dataset. SinLlama-8B achieved a ROUGE-1 score of 0.7714, BERTScore of 0.9424, and an LLM-as-a-Judge score of 15.88/20, outperforming Qwen-14B, Llama-3.1-8B, DeepSeek-14B, and Mistral-7B. The Hybrid-BKT engine combines PC-BKT with a single-layer LSTM (200 hidden units) and K-Means clustering for learner profiling, performing real-time per-answer mastery updates with weighted ensemble fusion (BKT: 0.70, LSTM: 0.30) incorporating a guessing-detection correction mechanism. The RAG pipeline digitizes national textbooks via paragraph-level chunking embedded using multilingual-e5-base into ChromaDB, with a dual-LLM architecture using SinLlama-8B for curriculum-grounded content and Llama-3.3-70B for agent orchestration. A LangGraph-orchestrated architecture coordinates seven agents: Orchestrator, Evaluator, Personalization, Content Generator, Quiz, Explain, Progress Tracker, and Dashboard — governing a four-phase adaptive teaching lifecycle. A RAG-powered Q&A chatbot allows students to ask curriculum-scoped questions, complemented by integrated YouTube search with watch-history logging.

An interactive 3D avatar teacher rendered via Three.js streams live over WebRTC with Google Gemini TTS and Whisper-based lip synchronization. A Student Engagement Detection Engine uses MediaPipe, a custom CNN, EAR/MAR analysis, head pose estimation, and YOLOv8 phone detection to classify engagement into four levels. The system is accessible via a Next.js web application, a separate administrative portal with automated textbook digitization via REST API, and a React Native mobile app for parental monitoring.
