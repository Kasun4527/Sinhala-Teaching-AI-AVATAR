"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { loginUser, getErrorMessage } from "@/services/api";

function ParticleNetwork({ color }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let W = canvas.width  = canvas.offsetWidth;
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

      // Draw connecting lines
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

      // Draw dots
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


const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [unverified, setUnverified] = useState(false);
  const [resendStatus, setResendStatus] = useState(""); // "" | "sending" | "sent" | "error"

  const handleChange = (e) => { setForm({ ...form, [e.target.name]: e.target.value }); setUnverified(false); setError(""); };

  const handleSubmit = async () => {
    setError(""); setUnverified(false);
    setLoading(true);
    try {
      const res = await loginUser(form);
      const data = res.data;
      if (data.role !== "student") {
        setError("Access denied. This login is for students only.");
        return;
      }
      localStorage.setItem("token", data.token);
      localStorage.setItem("role", data.role);
      localStorage.setItem("name", data.name);
      localStorage.setItem("student_id", data.student_id);
      router.push("/dashboard");
    } catch (err) {
      const detail = getErrorMessage(err, "Login failed");
      if (err?.response?.status === 403) {
        setUnverified(true);
      } else {
        setError(detail);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResendStatus("sending");
    try {
      const res = await fetch(`${BACKEND}/auth/resend-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email }),
      });
      setResendStatus(res.ok ? "sent" : "error");
    } catch { setResendStatus("error"); }
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>

      {/* Left Dark Panel */}
      <div style={{
        width: "45%", backgroundColor: "#0f172a",
        display: "flex", flexDirection: "column",
        justifyContent: "center", padding: "60px 48px"
      }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 10, marginBottom: 64
        }}>
          <div style={{
            backgroundColor: "#2563eb", width: 36, height: 36,
            borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center"
          }}>
            <span style={{ color: "white", fontWeight: 700, fontSize: 12 }}>IDS</span>
          </div>
          <span style={{ color: "white", fontWeight: 600, fontSize: 14 }}>IDS Platform</span>
        </div>

        <p style={{ color: "#3b82f6", fontSize: 11, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 16 }}>
          Student Portal
        </p>
        <h1 style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 38, fontWeight: 700, color: "white",
          lineHeight: 1.2, marginBottom: 16
        }}>
          Continue Your Learning Journey
        </h1>
        <p style={{ color: "#64748b", fontSize: 15, lineHeight: 1.6 }}>
          Sign in to access your personalized lessons, quizzes, and progress tracking.
        </p>
      </div>

      {/* Right Form Panel */}
      <div style={{
        flex: 1, backgroundColor: "#f8fafc",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "48px", position: "relative", overflow: "hidden"
      }}>
        <ParticleNetwork color="#2563eb" />

        <div style={{ width: "100%", maxWidth: 400, position: "relative", zIndex: 1 }}>

          <h2 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 28, fontWeight: 700, color: "#0f172a", marginBottom: 6
          }}>
            Welcome back
          </h2>
          <p style={{ color: "#94a3b8", fontSize: 14, marginBottom: 32 }}>
            Sign in to your student account
          </p>

          {error && (
            <div style={{ backgroundColor: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontSize: 13, padding: "12px 16px", borderRadius: 10, marginBottom: 20 }}>
              {error}
            </div>
          )}

          {unverified && (
            <div style={{ backgroundColor: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "14px 16px", marginBottom: 20 }}>
              <p style={{ margin: "0 0 8px", color: "#92400e", fontSize: 13, fontWeight: 600 }}>Email not verified</p>
              <p style={{ margin: "0 0 12px", color: "#78350f", fontSize: 13, lineHeight: 1.6 }}>
                Please check your inbox and click the verification link before logging in.
              </p>
              {resendStatus === "sent" ? (
                <p style={{ margin: 0, color: "#16a34a", fontSize: 13, fontWeight: 500 }}>✓ Verification email resent — check your inbox.</p>
              ) : (
                <button
                  onClick={handleResend}
                  disabled={resendStatus === "sending"}
                  style={{ background: "none", border: "none", padding: 0, color: "#b45309", fontSize: 13, fontWeight: 600, cursor: "pointer", textDecoration: "underline" }}
                >
                  {resendStatus === "sending" ? "Sending…" : resendStatus === "error" ? "Failed — try again" : "Resend verification email"}
                </button>
              )}
            </div>
          )}

          <div style={{ marginBottom: 20 }}>
            <label style={{ color: "#475569", fontSize: 13, fontWeight: 500, display: "block", marginBottom: 6 }}>
              Email Address
            </label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="you@example.com"
              style={{
                width: "100%", padding: "12px 16px",
                border: "1.5px solid #e2e8f0", borderRadius: 10,
                fontSize: 14, outline: "none", backgroundColor: "white",
                color: "#0f172a", boxSizing: "border-box"
              }}
            />
          </div>

          <div style={{ marginBottom: 28 }}>
            <label style={{ color: "#475569", fontSize: 13, fontWeight: 500, display: "block", marginBottom: 6 }}>
              Password
            </label>
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="Enter your password"
              style={{
                width: "100%", padding: "12px 16px",
                border: "1.5px solid #e2e8f0", borderRadius: 10,
                fontSize: 14, outline: "none", backgroundColor: "white",
                color: "#0f172a", boxSizing: "border-box"
              }}
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              width: "100%", padding: "13px",
              backgroundColor: loading ? "#93c5fd" : "#2563eb",
              color: "white", border: "none", borderRadius: 10,
              fontSize: 14, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer",
              transition: "background 0.2s"
            }}
          >
            {loading ? "Signing in..." : "Sign In →"}
          </button>

          <p style={{ textAlign: "center", color: "#94a3b8", fontSize: 13, marginTop: 24 }}>
            Don't have an account?{" "}
            <span
              onClick={() => router.push("/signup")}
              style={{ color: "#2563eb", cursor: "pointer", fontWeight: 500 }}
            >
              Sign up
            </span>
          </p>

          <p style={{ textAlign: "center", marginTop: 12 }}>
            <span
              onClick={() => router.push("/")}
              style={{ color: "#94a3b8", fontSize: 12, cursor: "pointer" }}
            >
              ← Back to home
            </span>
          </p>

        </div>
      </div>
    </div>
  );
}