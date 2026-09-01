"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

function ParticleNetwork({ color }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let W = canvas.width = canvas.offsetWidth;
    let H = canvas.height = canvas.offsetHeight;

    const CONNECT_DIST = 120;
    const particles = Array.from({ length: 55 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      r: 2.5 + Math.random() * 2.5,
    }));

    let raf;
    const draw = () => {
      ctx.clearRect(0, 0, W, H);

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CONNECT_DIST) {
            const alpha = (1 - dist / CONNECT_DIST) * 0.45;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = color + Math.round(alpha * 255).toString(16).padStart(2, "0");
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }

      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = color + "99";
        ctx.fill();

        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > W) p.vx *= -1;
        if (p.y < 0 || p.y > H) p.vy *= -1;
      }

      raf = requestAnimationFrame(draw);
    };
    draw();

    const onResize = () => { W = canvas.width = canvas.offsetWidth; H = canvas.height = canvas.offsetHeight; };
    window.addEventListener("resize", onResize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); };
  }, [color]);

  return <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} />;
}

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
    <div className="page-shell" style={{ width: "100vw" }}>

      {/* Left Panel */}
      <div style={{
        width: "50%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "40px 48px",
        overflow: "hidden",
        position: "relative"
      }}>
        {/* Logo (restored to original) */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, position: "absolute", top: 40, left: 48 }}>
          <img src="/logo.png" alt="SUBHASHA" style={{ height: 38, width: "auto", objectFit: "contain", flexShrink: 0 }} />
          <span className="text-logo c-white">
            SUBHASHA Platform
          </span>
        </div>

        {/* Center Content */}
        <div>
          <p className="text-label c-blue-accent" style={{ marginBottom: 16 }}>
            Welcome to
          </p>
          <h1 className="text-page-title c-white" style={{ marginBottom: 20 }}>
            SUBHASHA
          </h1>
          <p className="text-body c-muted" style={{ maxWidth: 420 }}>
            A personalized Sinhala-medium learning experience powered by AI — tailored to your level, your pace, your goals.
          </p>

          {/* Feature Pills */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 32 }}>
            {["AI-Powered", "Adaptive", "Progress Tracking", "Multi-Level"].map((f) => (
              <span key={f} style={{
                backgroundColor: "rgba(37,99,235,0.2)",
                color: "#93c5fd",
                padding: "5px 14px", borderRadius: 20,
                fontSize: 12, fontWeight: 500,
                border: "1px solid rgba(37,99,235,0.3)"
              }}>
                {f}
              </span>
            ))}
          </div>

          {/* User Manual Button */}
          <div style={{ marginTop: 40 }}>
            <button
              onClick={() => router.push("/manual")}
              style={{
                display: "inline-flex", alignItems: "center", gap: 10,
                backgroundColor: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.2)",
                color: "white", padding: "12px 24px",
                borderRadius: 8, cursor: "pointer",
                 fontSize: 14, fontWeight: 500,
                transition: "all 0.2s ease"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.2)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.3)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.1)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)";
              }}
            >
              📖 View User Manual
            </button>
          </div>
        </div>

      </div>

      {/* Right Panel */}
      <div style={{
        width: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px",
        position: "relative",
        overflow: "hidden",
      }}>
        <ParticleNetwork color="#ffffff" />

        <div style={{ width: "100%", maxWidth: 380, position: "relative", zIndex: 1 }}>

          <h2 style={{
            
            fontSize: 32, fontWeight: 700, color: "white", marginBottom: 6
          }}>
            Get Started
          </h2>
          <p style={{ color: "#bfdbfe", fontSize: 14, marginBottom: 32 }}>
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
                backgroundColor: hoveredRole === "student" ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.05)",
                border: `2px solid ${hoveredRole === "student" ? "#60a5fa" : "rgba(255,255,255,0.1)"}`,
                backdropFilter: "blur(10px)",
                borderRadius: 14, padding: "20px 20px",
                cursor: "pointer", transition: "all 0.2s ease",
                boxShadow: hoveredRole === "student" ? "0 8px 24px rgba(0,0,0,0.2)" : "0 1px 4px rgba(0,0,0,0.1)",
                display: "flex", alignItems: "center", gap: 16
              }}
            >
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                backgroundColor: hoveredRole === "student" ? "#2563eb" : "rgba(255,255,255,0.1)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, transition: "all 0.2s", fontSize: 22
              }}>
                👨‍🎓
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ color: "white", fontWeight: 600, fontSize: 15, margin: 0 }}>
                  Student
                </p>
                <p style={{ color: "#bfdbfe", fontSize: 12, margin: 0, marginTop: 2 }}>
                  Access your learning dashboard
                </p>
              </div>
              <span style={{
                color: hoveredRole === "student" ? "#93c5fd" : "rgba(255,255,255,0.3)",
                fontSize: 18, transition: "color 0.2s"
              }}>→</span>
            </div>

            {/* Admin */}
            <div
              onClick={() => router.push("/admin/login")}
              onMouseEnter={() => setHoveredRole("admin")}
              onMouseLeave={() => setHoveredRole(null)}
              style={{
                backgroundColor: hoveredRole === "admin" ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.05)",
                border: `2px solid ${hoveredRole === "admin" ? "#60a5fa" : "rgba(255,255,255,0.1)"}`,
                backdropFilter: "blur(10px)",
                borderRadius: 14, padding: "20px 20px",
                cursor: "pointer", transition: "all 0.2s ease",
                boxShadow: hoveredRole === "admin" ? "0 8px 24px rgba(0,0,0,0.2)" : "0 1px 4px rgba(0,0,0,0.1)",
                display: "flex", alignItems: "center", gap: 16
              }}
            >
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                backgroundColor: hoveredRole === "admin" ? "#2563eb" : "rgba(255,255,255,0.1)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, transition: "all 0.2s", fontSize: 22
              }}>
                👨‍💼
              </div>
              <div style={{ flex: 1 }}>
                <p style={{
                  color: "white",
                  fontWeight: 600, fontSize: 15, margin: 0
                }}>
                  Teacher
                </p>
                <p style={{
                  color: "#bfdbfe",
                  fontSize: 12, margin: 0, marginTop: 2
                }}>
                  Manage students and analytics
                </p>
              </div>
              <span style={{
                color: hoveredRole === "admin" ? "#93c5fd" : "rgba(255,255,255,0.3)",
                fontSize: 18, transition: "color 0.2s"
              }}>→</span>
            </div>

          </div>

          {/* Footer note */}
          <p style={{
            textAlign: "center", color: "#94a3b8",
            fontSize: 12, marginTop: 32
          }}>
            Powered by AI · Adaptive Learning Technology
          </p>

        </div>
      </div>

    </div>
  );
}