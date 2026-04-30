"use client";

import { useRouter } from "next/navigation";
import { curriculum } from "@/data/curriculum";
import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";

const subjectConfig = {
  Physics:   { icon: "⚛️", bg: "#eff6ff", border: "#bfdbfe", hover: "#2563eb", accent: "#1d4ed8" },
  Chemistry: { icon: "🧪", bg: "#f0fdf4", border: "#bbf7d0", hover: "#16a34a", accent: "#15803d" },
  Biology:   { icon: "🧬", bg: "#ecfdf5", border: "#a7f3d0", hover: "#059669", accent: "#047857" },
  Maths:     { icon: "📐", bg: "#faf5ff", border: "#e9d5ff", hover: "#9333ea", accent: "#7e22ce" },
};

export default function StudentDashboard() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [hoveredCard, setHoveredCard] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { router.push("/login"); return; }
    setName(localStorage.getItem("name") || "Student");
  }, []);

 return (
  <div style={{ display: "flex", minHeight: "100vh" }}>
    <Sidebar />
    <main style={{
      flex: 1,
      padding: "48px",
      backgroundColor: "#f8fafc",
      overflowY: "auto",
      minWidth: 0   
    }}>

        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <p style={{
            color: "#94a3b8", fontSize: 11, fontWeight: 600,
            letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 8
          }}>
            Welcome back
          </p>
          <h1 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 40, fontWeight: 700, color: "#0f172a", marginBottom: 8
          }}>
            {name} 👋
          </h1>
          <p style={{ color: "#64748b", fontSize: 15 }}>
            Select a subject below to continue your learning journey.
          </p>
        </div>

        {/* Stats Row */}
        <div style={{ display: "flex", gap: 16, marginBottom: 40 }}>
          {[
            { label: "Subjects", value: curriculum.length, color: "#2563eb" },
            { label: "Available", value: "Physics", color: "#059669" },
          ].map((stat, i) => (
            <div key={i} style={{
              backgroundColor: "white", borderRadius: 12, padding: "16px 24px",
              border: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: 12
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: "50%",
                backgroundColor: stat.color
              }} />
              <span style={{ color: "#64748b", fontSize: 13 }}>{stat.label}:</span>
              <span style={{ color: "#0f172a", fontWeight: 600, fontSize: 13 }}>{stat.value}</span>
            </div>
          ))}
        </div>

        {/* Subject Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          {curriculum.map((item, i) => {
            const config = subjectConfig[item.subject] || {
              icon: "📚", bg: "#f8fafc", border: "#e2e8f0", hover: "#2563eb"
            };
            const isHovered = hoveredCard === i;

            return (
              <div
                key={i}
                onClick={() => router.push(`/sub-lesson?subject=${item.subject}`)}
                onMouseEnter={() => setHoveredCard(i)}
                onMouseLeave={() => setHoveredCard(null)}
                style={{
                  backgroundColor: isHovered ? config.bg : "white",
                  border: `2px solid ${isHovered ? config.hover : config.border}`,
                  borderRadius: 16,
                  padding: 28,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  boxShadow: isHovered ? "0 8px 24px rgba(0,0,0,0.08)" : "0 1px 3px rgba(0,0,0,0.04)",
                  transform: isHovered ? "translateY(-2px)" : "translateY(0)",
                }}
              >
                {/* Icon */}
                <div style={{ fontSize: 36, marginBottom: 16 }}>{config.icon}</div>

                {/* Title */}
                <h3 style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: 22, fontWeight: 700,
                  color: "#0f172a", marginBottom: 6
                }}>
                  {item.subject}
                </h3>

                {/* Lessons count */}
                <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 20 }}>
                  {item.lessons?.length || 0} lessons available
                </p>

                {/* CTA */}
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  backgroundColor: isHovered ? config.hover : "#f1f5f9",
                  color: isHovered ? "white" : "#64748b",
                  padding: "6px 14px", borderRadius: 20,
                  fontSize: 12, fontWeight: 600,
                  transition: "all 0.2s ease"
                }}>
                  Start Learning →
                </div>
              </div>
            );
          })}
        </div>

      </main>
    </div>
  );
}