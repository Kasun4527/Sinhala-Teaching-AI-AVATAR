"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { curriculum } from "@/data/curriculum";
import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";

export default function TopicsPage() {
  const params = useSearchParams();
  const router = useRouter();
  const subject = params.get("subject");
  const lesson = params.get("lesson");
  const subjectData = curriculum.find((s) => s.subject === subject);
  const lessonData = subjectData?.lessons.find((l) => l.name === lesson);
  const [hoveredCard, setHoveredCard] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
    }
  }, [router]);

  const subjectColors = {
    Physics: { accent: "#2563eb", light: "#eff6ff" },
    Chemistry: { accent: "#16a34a", light: "#f0fdf4" },
    Biology: { accent: "#059669", light: "#ecfdf5" },
    Maths: { accent: "#9333ea", light: "#faf5ff" },
  };

  const color = subjectColors[subject] || { accent: "#2563eb", light: "#eff6ff" };

  const openLesson = (topic) => {
    router.push(`/lesson?subject=${subject}&lesson=${lesson}&topic=${encodeURIComponent(topic)}`);
  };

  const openQuiz = (topic) => {
    router.push(`/quiz?subject=${subject}&lesson=${lesson}&topic=${encodeURIComponent(topic)}&type=pre`);
  };

  if (!lessonData || lessonData.topics.length === 0) {
    return (
      <div style={{ display: "flex", minHeight: "100vh" }}>
        <Sidebar />
        <main style={{ flex: 1, padding: 48, backgroundColor: "#f8fafc" }}>
          <p style={{ color: "#94a3b8" }}>No topics available.</p>
        </main>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar />

      <main style={{ flex: 1, padding: 48, backgroundColor: "#f8fafc", minWidth: 0 }}>
        <p
          onClick={() => router.push(`/sub-lesson?subject=${subject}`)}
          style={{ color: "#94a3b8", fontSize: 13, cursor: "pointer", marginBottom: 24 }}
        >
          ← Back to Lessons
        </p>

        <div style={{ marginBottom: 32 }}>
          <p style={{
            color: color.accent,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            marginBottom: 8,
          }}>
            {subject} — {lesson}
          </p>
          <h1 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 36,
            fontWeight: 700,
            color: "#0f172a",
            marginBottom: 8,
          }}>
            Topics
          </h1>
          <p style={{ color: "#64748b", fontSize: 15, lineHeight: 1.7 }}>
            {lessonData.topics.length} topics available — swipe through the learning cards below.
          </p>
        </div>

        <div style={{
          display: "grid",
          gridAutoFlow: "column",
          gridAutoColumns: "minmax(260px, 320px)",
          gap: 18,
          overflowX: "auto",
          paddingBottom: 12,
          scrollSnapType: "x mandatory",
          WebkitOverflowScrolling: "touch",
        }}>
          {lessonData.topics.map((topic, i) => {
            const isHovered = hoveredCard === i;
            const gradient = `linear-gradient(135deg, ${color.accent}, ${isHovered ? color.light : "#0f172a"})`;

            return (
              <div
                key={i}
                onClick={() => openLesson(topic)}
                onMouseEnter={() => setHoveredCard(i)}
                onMouseLeave={() => setHoveredCard(null)}
                style={{
                  backgroundColor: "white",
                  border: `1px solid ${isHovered ? color.accent : "#e2e8f0"}`,
                  borderRadius: 20,
                  padding: 14,
                  cursor: "pointer",
                  transition: "all 0.22s ease",
                  boxShadow: isHovered ? "0 16px 32px rgba(15,23,42,0.12)" : "0 6px 18px rgba(15,23,42,0.05)",
                  transform: isHovered ? "translateY(-4px)" : "translateY(0)",
                  scrollSnapAlign: "start",
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                }}
              >
                <div style={{
                  height: 148,
                  borderRadius: 16,
                  background: gradient,
                  position: "relative",
                  overflow: "hidden",
                  display: "flex",
                  alignItems: "flex-end",
                  padding: 18,
                }}>
                  <div style={{
                    position: "absolute",
                    inset: 0,
                    background: "radial-gradient(circle at top left, rgba(255,255,255,0.28), transparent 42%), radial-gradient(circle at bottom right, rgba(255,255,255,0.15), transparent 38%)",
                  }} />

                  <div style={{ position: "relative", zIndex: 1 }}>
                    <p style={{
                      color: "rgba(255,255,255,0.8)",
                      fontSize: 11,
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      fontWeight: 700,
                      marginBottom: 6,
                    }}>
                      Topic {i + 1}
                    </p>
                    <p style={{
                      color: "white",
                      fontSize: 22,
                      fontWeight: 700,
                      lineHeight: 1.2,
                      margin: 0,
                      fontFamily: "'Playfair Display', serif",
                    }}>
                      Learn & Practice
                    </p>
                  </div>

                  <div style={{
                    position: "absolute",
                    top: 16,
                    right: 16,
                    width: 42,
                    height: 42,
                    borderRadius: "50%",
                    backgroundColor: "rgba(255,255,255,0.16)",
                    border: "1px solid rgba(255,255,255,0.24)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "white",
                    fontSize: 18,
                    fontWeight: 700,
                  }}>
                    →
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <div style={{
                    width: 38,
                    height: 38,
                    borderRadius: 12,
                    backgroundColor: isHovered ? color.accent : "#f1f5f9",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    transition: "all 0.2s",
                  }}>
                    <span style={{
                      color: isHovered ? "white" : "#64748b",
                      fontWeight: 700,
                      fontSize: 13,
                    }}>
                      {i + 1}
                    </span>
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: 15,
                      fontWeight: 700,
                      color: "#0f172a",
                      margin: 0,
                      lineHeight: 1.45,
                    }}>
                      {topic}
                    </p>
                    <p style={{ color: "#94a3b8", fontSize: 12, margin: "6px 0 0" }}>
                      Tap to open the lesson content.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    openLesson(topic);
                  }}
                  style={{
                    border: "none",
                    borderRadius: 999,
                    padding: "12px 16px",
                    backgroundColor: color.accent,
                    color: "white",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    width: "100%",
                  }}
                >
                  Learn
                </button>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 36 }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 14,
          }}>
            <div>
              <p style={{
                color: color.accent,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                marginBottom: 6,
              }}>
                Quiz Practice
              </p>
              <h2 style={{
                fontSize: 20,
                fontWeight: 700,
                color: "#0f172a",
                margin: 0,
                fontFamily: "'Playfair Display', serif",
              }}>
                Start a quiz after learning
              </h2>
            </div>
            <p style={{ color: "#94a3b8", fontSize: 13, margin: 0 }}>
              Separate from the topic cards
            </p>
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 14,
          }}>
            {lessonData.topics.map((topic, i) => (
              <button
                key={`quiz-${i}`}
                type="button"
                onClick={() => openQuiz(topic)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  border: "1px solid #e2e8f0",
                  backgroundColor: "white",
                  borderRadius: 16,
                  padding: "16px 18px",
                  cursor: "pointer",
                  boxShadow: "0 6px 18px rgba(15,23,42,0.04)",
                  textAlign: "left",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <p style={{
                    margin: 0,
                    color: "#0f172a",
                    fontWeight: 700,
                    fontSize: 14,
                    lineHeight: 1.4,
                  }}>
                    {topic}
                  </p>
                  <p style={{ margin: "4px 0 0", color: "#94a3b8", fontSize: 12 }}>
                    Open the quiz for this topic
                  </p>
                </div>

                <span style={{
                  flexShrink: 0,
                  width: 34,
                  height: 34,
                  borderRadius: 999,
                  backgroundColor: color.light,
                  color: color.accent,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                }}>
                  →
                </span>
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
