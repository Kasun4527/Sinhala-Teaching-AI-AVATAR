"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function LandingPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [hoveredRole, setHoveredRole] = useState(null);

  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");
    if (token && role === "admin") router.push("/admin/dashboard");
    else if (token && role === "student") router.push("/dashboard");
  }, []);

  if (!mounted) return null;

  return (
    <div style={{ display: "flex", minHeight: "100vh", width: "100vw", overflow: "hidden" }}>

      {/* Left Dark Panel */}
      <div style={{
        width: "50%",
        backgroundColor: "#0a0f1e",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "40px 48px",
        overflow: "hidden",
      }}>

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
            width: 38, height: 38, borderRadius: 10,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 12px rgba(37,99,235,0.4)",
            flexShrink: 0
          }}>
            <span style={{ color: "white", fontWeight: 800, fontSize: 12 }}>IDS</span>
          </div>
          <span style={{ color: "white", fontWeight: 600, fontSize: 14, letterSpacing: 0.3 }}>
            Intelligent Distance System
          </span>
        </div>

        {/* Center Content */}
        <div>
          <p style={{
            color: "#3b82f6", fontSize: 11, fontWeight: 700,
            letterSpacing: "0.2em", textTransform: "uppercase",
            marginBottom: 16
          }}>
            Welcome to
          </p>
          <h1 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 42, fontWeight: 700, color: "white",
            lineHeight: 1.2, marginBottom: 20
          }}>
            Adaptive Learning Platform
          </h1>
          <p style={{
            color: "#475569", fontSize: 15, lineHeight: 1.7,
            maxWidth: 420
          }}>
            A personalized learning experience powered by AI — tailored to your level, your pace, your goals.
          </p>

          {/* Feature Pills */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 32 }}>
            {["AI-Powered", "Adaptive", "Progress Tracking", "Multi-Level"].map((f) => (
              <span key={f} style={{
                backgroundColor: "rgba(37,99,235,0.12)",
                color: "#60a5fa",
                padding: "5px 14px", borderRadius: 20,
                fontSize: 12, fontWeight: 500,
                border: "1px solid rgba(37,99,235,0.2)"
              }}>
                {f}
              </span>
            ))}
          </div>
        </div>

        {/* Bottom Subjects */}
        <div>
          <p style={{ color: "#1e293b", fontSize: 11, marginBottom: 10, letterSpacing: "0.1em" }}>
            AVAILABLE SUBJECTS
          </p>
          <div style={{ display: "flex", gap: 16 }}>
            {[
              { name: "Physics", color: "#2563eb" },
              { name: "Chemistry", color: "#16a34a" },
              { name: "Biology", color: "#059669" },
              { name: "Maths", color: "#9333ea" },
            ].map((s) => (
              <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{
                  width: 6, height: 6, borderRadius: "50%",
                  backgroundColor: s.color
                }} />
                <span style={{ color: "#334155", fontSize: 12 }}>{s.name}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Right Panel */}
      <div style={{
        width: "50%",
        backgroundColor: "#f8fafc",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px",
      }}>
        <div style={{ width: "100%", maxWidth: 380 }}>

          <h2 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 32, fontWeight: 700, color: "#0f172a", marginBottom: 6
          }}>
            Get Started
          </h2>
          <p style={{ color: "#94a3b8", fontSize: 14, marginBottom: 32 }}>
            Select your role to continue
          </p>

          {/* Role Cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Student */}
            <div
              onClick={() => router.push("/login")}
              onMouseEnter={() => setHoveredRole("student")}
              onMouseLeave={() => setHoveredRole(null)}
              style={{
                backgroundColor: hoveredRole === "student" ? "#eff6ff" : "white",
                border: `2px solid ${hoveredRole === "student" ? "#2563eb" : "#e2e8f0"}`,
                borderRadius: 14, padding: "20px 20px",
                cursor: "pointer", transition: "all 0.2s ease",
                boxShadow: hoveredRole === "student" ? "0 8px 24px rgba(37,99,235,0.1)" : "0 1px 4px rgba(0,0,0,0.04)",
                display: "flex", alignItems: "center", gap: 16
              }}
            >
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                backgroundColor: hoveredRole === "student" ? "#2563eb" : "#f1f5f9",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, transition: "all 0.2s", fontSize: 22
              }}>
                👨‍🎓
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ color: "#0f172a", fontWeight: 600, fontSize: 15, margin: 0 }}>
                  Student
                </p>
                <p style={{ color: "#94a3b8", fontSize: 12, margin: 0, marginTop: 2 }}>
                  Access your learning dashboard
                </p>
              </div>
              <span style={{
                color: hoveredRole === "student" ? "#2563eb" : "#cbd5e1",
                fontSize: 18, transition: "color 0.2s"
              }}>→</span>
            </div>

            {/* Admin */}
            <div
              onClick={() => router.push("/admin/login")}
              onMouseEnter={() => setHoveredRole("admin")}
              onMouseLeave={() => setHoveredRole(null)}
              style={{
                backgroundColor: hoveredRole === "admin" ? "#0f172a" : "white",
                border: `2px solid ${hoveredRole === "admin" ? "#0f172a" : "#e2e8f0"}`,
                borderRadius: 14, padding: "20px 20px",
                cursor: "pointer", transition: "all 0.2s ease",
                boxShadow: hoveredRole === "admin" ? "0 8px 24px rgba(0,0,0,0.15)" : "0 1px 4px rgba(0,0,0,0.04)",
                display: "flex", alignItems: "center", gap: 16
              }}
            >
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                backgroundColor: hoveredRole === "admin" ? "#1e293b" : "#f1f5f9",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, transition: "all 0.2s", fontSize: 22
              }}>
                👨‍💼
              </div>
              <div style={{ flex: 1 }}>
                <p style={{
                  color: hoveredRole === "admin" ? "white" : "#0f172a",
                  fontWeight: 600, fontSize: 15, margin: 0
                }}>
                  Administrator
                </p>
                <p style={{
                  color: hoveredRole === "admin" ? "#64748b" : "#94a3b8",
                  fontSize: 12, margin: 0, marginTop: 2
                }}>
                  Manage students and analytics
                </p>
              </div>
              <span style={{
                color: hoveredRole === "admin" ? "#64748b" : "#cbd5e1",
                fontSize: 18, transition: "color 0.2s"
              }}>→</span>
            </div>

          </div>

          {/* Footer note */}
          <p style={{
            textAlign: "center", color: "#cbd5e1",
            fontSize: 12, marginTop: 32
          }}>
            Powered by AI · Adaptive Learning Technology
          </p>

        </div>
      </div>

    </div>
  );
}