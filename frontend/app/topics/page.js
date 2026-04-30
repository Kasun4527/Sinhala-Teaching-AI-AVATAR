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
    if (!token) { router.push("/login"); return; }
  }, []);

  const subjectColors = {
    Physics:   { accent: "#2563eb", light: "#eff6ff" },
    Chemistry: { accent: "#16a34a", light: "#f0fdf4" },
    Biology:   { accent: "#059669", light: "#ecfdf5" },
    Maths:     { accent: "#9333ea", light: "#faf5ff" },
  };

  const color = subjectColors[subject] || { accent: "#2563eb", light: "#eff6ff" };

  if (!lessonData || lessonData.topics.length === 0) return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar />
      <main style={{ flex: 1, padding: 48, backgroundColor: "#f8fafc" }}>
        <p style={{ color: "#94a3b8" }}>No topics available.</p>
      </main>
    </div>
  );

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar />

      <main style={{ flex: 1, padding: "48px", backgroundColor: "#f8fafc", minWidth: 0 }}>

        {/* Breadcrumb */}
        <p
          onClick={() => router.push(`/sub-lesson?subject=${subject}`)}
          style={{ color: "#94a3b8", fontSize: 13, cursor: "pointer", marginBottom: 24 }}
        >
          ← Back to Lessons
        </p>

        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <p style={{
            color: color.accent, fontSize: 11, fontWeight: 600,
            letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 8
          }}>
            {subject} — {lesson}
          </p>
          <h1 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 36, fontWeight: 700, color: "#0f172a", marginBottom: 8
          }}>
            Topics
          </h1>
          <p style={{ color: "#64748b", fontSize: 15 }}>
            {lessonData.topics.length} topics available — select one to start your quiz
          </p>
        </div>

        {/* Topics List */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {lessonData.topics.map((topic, i) => {
            const isHovered = hoveredCard === i;
            return (
              <div
                key={i}
                onClick={() => router.push(
                  `/quiz?subject=${subject}&lesson=${lesson}&topic=${encodeURIComponent(topic)}&type=pre`
                )}
                onMouseEnter={() => setHoveredCard(i)}
                onMouseLeave={() => setHoveredCard(null)}
                style={{
                  backgroundColor: isHovered ? color.light : "white",
                  border: `2px solid ${isHovered ? color.accent : "#e2e8f0"}`,
                  borderRadius: 14,
                  padding: "20px 24px",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  boxShadow: isHovered ? "0 8px 24px rgba(0,0,0,0.08)" : "0 1px 3px rgba(0,0,0,0.04)",
                  transform: isHovered ? "translateY(-1px)" : "translateY(0)",
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  backgroundColor: isHovered ? color.accent : "#f1f5f9",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0, transition: "all 0.2s"
                }}>
                  <span style={{
                    color: isHovered ? "white" : "#64748b",
                    fontWeight: 700, fontSize: 13
                  }}>
                    {i + 1}
                  </span>
                </div>

                <p style={{
                  flex: 1, fontSize: 15, fontWeight: 500,
                  color: "#0f172a", margin: 0
                }}>
                  {topic}
                </p>

                <div style={{
                  display: "flex", alignItems: "center", gap: 6,
                  backgroundColor: isHovered ? color.accent : "#f1f5f9",
                  color: isHovered ? "white" : "#94a3b8",
                  padding: "5px 12px", borderRadius: 20,
                  fontSize: 12, fontWeight: 600,
                  transition: "all 0.2s"
                }}>
                  Start Quiz →
                </div>
              </div>
            );
          })}
        </div>

      </main>
    </div>
  );
}