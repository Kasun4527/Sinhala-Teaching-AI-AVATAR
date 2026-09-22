"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { signupUser, getErrorMessage } from "@/services/api";

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

const PASSWORD_RULES = [
  { id: "len",     label: "At least 8 characters",       test: (p) => p.length >= 8 },
  { id: "upper",   label: "One uppercase letter (A-Z)",   test: (p) => /[A-Z]/.test(p) },
  { id: "lower",   label: "One lowercase letter (a-z)",   test: (p) => /[a-z]/.test(p) },
  { id: "number",  label: "One number (0-9)",              test: (p) => /[0-9]/.test(p) },
  { id: "special", label: "One special character (!@#...)", test: (p) => /[^A-Za-z0-9]/.test(p) },
];

function validatePassword(password) {
  const failed = PASSWORD_RULES.filter((r) => !r.test(password));
  return failed.length === 0 ? null : failed[0].label;
}

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", education_level: "", email: "", password: "", teacherCode: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pwFocused, setPwFocused] = useState(false);
  const [done, setDone] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async () => {
    setError("");
    const pwError = validatePassword(form.password);
    if (pwError) { setError("Password must include: " + pwError); return; }
    setLoading(true);
    try {
      const { teacherCode, ...rest } = form;
      await signupUser({ ...rest, teacher_code: teacherCode.trim() || null, education_level: form.education_level || null, role: "student" });
      setDone(true);
    } catch (err) {
      setError(getErrorMessage(err, "Signup failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-shell" style={{ position: "relative" }}>

      {/* Left Dark Panel */}
      <div style={{
        width: "45%",
        display: "flex", flexDirection: "column",
        justifyContent: "flex-start", padding: "120px 48px 60px"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 64 }}>
          <img src="/logo.png" alt="SUBHASHA" style={{ height: 38, width: "auto", objectFit: "contain", flexShrink: 0 }} />
          <span className="text-logo c-white">SUBHASHA Platform</span>
        </div>

        <p className="text-label c-blue-accent" style={{ marginBottom: 16 }}>
          Join Today
        </p>
        <h1 className="text-page-title c-white" style={{ marginBottom: 16 }}>
          Start Learning at Your Own Pace
        </h1>
        <p className="text-body c-muted">
          Create your account and get access to AI-powered personalized lessons tailored to your level.
        </p>

        {/* Decorative Video */}
        <div style={{ 
          marginTop: 48, 
          borderRadius: 16, 
          overflow: "hidden", 
          border: "1px solid rgba(255,255,255,0.1)", 
          boxShadow: "0 20px 40px rgba(0,0,0,0.4)" 
        }}>
          <video 
            src="/videos/create_acc.mp4" 
            autoPlay 
            loop 
            muted 
            playsInline
            style={{ width: "100%", height: "auto", display: "block" }}
          />
        </div>
      </div>

      {/* Right Form */}
      <div style={{
        flex: 1, 
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "48px", position: "relative"
      }}>
        <ParticleNetwork color="#ffffff" />
        
        <div 
          className="transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_20px_50px_rgba(37,99,235,0.15)]"
          style={{ 
          width: "100%", maxWidth: 480, position: "relative", zIndex: 1,
          backgroundColor: "rgba(255,255,255,0.05)",
          backdropFilter: "blur(10px)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 20,
          padding: "40px"
        }}>

          {done ? (
            <div style={{ textAlign: "center", color: "white" }}>
              <div style={{ fontSize: 52, marginBottom: 20 }}>📧</div>
              <h2 style={{  fontSize: 26, fontWeight: 700, color: "white", marginBottom: 10 }}>
                Check your email
              </h2>
              <p style={{ color: "#bfdbfe", fontSize: 14, lineHeight: 1.7, marginBottom: 24 }}>
                We sent a verification link to <strong style={{ color: "white" }}>{form.email}</strong>.<br />
                Click the link in the email to activate your account.
              </p>
              <div style={{ background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.3)", borderRadius: 12, padding: "14px 20px", marginBottom: 24 }}>
                <p style={{ margin: 0, color: "#93c5fd", fontSize: 13, lineHeight: 1.6 }}>
                  📬 <strong>Check your Spam / Junk folder</strong> — the email may be filtered there.<br />
                  Mark it as <em>"Not spam"</em> so future emails arrive in your inbox.
                </p>
              </div>
              <button
                onClick={() => router.push("/login")}
                style={{
                  width: "100%", padding: "13px", backgroundColor: "#3b82f6",
                  color: "white", border: "none", borderRadius: 10,
                  fontSize: 14, fontWeight: 600, cursor: "pointer",
                }}
              >
                Go to Login →
              </button>
            </div>
          ) : (<>

          <h2 style={{
            
            fontSize: 28, fontWeight: 700, color: "white", marginBottom: 6
          }}>
            Create account
          </h2>
          <p style={{ color: "#bfdbfe", fontSize: 14, marginBottom: 32 }}>
            Register as a student to get started
          </p>

          {error && (
            <div style={{
              backgroundColor: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
              color: "#fca5a5", fontSize: 13, padding: "12px 16px",
              borderRadius: 10, marginBottom: 20
            }}>
              {error}
            </div>
          )}

          {[
            { label: "Full Name", name: "name", type: "text", placeholder: "Your full name" },
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
                style={{
                  width: "100%", padding: "12px 16px",
                  border: "1.5px solid #e2e8f0",
                  borderRadius: 10, fontSize: 14, outline: "none",
                  backgroundColor: "white", color: "#0f172a", boxSizing: "border-box"
                }}
              />
            </div>
          ))}

          {/* Education Level Dropdown */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ color: "#475569", fontSize: 13, fontWeight: 500, display: "block", marginBottom: 6 }}>
              Education Level
            </label>
            <select
              name="education_level"
              value={form.education_level}
              onChange={handleChange}
              style={{
                width: "100%", padding: "12px 16px",
                border: `1.5px solid ${!form.education_level && form.name ? "#fca5a5" : "#e2e8f0"}`,
                borderRadius: 10, fontSize: 14, outline: "none",
                backgroundColor: "white", color: form.education_level ? "#0f172a" : "#94a3b8",
                boxSizing: "border-box", cursor: "pointer",
                appearance: "none",
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M3 4.5L6 7.5L9 4.5' stroke='%2394a3b8' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round' fill='none'/%3E%3C/svg%3E")`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 14px center",
              }}
            >
              <option value="" disabled>Select your grade level</option>
              <option value="OL">G.C.E. (O/L) — සාමාන්‍ය පෙළ</option>
              <option value="AL">G.C.E. (A/L) — උසස් පෙළ</option>
            </select>
          </div>

          {[
            { label: "Email Address", name: "email", type: "email", placeholder: "you@example.com" },
            { label: "Password", name: "password", type: "password", placeholder: "Create a strong password" },
            { label: "Teacher Code (optional)", name: "teacherCode", type: "text", placeholder: "Ask your teacher for their code" },
          ].map((field) => (
            <div key={field.name} style={{ marginBottom: 20 }}>
              <label style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 500, display: "block", marginBottom: 6 }}>
                {field.label}
              </label>
              
              <div className="relative group transition-all duration-300 focus-within:-translate-y-1 focus-within:scale-[1.02] focus-within:shadow-[0_10px_40px_rgba(59,130,246,0.2)] rounded-xl">
                <input
                  type={field.name === "password" ? (showPassword ? "text" : "password") : field.type}
                  name={field.name}
                  value={form[field.name]}
                  onChange={handleChange}
                  placeholder={field.placeholder}
                  onFocus={() => field.name === "password" && setPwFocused(true)}
                  onBlur={() => field.name === "password" && setPwFocused(false)}
                  className={`w-full px-4 py-3 border rounded-xl text-sm outline-none bg-white/10 text-white backdrop-blur-sm transition-all duration-300 focus:border-blue-400 focus:bg-white/20 ${field.name === "password" ? "pr-12" : ""}`}
                  style={{
                    border: `1px solid ${field.name === "password" && form.password && validatePassword(form.password) ? "#fca5a5" : "rgba(255,255,255,0.2)"}`
                  }}
                />
                
                {field.name === "password" && (
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    )}
                  </button>
                )}
              </div>

              {field.name === "password" && (pwFocused || form.password) && (
                <div style={{
                  marginTop: 10, padding: "12px 14px",
                  backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 10,
                }}>
                  <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Password requirements
                  </p>
                  {PASSWORD_RULES.map((rule) => {
                    const passed = rule.test(form.password);
                    return (
                      <div key={rule.id} style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
                        <div style={{
                          width: 16, height: 16, borderRadius: "50%", flexShrink: 0,
                          backgroundColor: passed ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.1)",
                          border: `1.5px solid ${passed ? "#22c55e" : "rgba(255,255,255,0.2)"}`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 9, color: passed ? "#4ade80" : "#94a3b8",
                          transition: "all 0.2s",
                        }}>
                          {passed ? "✓" : ""}
                        </div>
                        <span style={{ fontSize: 12, color: passed ? "#4ade80" : "#94a3b8", transition: "color 0.2s" }}>
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
            disabled={loading || !form.education_level}
            style={{
              width: "100%", padding: "13px",
              backgroundColor: loading ? "#93c5fd" : "#3b82f6",
              color: "white", border: "none", borderRadius: 10,
              fontSize: 14, fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              marginTop: 8, transition: "background 0.2s"
            }}
          >
            {loading ? "Creating account..." : "Create Account →"}
          </button>

          <p style={{ textAlign: "center", color: "#94a3b8", fontSize: 13, marginTop: 24 }}>
            Already have an account?{" "}
            <span
              onClick={() => router.push("/login")}
              style={{ color: "#93c5fd", cursor: "pointer", fontWeight: 600 }}
            >
              Sign in
            </span>
          </p>

          <p style={{ textAlign: "center", marginTop: 12 }}>
            <span
              onClick={() => router.push("/")}
              style={{ color: "#64748b", fontSize: 12, cursor: "pointer" }}
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