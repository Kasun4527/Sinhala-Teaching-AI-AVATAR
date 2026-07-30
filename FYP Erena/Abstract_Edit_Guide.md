# Abstract Edit Guide — V1 → Corrected Version

This guide compares **Abstract V1 (from the PDF)** with the **actual system code** and your team's confirmed facts. For each paragraph, I state exactly what to **CHANGE**, **DELETE**, or **ADD**. No LaTeX needed — just follow the instructions and paste the corrected text.

---

## PARAGRAPH 1 — Introduction & Problem Statement

**Current Text:**
> "...national shortage over 30,000 qualified teachers...resulting in profoundly unequal learning opportunities...this final year project introduces..."

### ✅ KEEP:
- The shortage statistics (30,000 teachers, 50:1 ratio)
- The problem description (static platforms, LLMs lacking curriculum alignment)

### ❌ CHANGE:
| Issue | Fix |
|---|---|
| "this final year project introduces" | → **"this work presents"** — "final year project" is informal and incorrect for IEEE |
| "national shortage over 30,000" | → **"a national shortage of over 30,000"** — missing article |

---

## PARAGRAPH 2 — System Architecture Overview

**Current Text:**
> "...coordinating eight specialized agents. Orchestrator, Evaluator, Personalization, Content Generator, Quiz generator, Explainer, Progress Tracker, and Synchronization agent..."

### ❌ CHANGE:
| Issue | Fix |
|---|---|
| **"eight specialized agents"** | → **"seven specialized agents"** — your team confirmed: Orchestrator, Content Agent, Quiz Agent, Personalization Agent, Progress Tracker Agent, Dashboard Agent, Explain Agent. There is NO Synchronization/Align agent as a LangGraph node. |
| **"Synchronization agent"** in the list | → **DELETE it** from the agent list. Replace with **"Dashboard Agent"** since that IS an active agent. |
| Mid-list full stop: "...agents. Orchestrator..." | → Replace with **a colon**: "...agents: Orchestrator, Evaluator..." |
| "a 3D avatar teacher for delivers lessons in a same human like manner" | → **"a 3D avatar teacher that delivers lessons in a human-like manner"** |
| "this final year project" appears again | → **"this work"** |

### ➕ ADD:
The system component list says "seven" but only names 7 if we include Dashboard Agent instead of the Sync Agent. Make sure the count matches what's listed.

---

## PARAGRAPH 3 — SinLlama-8B / LLM

**Current Text:**
> "Prior to its selection, five Sinhala supporting LLMs were fine-tuned...SinLlama-8B achieved a ROUGE-1 score of 0.7714..."

### ✅ KEEP:
- All evaluation metrics (ROUGE-1, BERTScore, LLM-as-a-Judge) — these are verified from code/experiments.
- The comparison models list.

### ❌ CHANGE:
| Issue | Fix |
|---|---|
| "fine-tuned on instruction following data" (vague) | → **"subsequently fine-tuned on instruction-following data"** — add "subsequently" for logical flow |

### No other changes needed — this paragraph is the most accurate.

---

## PARAGRAPH 4 — Hybrid-BKT

**Current Text:**
> "...adaptively estimates student mastery level. This engine employs a weighted ensemble combining PC-BKT and LSTM-BKT..."

### ❌ CHANGE:
| Issue | Fix |
|---|---|
| **Missing key result** — the ensemble weight | → **ADD: "The ensemble achieves optimal mastery prediction at α = 0.665, incorporating a guessing-detection correction mechanism when model divergence exceeds δ = 0.20."** — This is the core technical result and should be in the abstract. |

### No deletions needed.

---

## PARAGRAPH 5 — RAG Pipeline

**Current Text:**
> "...dual-LLM architecture: fine-tuned SinLlama-8B handles curriculum grounded lesson content generation through RAG, while Llama-3.3-70B powers rapid agent orchestration."

### ✅ KEEP:
- All technical details (512-token chunks, 64-token overlap, multilingual-e5-base, ChromaDB)
- Dual-LLM architecture description

### ❌ CHANGE:
| Issue | Fix |
|---|---|
| "document order retrieval" | → **"document-order retrieval"** (add hyphen) |

### No deletions needed.

---

## PARAGRAPH 6 — Multi-Agent Architecture

**Current Text:**
> "...eight specialized agents...Speech synchronization agent, which manages whisper based forced alignment for Avatar speech synchronization."

### ❌ CHANGE — This paragraph needs the most correction:
| Issue | Fix |
|---|---|
| **"eight specialized agents"** | → **"seven specialized agents"** |
| **"Speech synchronization agent"** in the list | → **DELETE**. This agent (`align_agent.py`) is NOT a LangGraph node. It is a decoupled utility called directly from `main.py`. Replace it with **"Dashboard Agent, which aggregates learning analytics"** |
| **"Whisper based forced alignment for Avatar speech synchronization"** in agent descriptions | → DELETE this sentence entirely — it describes a decoupled utility, not a LangGraph agent. |
| "four-phase adaptive teaching lifecycle" is correct | → ✅ KEEP |

---

## PARAGRAPH 7 — Avatar, Engagement, App

**Current Text:**
> "An interactive 3D avatar teacher, rendered via Three.js and streamed through WebRTC, delivers spoken Sinhala explanations synthesized using Google Gemini TTS, with Whisper-based forced alignment enabling real-time lip synchronization..."

### ❌ CHANGE — Major corrections needed based on actual avatar architecture:

The description of the avatar is **technically wrong** based on how the real system works. Replace the avatar description with the following:

---
**NEW AVATAR TEXT TO USE:**

> The system features an interactive 3D avatar teacher that operates as a live, real-time streaming service over WebRTC. The frontend first passes lesson content through the fine-tuned Sinhala model to generate a spoken-style explanation, which is then transmitted to the avatar server as part of a WebRTC session request. The avatar server independently performs text-to-speech synthesis and lip-sync rendering, then streams the resulting video and audio back to the browser live, with no pre-rendered file generation. A dedicated WebRTC data channel carries real-time playback-timing events from the server, which the frontend uses to highlight the currently spoken section of the lesson in synchronization with the avatar's speech. The system supports multiple avatar characters and selectable backgrounds, with live playback-speed control and pause/resume functionality during sessions.

---

### Engagement Detection — CHANGE:
| Issue | Fix |
|---|---|
| The CNN description is correct but vague | → ✅ KEEP AS IS — space is limited |
| "two Next.js web applications" | → Check if this is still accurate. If admin portal and student portal are two separate Next.js apps, keep it. If it's one app with routing, change to **"a unified Next.js web application"**. |

### ➕ ADD at the end:
After the mobile app sentence, add the **YouTube integration** line since it's currently in the LaTeX version but MISSING from the V1 PDF abstract:
> *"The production system further integrates YouTube video search with watch-time logging for supplementary learning, and is fully containerized via Docker Compose for reproducible cloud deployment."*

---

## SUMMARY TABLE

| Paragraph | Action |
|---|---|
| P1 (Introduction) | Change "final year project" → "work"; fix grammar |
| P2 (Architecture Overview) | Change "eight agents" → "seven"; fix agent list (remove Sync, add Dashboard) |
| P3 (SinLlama-8B) | Minor: add "subsequently" — otherwise accurate |
| P4 (Hybrid-BKT) | ADD α=0.665 and δ=0.20 results |
| P5 (RAG) | Minor hyphen fix only |
| P6 (Agents) | Change "eight" → "seven"; remove Sync agent; add Dashboard Agent |
| P7 (Avatar + Engagement + App) | MAJOR: Replace avatar description with accurate WebRTC streaming description; add YouTube + Docker line |
