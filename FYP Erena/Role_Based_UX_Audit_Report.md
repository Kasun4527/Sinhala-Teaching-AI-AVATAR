# Role-Based UX & Flow Audit Report

## I. Executive Summary
This document provides a human-centric product audit of the Sinhala Teaching AI Avatar platform. Examining the system from the specific viewpoints of the **Student**, **Teacher**, **Parent**, and **Admin** reveals several UX (User Experience) red flags, workflow bottlenecks, and missing features that undermine the system's effectiveness as an educational tool. 

For each issue identified, a concrete product solution is provided.

---

## II. The Student Perspective
*The learning journey, motivation, and interface interaction.*

### 1. The Cold Start Penalty (Severity: High)
*   **The Flaw:** When a student enrolls in a completely new topic, the system immediately forces them to take a 10-question Pre-Quiz (via `generate_quiz("pre")`) before delivering any educational content. If the student has zero prior knowledge, failing 10 questions sequentially is highly demoralizing and creates a negative initial user experience.
*   **The Solution:** Implement a "Knowledge Check Skip" or an "I'm completely new to this" button. If the student opts out, the system should bypass the Pre-Quiz, default their BKT Mastery to `0.1` (Beginner), and immediately start the Avatar lesson.

### 2. Engagement Engine False Positives (Severity: Medium)
*   **The Flaw:** The webcam-based engagement engine classifies "looking away" (Head Pose) or "looking down" as disengagement. In a real-world learning scenario, a highly engaged student taking physical notes in a book will trigger a "Not Engaged" penalty, potentially forcing the system to unnecessarily repeat lessons or flag the student to teachers.
*   **The Solution:** Introduce a "Note-Taking Mode" toggle in the UI. When activated, the engagement engine should temporarily reduce the weighting of Head Pose (gaze tracking) and rely heavier on Emotion (CNN) and Drowsiness (EAR/MAR) to calculate the engagement score.

### 3. Avatar Interaction Inflexibility (Severity: High)
*   **The Flaw:** The 3D Avatar delivers lessons sequentially. If a student gets confused mid-sentence, they cannot naturally interrupt the Avatar. They must wait, navigate to a separate Q&A Chatbot UI, type their question, and read the answer. This breaks the immersion of a "human-like teacher."
*   **The Solution:** Add a "Raise Hand / Pause" button (or voice command trigger) that halts the WebRTC Avatar stream. Integrate the `ask-question` endpoint directly into the Avatar's UI so the Avatar itself speaks the answer to the student's question before resuming the main lesson.

---

## III. The Teacher Perspective
*Class management, content updates, and actionable insights.*

### 1. Missing Granular Class Management (Severity: Critical)
*   **The Flaw:** The `/admin/students` endpoint fetches all students in the database. In a real school, a teacher only cares about *their* students. A teacher cannot group students into specific cohorts (e.g., "Grade 11-A" vs "Grade 11-B").
*   **The Solution:** Update the MongoDB schema to include `class_id` and `teacher_id` arrays in the `User` model. Update the dashboard API to filter students based on the logged-in Teacher's assigned classes.

### 2. Content Upload Bottleneck (Severity: High)
*   **The Flaw:** The abstract claims an "administrative portal for lesson management with automated text extraction." However, the repository only contains Python scripts (`extract_pdf.py`) for this task. Teachers cannot upload a new PDF syllabus directly through the UI; they must rely on developers to run scripts and update ChromaDB.
*   **The Solution:** Build a dedicated `/admin/upload-syllabus` endpoint in `main.py` that accepts PDF uploads via FastAPI's `UploadFile`. This endpoint should trigger the extraction script, chunk the text, and insert it into ChromaDB asynchronously directly from the Teacher Dashboard UI.

### 3. Alert Fatigue from Raw Data (Severity: Medium)
*   **The Flaw:** Showing raw engagement scores (0-100) or BKT $\alpha$ values to teachers is overwhelming. Teachers do not have time to analyze raw data streams for 40 students to figure out who needs help.
*   **The Solution:** Implement a "Needs Attention" alert widget. The Dashboard Agent should process the raw data and generate plain-text alerts (e.g., *"Kasun failed the Post-Quiz 3 times and showed high Drowsiness; intervention recommended."*).

---

## IV. The Parent Perspective
*Progress monitoring and child well-being.*

### 1. Missing Mobile App & Linking Auth (Severity: Critical)
*   **The Flaw:** The system architecture document references a "React Native mobile application" for parents, but the codebase lacks this frontend. More critically, the backend `main.py` has no mechanism to securely link a Parent account to a Student account.
*   **The Solution:** 
    *   **Backend:** Create a `/auth/generate-pairing-code` endpoint for the Student, and a `/auth/link-student` endpoint for the Parent.
    *   **Frontend:** Until the React Native app is built, build a responsive "Parent View" into the existing Next.js web application.

### 2. Harmful Data Exposure (Severity: High)
*   **The Flaw:** Exposing raw webcam-derived engagement data (e.g., "Not Engaged for 20 minutes") to parents can cause unnecessary friction at home and feels like surveillance rather than support.
*   **The Solution:** The Parent Dashboard should only display high-level, constructive summaries (e.g., "Kasun completed 3 topics today" or "Kasun is struggling with Photosynthesis"). Engagement metrics should be abstracted into positive reinforcements (e.g., "Great focus today!").

---

## V. The System Admin Perspective
*Scalability, deployment, and cost.*

### 1. Zero Content Caching (API Cost Burn) (Severity: Critical)
*   **The Flaw:** Every time a student requests a lesson, the system queries the Groq API (LLM) and Gemini (TTS) from scratch. If 50 "Beginner" students request the "Photosynthesis" lesson, the exact same text and audio are generated 50 times, wasting immense API credits and latency.
*   **The Solution:** Implement **Redis Caching**. When a lesson is generated for a specific `subject + topic + level`, the resulting text and TTS WAV file URL should be cached. Subsequent requests should serve the cached version instantly.

### 2. Fragile Ngrok Dependency (Severity: High)
*   **The Flaw:** The fine-tuned SinLlama model (used by the Q&A bot) relies on a hardcoded Ngrok tunnel URL (`FINETUNED_URL`). Ngrok URLs change dynamically and drop connections, which is unacceptable for a highly available production system.
*   **The Solution:** Host the fine-tuned SinLlama-8B model on a dedicated inference server (e.g., AWS EC2 with vLLM, or RunPod) behind a stable static IP or domain name.

---

## VI. Conclusion
By shifting the audit perspective from raw code to user roles, several critical UX flaws emerge. Addressing the Student's "Cold Start Penalty", the Teacher's "Class Management", and the Admin's "Caching" issues will transform this project from a technical demonstration into a truly viable, scalable, and user-friendly educational product.
