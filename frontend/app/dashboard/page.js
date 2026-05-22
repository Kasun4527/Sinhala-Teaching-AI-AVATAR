"use client";

import { useRouter } from "next/navigation";
import { curriculum } from "@/data/curriculum";
import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import { bktService } from "@/services/bktService";
import { enrollSubject } from "@/services/api";

const subjectConfig = {
  Physics: {
    icon: "⚛️",
    bg: "#eff6ff",
    border: "#bfdbfe",
    hover: "#2563eb",
    accent: "#1d4ed8",
  },
  Chemistry: {
    icon: "🧪",
    bg: "#f0fdf4",
    border: "#bbf7d0",
    hover: "#16a34a",
    accent: "#15803d",
  },
  Biology: {
    icon: "🧬",
    bg: "#ecfdf5",
    border: "#a7f3d0",
    hover: "#059669",
    accent: "#047857",
  },
  Maths: {
    icon: "📐",
    bg: "#faf5ff",
    border: "#e9d5ff",
    hover: "#9333ea",
    accent: "#7e22ce",
  },
  Buddhism: {
    icon: "🕉️",
    bg: "#fff7ed",
    border: "#fde68a",
    hover: "#d97706",
    accent: "#d97706",
  },
};

export default function StudentDashboard() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [hoveredCard, setHoveredCard] = useState(null);
  const [pendingEnroll, setPendingEnroll] = useState(null);
  const [enrollLoading, setEnrollLoading] = useState(false);
  const [enrollError, setEnrollError] = useState("");
  const [pKnowAvg, setPKnowAvg] = useState(0);
  const [masteryLevel, setMasteryLevel] = useState("Not Started");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }
    const studentId = localStorage.getItem("student_id");
    setName(localStorage.getItem("name") || "Student");

    if (studentId) {
      bktService
        .fetchMastery(studentId)
        .then((data) => {
          if (data?.kc_states) {
            const kcs = Object.values(data.kc_states);
            if (kcs.length > 0) {
              const avg =
                kcs.reduce((acc, curr) => acc + (curr.p_know || 0), 0) /
                kcs.length;
              setPKnowAvg(avg);
              if (avg > 0.85) setMasteryLevel("Advanced");
              else if (avg >= 0.6) setMasteryLevel("Standard");
              else setMasteryLevel("Remedial");
            } else {
              setMasteryLevel("Not Started");
            }
          }
        })
        .catch(() => {});
    }
  }, []);

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar />
      <main
        style={{
          flex: 1,
          padding: "48px",
          backgroundColor: "#f8fafc",
          overflowY: "auto",
          minWidth: 0,
        }}
      >
        <div style={{ marginBottom: 40 }}>
          <p
            style={{
              color: "#94a3b8",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            Welcome back
          </p>
          <h1
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 40,
              fontWeight: 700,
              color: "#0f172a",
              marginBottom: 8,
            }}
          >
            {name} 👋
          </h1>
          <p style={{ color: "#64748b", fontSize: 15 }}>
            Select a subject below to continue your learning journey.
          </p>
        </div>

        <div style={{ display: "flex", gap: 16, marginBottom: 40 }}>
          {[
            { label: "Subjects", value: curriculum.length, color: "#2563eb" },
            { label: "Available", value: "Physics", color: "#059669" },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                backgroundColor: "white",
                borderRadius: 12,
                padding: "16px 24px",
                border: "1px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  backgroundColor: stat.color,
                }}
              />
              <span style={{ color: "#64748b", fontSize: 13 }}>
                {stat.label}:
              </span>
              <span style={{ color: "#0f172a", fontWeight: 600, fontSize: 13 }}>
                {stat.value}
              </span>
            </div>
          ))}
        </div>

        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}
        >
          {curriculum.map((item, index) => {
            const cardKey = `${item.subject}-${index}`;
            const config = subjectConfig[item.subject] || subjectConfig.Biology;
            const isHovered = hoveredCard === cardKey;
            return (
              <button
                key={cardKey}
                type="button"
                onClick={() => setPendingEnroll(item)}
                onMouseEnter={() => setHoveredCard(cardKey)}
                onMouseLeave={() => setHoveredCard(null)}
                style={{
                  backgroundColor: isHovered ? config.bg : "white",
                  border: `2px solid ${isHovered ? config.hover : config.border}`,
                  borderRadius: 16,
                  padding: 28,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  boxShadow: isHovered
                    ? "0 8px 24px rgba(0,0,0,0.08)"
                    : "0 1px 3px rgba(0,0,0,0.04)",
                  transform: isHovered ? "translateY(-2px)" : "translateY(0)",
                  textAlign: "left",
                  width: "100%",
                  background: isHovered ? config.bg : "white",
                }}
              >
                <div style={{ fontSize: 36, marginBottom: 16 }}>
                  {config.icon}
                </div>
                <h3
                  style={{
                    fontFamily: "'Playfair Display', serif",
                    fontSize: 22,
                    fontWeight: 700,
                    color: "#0f172a",
                    marginBottom: 6,
                  }}
                >
                  {item.subject}
                </h3>

                {item.subject.toLowerCase() === "buddhism" ? (
                  <div style={{ marginBottom: 20 }}>
                    <p
                      style={{
                        color: "#94a3b8",
                        fontSize: 13,
                        marginBottom: 4,
                      }}
                    >
                      Mastery Level:{" "}
                      <strong style={{ color: config.accent }}>
                        {masteryLevel}
                      </strong>
                    </p>
                    <div
                      style={{
                        width: "100%",
                        backgroundColor: "#e2e8f0",
                        borderRadius: 99,
                        height: 6,
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.max(5, Math.round(pKnowAvg * 100))}%`,
                          backgroundColor: config.accent,
                          height: 6,
                          borderRadius: 99,
                          transition: "width 0.5s ease-in-out",
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <p
                    style={{ color: "#94a3b8", fontSize: 13, marginBottom: 20 }}
                  >
                    {item.lessons?.length || 0} lessons available
                  </p>
                )}

                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    backgroundColor: isHovered ? config.hover : "#f1f5f9",
                    color: isHovered ? "white" : "#64748b",
                    padding: "6px 14px",
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 600,
                    transition: "all 0.2s ease",
                  }}
                >
                  Start Learning →
                </div>
              </button>
            );
          })}
        </div>

        {pendingEnroll && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(2,6,23,0.6)",
            }}
          >
            <div
              style={{
                width: 420,
                background: "white",
                borderRadius: 12,
                padding: 24,
              }}
            >
              <h3 style={{ marginTop: 0 }}>
                Enroll in {pendingEnroll.subject}?
              </h3>
              <p style={{ color: "#64748b" }}>
                Do you want to enroll in this subject so it appears in your
                enrolled subjects?
              </p>
              {enrollError && <p style={{ color: "#b91c1c" }}>{enrollError}</p>}
              <div
                style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}
              >
                <button
                  onClick={() => setPendingEnroll(null)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    background: "#f1f5f9",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    setEnrollLoading(true);
                    setEnrollError("");
                    try {
                      await enrollSubject({
                        student_id: localStorage.getItem("student_id"),
                        subject: pendingEnroll.subject,
                      });
                      setPendingEnroll(null);
                    } catch (err) {
                      setEnrollError(
                        err?.response?.data?.detail || "Enrollment failed",
                      );
                    } finally {
                      setEnrollLoading(false);
                    }
                  }}
                  disabled={enrollLoading}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    background: "#2563eb",
                    color: "white",
                  }}
                >
                  {enrollLoading ? "Enrolling..." : "Enroll"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
