"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getErrorMessage } from "@/services/api";

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
      vx: (Math.random() - 0.5) * 0.5, vy: (Math.random() - 0.5) * 0.5,
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
            ctx.lineWidth = 1; ctx.stroke();
          }
        }
      }
      for (const p of particles) {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = color + "99"; ctx.fill();
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
import { signupUser } from "@/services/api";

const PASSWORD_RULES = [
  { id: "len",     label: "At least 8 characters",        test: (p) => p.length >= 8 },
  { id: "upper",   label: "One uppercase letter (A-Z)",    test: (p) => /[A-Z]/.test(p) },
  { id: "lower",   label: "One lowercase letter (a-z)",    test: (p) => /[a-z]/.test(p) },
  { id: "number",  label: "One number (0-9)",               test: (p) => /[0-9]/.test(p) },
  { id: "special", label: "One special character (!@#...)", test: (p) => /[^A-Za-z0-9]/.test(p) },
];

function validatePassword(password) {
  const failed = PASSWORD_RULES.filter((r) => !r.test(password));
  return failed.length === 0 ? null : failed[0].label;
}

export default function AdminSignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pwFocused, setPwFocused] = useState(false);
  const [done, setDone] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async () => {
    setError("");
    const pwError = validatePassword(form.password);
    if (pwError) { setError("Password must include: " + pwError); return; }
    setLoading(true);
    try {
      await signupUser({ ...form, role: "admin" });
      setDone(true);
    } catch (err) {
      setError(getErrorMessage(err, "Signup failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>

      {/* Left Dark Panel */}
      <div style={{
        width: "45%", backgroundColor: "#0f172a",
        display: "flex", flexDirection: "column",
        justifyContent: "center", padding: "60px 48px"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 64 }}>
          <div style={{
            backgroundColor: "#2563eb", width: 36, height: 36,
            borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center"
          }}>
            <span style={{ color: "white", fontWeight: 700, fontSize: 12 }}>IDS</span>
          </div>
          <span style={{ color: "white", fontWeight: 600, fontSize: 14 }}>IDS Platform</span>
        </div>

        <p style={{ color: "#3b82f6", fontSize: 11, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 16 }}>
          Admin Registration
        </p>
        <h1 style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 38, fontWeight: 700, color: "white",
          lineHeight: 1.2, marginBottom: 16
        }}>
          Create Your Admin Account
        </h1>
        <p style={{ color: "#64748b", fontSize: 15, lineHeight: 1.6 }}>
          Register as an administrator to manage students and monitor their learning progress.
        </p>
      </div>

      {/* Right Form */}
      <div style={{
        flex: 1, backgroundColor: "#f8fafc",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "48px", position: "relative", overflow: "hidden"
      }}>
        <ParticleNetwork color="#2563eb" />
        <div style={{ width: "100%", maxWidth: 400, position: "relative", zIndex: 1 }}>

          {done ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 52, marginBottom: 20 }}>📧</div>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 700, color: "#0f172a", marginBottom: 10 }}>
                Check your email
              </h2>
              <p style={{ color: "#64748b", fontSize: 14, lineHeight: 1.7, marginBottom: 24 }}>
                We sent a verification link to <strong style={{ color: "#0f172a" }}>{form.email}</strong>.<br />
                Click the link in the email to activate your admin account.
              </p>
              <div style={{ background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 12, padding: "14px 20px", marginBottom: 24 }}>
                <p style={{ margin: 0, color: "#92400e", fontSize: 13, lineHeight: 1.6 }}>
                  📬 <strong>Check your Spam / Junk folder</strong> — the email may be filtered there.<br />
                  Mark it as <em>"Not spam"</em> so future emails arrive in your inbox.
                </p>
              </div>
              <button
                onClick={() => router.push("/admin/login")}
                style={{
                  width: "100%", padding: "13px", backgroundColor: "#0f172a",
                  color: "white", border: "none", borderRadius: 10,
                  fontSize: 14, fontWeight: 600, cursor: "pointer",
                }}
              >
                Go to Admin Login →
              </button>
            </div>
          ) : (<>

          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            backgroundColor: "#fef3c7", color: "#92400e",
            padding: "6px 12px", borderRadius: 20,
            fontSize: 12, fontWeight: 600, marginBottom: 24
          }}>
            👨‍💼 Administrator Registration
          </div>

          <h2 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 28, fontWeight: 700, color: "#0f172a", marginBottom: 6
          }}>
            Create Admin Account
          </h2>
          <p style={{ color: "#94a3b8", fontSize: 14, marginBottom: 32 }}>
            Fill in your details to register
          </p>

          {error && (
            <div style={{
              backgroundColor: "#fef2f2", border: "1px solid #fecaca",
              color: "#dc2626", fontSize: 13, padding: "12px 16px",
              borderRadius: 10, marginBottom: 20
            }}>
              {error}
            </div>
          )}

          {[
            { label: "Full Name", name: "name", type: "text", placeholder: "Your full name" },
            { label: "Email Address", name: "email", type: "email", placeholder: "admin@example.com" },
            { label: "Password", name: "password", type: "password", placeholder: "Create a strong password" },
          ].map((field) => (
            <div key={field.name} style={{ marginBottom: 20 }}>
              <label style={{ color: "#475569", fontSize: 13, fontWeight: 500, display: "block", marginBottom: 6 }}>
                {field.label}
              </label>
              <input
                type={field.type}
                name={field.name}
                value={form[field.name]}
                onChange={handleChange}
                placeholder={field.placeholder}
                onFocus={() => field.name === "password" && setPwFocused(true)}
                onBlur={() => field.name === "password" && setPwFocused(false)}
                style={{
                  width: "100%", padding: "12px 16px",
                  border: `1.5px solid ${field.name === "password" && form.password && validatePassword(form.password) ? "#fca5a5" : "#e2e8f0"}`,
                  borderRadius: 10, fontSize: 14, outline: "none",
                  backgroundColor: "white", color: "#0f172a", boxSizing: "border-box"
                }}
              />
              {field.name === "password" && (pwFocused || form.password) && (
                <div style={{
                  marginTop: 10, padding: "12px 14px",
                  backgroundColor: "#f8fafc", border: "1px solid #e2e8f0",
                  borderRadius: 10,
                }}>
                  <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Password requirements
                  </p>
                  {PASSWORD_RULES.map((rule) => {
                    const passed = rule.test(form.password);
                    return (
                      <div key={rule.id} style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
                        <div style={{
                          width: 16, height: 16, borderRadius: "50%", flexShrink: 0,
                          backgroundColor: passed ? "#dcfce7" : "#f1f5f9",
                          border: `1.5px solid ${passed ? "#22c55e" : "#cbd5e1"}`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 9, color: passed ? "#16a34a" : "#94a3b8",
                          transition: "all 0.2s",
                        }}>
                          {passed ? "✓" : ""}
                        </div>
                        <span style={{ fontSize: 12, color: passed ? "#16a34a" : "#94a3b8", transition: "color 0.2s" }}>
                          {rule.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}

          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              width: "100%", padding: "13px",
              backgroundColor: loading ? "#94a3b8" : "#0f172a",
              color: "white", border: "none", borderRadius: 10,
              fontSize: 14, fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              marginTop: 8
            }}
          >
            {loading ? "Creating account..." : "Create Admin Account →"}
          </button>

          <p style={{ textAlign: "center", color: "#94a3b8", fontSize: 13, marginTop: 24 }}>
            Already have an account?{" "}
            <span
              onClick={() => router.push("/admin/login")}
              style={{ color: "#2563eb", cursor: "pointer", fontWeight: 500 }}
            >
              Sign in
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

          </>)}
        </div>
      </div>
    </div>
  );
}