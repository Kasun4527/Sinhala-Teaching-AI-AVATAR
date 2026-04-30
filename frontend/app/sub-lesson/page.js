"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { curriculum } from "@/data/curriculum";
import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";

export default function LessonsPage() {
  const params = useSearchParams();
  const router = useRouter();
  const subject = params.get("subject");
  const subjectData = curriculum.find((s) => s.subject === subject);
  const [hoveredCard, setHoveredCard] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { router.push("/login"); return; }
  }, []);

  const subjectColors = {
    Physics:   { accent: "#2563eb", light: "#eff6ff", border: "#bfdbfe" },
    Chemistry: { accent: "#16a34a", light: "#f0fdf4", border: "#bbf7d0" },
    Biology:   { accent: "#059669", light: "#ecfdf5", border: "#a7f3d0" },
    Maths:     { accent: "#9333ea", light: "#faf5ff", border: "#e9d5ff" },
  };

  const color = subjectColors[subject] || { accent: "#2563eb", light: "#eff6ff", border: "#bfdbfe" };

  if (!subjectData) return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar />
      <main style={{ flex: 1, padding: 48, backgroundColor: "#f8fafc" }}>
        <p style={{ color: "#94a3b8" }}>No lessons found.</p>
      </main>
    </div>
  );

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar />

      <main style={{ flex: 1, padding: "48px", backgroundColor: "#f8fafc", minWidth: 0 }}>

        {/* Breadcrumb */}
        <p
          onClick={() => router.push("/dashboard")}
          style={{ color: "#94a3b8", fontSize: 13, cursor: "pointer", marginBottom: 24 }}
        >
          ← Back to Dashboard
        </p>

        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <p style={{
            color: color.accent, fontSize: 11, fontWeight: 600,
            letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 8
          }}>
            {subject}
          </p>
          <h1 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 36, fontWeight: 700, color: "#0f172a", marginBottom: 8
          }}>
            Available Lessons
          </h1>
          <p style={{ color: "#64748b", fontSize: 15 }}>
            {subjectData.lessons.length} lessons available — select one to begin
          </p>
        </div>

        {/* Lessons Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          {subjectData.lessons.map((lesson, i) => {
            const isHovered = hoveredCard === i;
            return (
              <div
                key={i}
                onClick={() => router.push(`/topics?subject=${subject}&lesson=${lesson.name}`)}
                onMouseEnter={() => setHoveredCard(i)}
                onMouseLeave={() => setHoveredCard(null)}
                style={{
                  backgroundColor: isHovered ? color.light : "white",
                  border: `2px solid ${isHovered ? color.accent : "#e2e8f0"}`,
                  borderRadius: 14,
                  padding: "24px 28px",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  boxShadow: isHovered ? "0 8px 24px rgba(0,0,0,0.08)" : "0 1px 3px rgba(0,0,0,0.04)",
                  transform: isHovered ? "translateY(-2px)" : "translateY(0)",
                  display: "flex",
                  alignItems: "center",
                  gap: 20,
                }}
              >
                {/* Number Badge */}
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  backgroundColor: isHovered ? color.accent : "#f1f5f9",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0, transition: "all 0.2s"
                }}>
                  <span style={{
                    color: isHovered ? "white" : "#64748b",
                    fontWeight: 700, fontSize: 16
                  }}>
                    {i + 1}
                  </span>
                </div>

                {/* Text */}
                <div style={{ flex: 1 }}>
                  <p style={{
                    fontFamily: "'Playfair Display', serif",
                    fontSize: 17, fontWeight: 600,
                    color: "#0f172a", marginBottom: 4
                  }}>
                    {lesson.name}
                  </p>
                  <p style={{ color: "#94a3b8", fontSize: 12 }}>
                    {lesson.topics?.length || 0} topics
                  </p>
                </div>

                {/* Arrow */}
                <span style={{
                  color: isHovered ? color.accent : "#cbd5e1",
                  fontSize: 18, transition: "color 0.2s"
                }}>
                  →
                </span>
              </div>
            );
          })}
        </div>

      </main>
    </div>
  );
}