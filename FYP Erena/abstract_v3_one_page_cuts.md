# Abstract V3 → One Page: Exact Cuts

Your V3 overflows onto page 2 by about 15–20 lines. You need to cut approximately **120–130 words**. Below are **8 specific cuts** — each one shows the exact text to find and what to replace it with.

---

## CUT 1 — Avatar paragraph (save ~45 words) 🔴 BIGGEST SAVING

**FIND this entire block:**
> The system features an interactive 3D avatar teacher that operates as a live, real time streaming service over WebRTC, rendered via Three.js. The frontend first passes lesson content through the fine-tuned Sinhala model to generate a spoken style explanation, which is then transmitted to the avatar server as part of a WebRTC session request. The avatar server independently performs text-to-speech synthesis and lip-sync rendering with Whisper based alignment, then streams the resulting video and audio back to the browser live, with no pre-rendered file generation. A dedicated WebRTC data channel carries real time playback timing events from the server, enabling sentence level highlighting synchronized with the avatar's speech. The system supports multiple avatar characters and selectable backgrounds, with live playback-speed control and pause/resume functionality during sessions.

**REPLACE WITH:**
> The system features an interactive 3D avatar teacher rendered via Three.js and streamed live over WebRTC. The frontend passes lesson content through the fine-tuned Sinhala model to generate a spoken-style explanation, which is transmitted to the avatar server for real-time text-to-speech synthesis using Google Gemini TTS and lip-sync rendering via Whisper-based forced alignment. The resulting video and audio stream back to the browser live with sentence-level highlighting synchronized with the avatar's speech. The system supports multiple avatar characters, selectable backgrounds, playback-speed control, and pause/resume functionality.

**Why:** Removes redundant phrases ("no pre-rendered file generation", "dedicated WebRTC data channel carries real time playback timing events from the server") — the reader understands "streams live" implies no pre-rendering.

---

## CUT 2 — Component list introduction (save ~15 words)

**FIND:**
> Together, these components constitute a production-grade intelligent tutoring system designed to deliver personalized Sinhala medium education to students across Sri Lanka.

**REPLACE WITH:**
> Together, these components constitute a production-grade intelligent tutoring system for personalized Sinhala-medium education.

**Why:** "designed to deliver" and "to students across Sri Lanka" are filler.

---

## CUT 3 — SinLlama closing sentence (save ~20 words)

**FIND:**
> SinLlama-8B model was subsequently fine-tuned on instruction-following data to enhance its ability to generate pedagogically structured Sinhala explanations that closely replicate the clarity and coherence of human teaching.

**REPLACE WITH:**
> SinLlama-8B was subsequently fine-tuned on instruction-following data to generate pedagogically structured Sinhala explanations.

**Why:** "that closely replicate the clarity and coherence of human teaching" is subjective filler — not a measurable claim.

---

## CUT 4 — Agent list descriptions (save ~20 words)

**FIND:**
> The Orchestrator, which serves as the entry point and conditional router, the evaluator, responsible for grading and mastery classification, the personalization agent, which tailors content to individual learner profiles. The content generator agent, which produces RAG grounded lesson material. Quiz agent, dynamically generates assessments. The Explain Agent which simplifies concepts for avatar delivery, the Progress Tracker Agent, which logs and the Dashboard Agent, which aggregates learning analytics.

**REPLACE WITH:**
> The Orchestrator serves as the entry point and conditional router, coordinating the Evaluator (grading), Personalization Agent (learner profiling), Content Generator (RAG-grounded material), Quiz Agent (dynamic assessments), Explain Agent (avatar delivery), Progress Tracker (logging), and Dashboard Agent (analytics).

**Why:** Converts verbose sentence fragments into a compact parenthetical list. Also fixes grammar issues ("which logs and the Dashboard Agent" — incomplete sentence in V3).

---

## CUT 5 — Duplicate app description (save ~20 words)

**FIND:**
> The full system is accessible via a Next.js web application for students and teachers, a separate administrative portal and a mobile application. One web application for students and teachers, an administrative portal with an automated textbook digitization pipeline extract, chunks, and publishes national curriculum content to the learning backend via a secured REST API bridge.

**REPLACE WITH:**
> The full system is accessible via a Next.js web application for students and teachers, and a separate administrative portal with an automated textbook digitization pipeline that extracts, chunks, and publishes national curriculum content to the learning backend via a secured REST API bridge.

**Why:** "One web application for students and teachers" is a repeat of the sentence immediately before it. Also fixes grammar: "extract" → "extracts".

---

## CUT 6 — Hybrid-BKT paragraph (save ~8 words)

**FIND:**
> The optimal weighted ensemble fusion (BKT: 0.70, LSTM: 0.30), incorporating a guessing-detection correction mechanism ctivates when BKT-LSTM divergence exceeds δ = 0.20.

**REPLACE WITH:**
> The weighted ensemble fusion (BKT: 0.70, LSTM: 0.30) incorporates a guessing-detection correction mechanism that activates when BKT-LSTM divergence exceeds δ = 0.20.

**Why:** Also fixes two errors: "ctivates" → "activates" (typo), and "optimal" is removed since no optimality proof is presented.

---

## CUT 7 — RAG paragraph (save ~8 words)

**FIND:**
> National textbooks were digitized, paragraph-level chunking, and embedded using the multilingual-e5-base model into a ChromaDB vector store.

**REPLACE WITH:**
> National textbooks were digitized via paragraph-level chunking and embedded using multilingual-e5-base into a ChromaDB vector store.

**Why:** Fixes grammar ("paragraph-level chunking" was a dangling fragment) and removes "the" and "model" for conciseness.

---

## CUT 8 — YouTube line can stay on page 1

**KEEP as is:**
> Supplementary educational video resources are provided through integrated YouTube search with watch history logging.

This is fine — once the above cuts are applied, this line will fit on page 1.

---

## SUMMARY

| Cut | Section | Words Saved |
|---|---|---|
| 1 | Avatar paragraph | ~45 |
| 2 | Component list closing | ~15 |
| 3 | SinLlama closing sentence | ~20 |
| 4 | Agent list descriptions | ~20 |
| 5 | Duplicate app description | ~20 |
| 6 | Hybrid-BKT sentence | ~8 |
| 7 | RAG paragraph | ~8 |
| **Total** | | **~136 words** |

This should comfortably pull everything back to **one single page**.

---

## TYPOS/GRAMMAR ALSO FOUND IN V3

| Location | Error | Fix |
|---|---|---|
| Hybrid-BKT paragraph | "ctivates" | → "activates" |
| Hybrid-BKT paragraph | "The optimal weighted ensemble fusion...incorporating...ctivates" — broken sentence | → "The weighted ensemble fusion...incorporates...that activates" |
| RAG paragraph | "paragraph-level chunking" dangling | → "via paragraph-level chunking" |
| Apps paragraph | "extract, chunks" | → "extracts, chunks" (subject-verb agreement) |
| Apps paragraph | "One web application for students and teachers" | Delete — duplicate of previous sentence |
| Agent list | "which logs and the Dashboard Agent" | Incomplete — missing what it logs |
