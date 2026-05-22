"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import {
  getPreQuiz,
  getPostQuiz,
  submitPreQuiz,
  submitPostQuiz,
} from "@/services/api";
import { normalizeSinhalaText } from "@/utils/sinhalaConverter";
import { bktService } from "@/services/bktService";

export default function QuizPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const subject = searchParams.get("subject");
  const lesson = searchParams.get("lesson");
  const topic = searchParams.get("topic");
  const level = searchParams.get("level") || "Beginner";
  const type = searchParams.get("type") || "pre";

  const [quiz, setQuiz] = useState({ questions: [] });
  const [answers, setAnswers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const subjectColors = {
    Physics: "#2563eb",
    Chemistry: "#16a34a",
    Biology: "#059669",
    Maths: "#9333ea",
    Buddhism: "#d97706",
  };
  const accent = subjectColors[subject] || "#2563eb";

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }
    if (!subject || !lesson) {
      setLoading(false);
      return;
    }

    const fetchQuiz = async () => {
      try {
        setLoading(true);
        const res =
          type === "post"
            ? await getPostQuiz(subject, lesson, topic, level)
            : await getPreQuiz(subject, lesson, topic);
        const data = res?.data || {};

        // Log quiz data for debugging
        console.log("📝 Quiz loaded:", {
          subject,
          lesson,
          topic: topic || "(combined)",
          questionsCount: data.quiz?.questions?.length || 0,
          firstQuestion: data.quiz?.questions?.[0]?.question?.substring(0, 50),
          kc_ids: data.quiz?.questions?.map((q) => q.kc_id),
        });

        setQuiz(data.quiz || data || { questions: [] });
        setAnswers([]);
      } catch (err) {
        console.error("❌ Quiz load error:", err);
        setQuiz({ questions: [] });
      } finally {
        setLoading(false);
      }
    };
    fetchQuiz();
  }, [subject, lesson, topic, level, type]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const correctAnswers = quiz.questions.map(
        (q) => q.correct_answer || q.answer,
      );
      const studentId = localStorage.getItem("student_id");

      // For lesson-level quizzes (no topic), collect all KC IDs
      const kcIds = [
        ...new Set(quiz.questions.map((q) => q.kc_id).filter(Boolean)),
      ];
      const lessonNum = lesson?.includes("2") ? 2 : 1;

      console.log("🎯 Quiz Submission Details:", {
        subject,
        lesson,
        topic: topic || "(combined)",
        studentId,
        questionCount: quiz.questions.length,
        kcIds: kcIds.length > 0 ? kcIds : "N/A",
        answerCount: answers.length,
        studentAnswers: answers,
        correctAnswers: correctAnswers,
      });

      const payload = {
        subject,
        lesson,
        lesson_num: lessonNum,
        topic,
        level,
        student_answers: answers,
        correct_answers: correctAnswers,
        student_id: studentId,
        kc_ids: kcIds.length > 0 ? kcIds : null, // Pass KC IDs if available
      };

      // Log BKT masteries snapshot before submitting
      try {
        if (studentId) {
          const mastery = await bktService.fetchMastery(studentId);
          console.log(
            "[BKT] 📊 Snapshot BEFORE submission:",
            mastery?.kc_states || mastery,
          );
          // Log per-question KC params
          for (let i = 0; i < quiz.questions.length; i++) {
            const q = quiz.questions[i];
            const kcId = q.kc_id || topic;
            console.log(
              `[BKT] Q${i + 1} KC ${kcId}:`,
              mastery?.kc_states?.[kcId],
            );
          }
        }
      } catch (e) {
        console.error("[BKT] fetch before submit failed:", e);
      }

      if (type === "post") {
        const res = await submitPostQuiz(payload);
        console.log("📩 Post-quiz response:", res?.data);

        // Check mastery AFTER submission
        try {
          const masteryAfter = await bktService.fetchMastery(studentId);
          console.log(
            "[BKT] 📊 Snapshot AFTER submission:",
            masteryAfter?.kc_states || masteryAfter,
          );
          console.log("[BKT] 🔄 Changes detected:", {
            before: "see above",
            after: "see above",
          });
        } catch (e) {
          console.error("[BKT] fetch after submit failed:", e);
        }

        router.push(
          `/result?score=${res?.data?.score || 0}&level=${res?.data?.level || "Beginner"}&topic=${topic || lesson}&type=post&subject=${subject}&lesson=${lesson}&bkt_feedback=${encodeURIComponent(res?.data?.bkt_feedback || "")}`,
        );
      } else {
        // Pre-quiz submission
        const res = await submitPreQuiz(payload);
        console.log("📩 Pre-quiz response:", res?.data);

        // Log final RAG prompt with full details
        console.log("🎓 === RAG PROMPT GENERATION SUMMARY ===");
        console.log("Student ID:", studentId);
        console.log("Subject:", subject);
        console.log("Lesson:", lesson);
        console.log(
          "Knowledge Components:",
          kcIds.length > 0 ? kcIds : "Single KC",
        );
        console.log("Quiz Performance:", {
          questionsAttempted: quiz.questions.length,
          studentAnswers: answers,
          correctAnswers: correctAnswers,
          score: `${answers.filter((a, i) => a === correctAnswers[i]).length}/${quiz.questions.length}`,
        });

        if (res?.data?.rag_prompt) {
          console.log("📝 [RAG] FINAL PROMPT FOR CONTENT GENERATION:");
          console.log(res.data.rag_prompt);
          console.log(
            "📝 [RAG] This prompt will be used to personalize lesson content based on:",
          );
          console.log("   - Student's skill level from mastery prediction");
          console.log("   - Specific knowledge gaps identified");
          console.log("   - Bloom's taxonomy level recommendations");
          console.log("   - Personalized learning pathways");
        } else {
          console.log(
            "[RAG] ⚠️  No rag_prompt returned by server - using default content generation",
          );
        }

        localStorage.setItem("lesson_content", res?.data?.content || "");
        router.push(
          `/result?score=${res?.data?.score || 0}&level=${res?.data?.level || "Beginner"}&topic=${topic || lesson}&type=pre&subject=${subject}&lesson=${lesson}`,
        );
      }
    } catch (err) {
      console.error("❌ Submit error:", err?.response?.data || err.message);
      setSubmitting(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div style={{ display: "flex", minHeight: "100vh" }}>
        <Sidebar />
        <main
          style={{
            flex: 1,
            backgroundColor: "#f8fafc",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              borderRadius: 16,
              padding: "48px 56px",
              textAlign: "center",
              boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                border: `3px solid #e2e8f0`,
                borderTop: `3px solid ${accent}`,
                animation: "spin 0.8s linear infinite",
                margin: "0 auto 20px",
              }}
            />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <p
              style={{
                color: "#0f172a",
                fontWeight: 600,
                fontSize: 16,
                marginBottom: 6,
              }}
            >
              {type === "post"
                ? "Preparing Post Quiz..."
                : "Preparing Pre Quiz..."}
            </p>
            <p style={{ color: "#94a3b8", fontSize: 13 }}>
              Generating questions for <strong>{topic}</strong>
            </p>
          </div>
        </main>
      </div>
    );
  }

  // Submitting state
  if (submitting) {
    return (
      <div style={{ display: "flex", minHeight: "100vh" }}>
        <Sidebar />
        <main
          style={{
            flex: 1,
            backgroundColor: "#f8fafc",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              borderRadius: 16,
              padding: "48px 56px",
              textAlign: "center",
              boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                border: "3px solid #e2e8f0",
                borderTop: "3px solid #059669",
                animation: "spin 0.8s linear infinite",
                margin: "0 auto 20px",
              }}
            />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <p
              style={{
                color: "#0f172a",
                fontWeight: 600,
                fontSize: 16,
                marginBottom: 6,
              }}
            >
              {type === "post"
                ? "Evaluating your answers..."
                : "Analyzing your level..."}
            </p>
            <p style={{ color: "#94a3b8", fontSize: 13 }}>
              {type === "pre"
                ? "Generating your personalized lesson..."
                : "Saving your progress..."}
            </p>
          </div>
        </main>
      </div>
    );
  }

  if (!quiz?.questions?.length) {
    return (
      <div style={{ display: "flex", minHeight: "100vh" }}>
        <Sidebar />
        <main style={{ flex: 1, padding: 48, backgroundColor: "#f8fafc" }}>
          <p style={{ color: "#94a3b8" }}>No quiz available.</p>
        </main>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar />

      <main
        style={{
          flex: 1,
          padding: "48px",
          backgroundColor: "#f8fafc",
          minWidth: 0,
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <p
            style={{
              color: accent,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            {subject} — {lesson}
          </p>
          <h1
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 32,
              fontWeight: 700,
              color: "#0f172a",
              marginBottom: 6,
            }}
          >
            {type === "post" ? "Post Lesson Quiz" : "Pre Lesson Quiz"}
          </h1>
          <p style={{ color: "#64748b", fontSize: 14 }}>
            {topic ? (
              <>
                Topic: <strong>{topic}</strong>
              </>
            ) : (
              <>
                Mode: <strong>Combined Lesson Quiz</strong>
              </>
            )} — {quiz.questions.length} questions
          </p>
        </div>

        {/* Progress Bar */}
        <div
          style={{
            backgroundColor: "#e2e8f0",
            borderRadius: 99,
            height: 4,
            marginBottom: 32,
          }}
        >
          <div
            style={{
              height: 4,
              borderRadius: 99,
              backgroundColor: accent,
              width: `${(answers.filter(Boolean).length / quiz.questions.length) * 100}%`,
              transition: "width 0.3s ease",
            }}
          />
        </div>

        {/* Questions */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 20,
            maxWidth: 720,
          }}
        >
          {quiz.questions.map((q, i) => (
            <div
              key={i}
              style={{
                backgroundColor: "white",
                borderRadius: 14,
                padding: "24px 28px",
                boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                border: "1px solid #f1f5f9",
              }}
            >
              <p
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: "#0f172a",
                  marginBottom: 18,
                  lineHeight: 1.5,
                }}
              >
                <span style={{ color: accent, marginRight: 8 }}>Q{i + 1}.</span>
                {subject.toLowerCase() === "buddhism"
                  ? normalizeSinhalaText(q.question)
                  : q.question}
              </p>

              <div
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              >
                {q.options.map((opt, idx) => {
                  const label = String.fromCharCode(65 + idx);
                  const isSelected = answers[i] === label;
                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        const newAns = [...answers];
                        newAns[i] = label;
                        setAnswers(newAns);

                        // Log BKT parameters for this KC when a selection is made
                        try {
                          const studentId = localStorage.getItem("student_id");
                          const kcId = q.kc_id || topic;
                          if (studentId) {
                            bktService
                              .fetchMastery(studentId)
                              .then((data) => {
                                const kcState = data?.kc_states?.[kcId];
                                if (kcState) {
                                  console.log(
                                    `[BKT] Selection - KC ${kcId} params:`,
                                    kcState,
                                  );
                                } else {
                                  console.log(
                                    `[BKT] Selection - no BKT state for KC ${kcId}`,
                                    data?.kc_states || data,
                                  );
                                }
                              })
                              .catch((err) =>
                                console.error("[BKT] fetchMastery error:", err),
                              );
                          }
                        } catch (e) {
                          console.error("[BKT] selection logging failed:", e);
                        }
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 14,
                        padding: "12px 16px",
                        borderRadius: 10,
                        border: `2px solid ${isSelected ? accent : "#e2e8f0"}`,
                        backgroundColor: isSelected ? accent + "10" : "#fafafa",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: "50%",
                          backgroundColor: isSelected ? accent : "#f1f5f9",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          transition: "all 0.15s",
                        }}
                      >
                        <span
                          style={{
                            color: isSelected ? "white" : "#64748b",
                            fontWeight: 700,
                            fontSize: 12,
                          }}
                        >
                          {label}
                        </span>
                      </div>
                      <span style={{ color: "#334155", fontSize: 14 }}>
                        {subject.toLowerCase() === "buddhism"
                          ? normalizeSinhalaText(opt)
                          : opt}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Submit */}
        <div style={{ maxWidth: 720, marginTop: 28 }}>
          <button
            onClick={handleSubmit}
            style={{
              width: "100%",
              padding: "14px",
              backgroundColor: accent,
              color: "white",
              border: "none",
              borderRadius: 12,
              fontSize: 15,
              fontWeight: 600,
              cursor: "pointer",
              transition: "opacity 0.2s",
            }}
          >
            Submit Quiz →
          </button>
        </div>
      </main>
    </div>
  );
}
