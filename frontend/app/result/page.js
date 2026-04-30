"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import Sidebar from "@/components/Sidebar";

export default function ResultPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const subject = searchParams.get("subject");
  const lesson = searchParams.get("lesson");
  const score = Number(searchParams.get("score"));
  const level = searchParams.get("level");
  const topic = searchParams.get("topic");
  const type = searchParams.get("type");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { router.push("/login"); return; }
  }, []);

  const scoreColor = score >= 8 ? "#059669" : score >= 5 ? "#d97706" : "#dc2626";
  const scoreBg = score >= 8 ? "#ecfdf5" : score >= 5 ? "#fffbeb" : "#fef2f2";

  const levelConfig = {
    Advanced:     { bg: "#f5f3ff", color: "#7c3aed" },
    Intermediate: { bg: "#fffbeb", color: "#d97706" },
    Beginner:     { bg: "#f0fdf4", color: "#16a34a" },
  };
  const lc = levelConfig[level] || levelConfig["Beginner"];

  const subjectColors = {
    Physics: "#2563eb", Chemistry: "#16a34a",
    Biology: "#059669", Maths: "#9333ea",
  };
  const accent = subjectColors[subject] || "#2563eb";

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar />

      <main style={{
        flex: 1, backgroundColor: "#f8fafc",
        display: "flex", alignItems: "center",
        justifyContent: "center", padding: 48
      }}>
        <div style={{
          backgroundColor: "white", borderRadius: 20,
          padding: "48px", width: "100%", maxWidth: 480,
          boxShadow: "0 4px 24px rgba(0,0,0,0.06)"
        }}>

          {/* Badge */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            backgroundColor: accent + "15", color: accent,
            padding: "6px 14px", borderRadius: 20,
            fontSize: 12, fontWeight: 600, marginBottom: 24
          }}>
            {type === "post" ? "📊 Post Quiz Result" : "📊 Pre Quiz Result"}
          </div>

          {/* Breadcrumb */}
          <p style={{ color: "#94a3b8", fontSize: 12, marginBottom: 24 }}>
            {subject} → {lesson} → <span style={{ color: "#64748b", fontWeight: 500 }}>{topic}</span>
          </p>

          {/* Score */}
          <div style={{
            backgroundColor: scoreBg,
            borderRadius: 16, padding: "28px",
            textAlign: "center", marginBottom: 24
          }}>
            <p style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 64, fontWeight: 700,
              color: scoreColor, lineHeight: 1, marginBottom: 4
            }}>
              {score.toFixed(1)}
            </p>
            <p style={{ color: "#94a3b8", fontSize: 13 }}>out of 10</p>

            {/* Progress Bar */}
            <div style={{
              backgroundColor: "#e2e8f0", borderRadius: 99,
              height: 6, marginTop: 16
            }}>
              <div style={{
                height: 6, borderRadius: 99,
                backgroundColor: scoreColor,
                width: `${(score / 10) * 100}%`,
                transition: "width 0.5s ease"
              }} />
            </div>
          </div>

          {/* Level Badge */}
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <span style={{
              backgroundColor: lc.bg, color: lc.color,
              padding: "6px 18px", borderRadius: 20,
              fontSize: 13, fontWeight: 600
            }}>
              {level} Level
            </span>
          </div>

          {/* Message */}
          <div style={{
            backgroundColor: score >= 6 ? "#f0fdf4" : "#fffbeb",
            border: `1px solid ${score >= 6 ? "#bbf7d0" : "#fde68a"}`,
            borderRadius: 10, padding: "14px 16px",
            fontSize: 13, color: score >= 6 ? "#166534" : "#92400e",
            marginBottom: 28, textAlign: "center"
          }}>
            {type === "post"
              ? score >= 6
                ? "🎉 Excellent! You've mastered this topic. Move to the next one."
                : "📚 Keep going! Review the lesson and try again."
              : "📖 Your personalized lesson has been prepared!"
            }
          </div>

          {/* Buttons */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {type === "pre" && (
              <button
                onClick={() => router.push(`/lesson?topic=${topic}&level=${level}&subject=${subject}&lesson=${lesson}`)}
                style={{
                  width: "100%", padding: "13px",
                  backgroundColor: accent, color: "white",
                  border: "none", borderRadius: 10,
                  fontSize: 14, fontWeight: 600, cursor: "pointer"
                }}
              >
                Start Lesson →
              </button>
            )}

            {type === "post" && score < 6 && (
              <button
                onClick={() => router.push(`/lesson?topic=${topic}&level=${level}&subject=${subject}&lesson=${lesson}`)}
                style={{
                  width: "100%", padding: "13px",
                  backgroundColor: "#d97706", color: "white",
                  border: "none", borderRadius: 10,
                  fontSize: 14, fontWeight: 600, cursor: "pointer"
                }}
              >
                Review Lesson Again →
              </button>
            )}

            {type === "post" && score >= 6 && (
              <button
                onClick={() => router.push(`/topics?subject=${subject}&lesson=${lesson}`)}
                style={{
                  width: "100%", padding: "13px",
                  backgroundColor: "#059669", color: "white",
                  border: "none", borderRadius: 10,
                  fontSize: 14, fontWeight: 600, cursor: "pointer"
                }}
              >
                Next Topic →
              </button>
            )}

            <button
              onClick={() => router.push("/dashboard")}
              style={{
                width: "100%", padding: "13px",
                backgroundColor: "transparent", color: "#94a3b8",
                border: "1.5px solid #e2e8f0", borderRadius: 10,
                fontSize: 14, fontWeight: 500, cursor: "pointer"
              }}
            >
              Back to Dashboard
            </button>
          </div>

        </div>
      </main>
    </div>
  );
}