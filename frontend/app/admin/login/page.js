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


const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export default function AdminLoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailPlaceholder, setEmailPlaceholder] = useState("");
  const [passwordPlaceholder, setPasswordPlaceholder] = useState("");

  // Typewriter effect for the email placeholder
  useEffect(() => {
    const phrases = ["admin@example.com", "teacher@aiguru.lk", "instructor@domain.com"];
    let currentIndex = 0;
    let currentText = "";
    let isDeleting = false;
    let timeoutId;

    const type = () => {
      const fullText = phrases[currentIndex];
      
      if (isDeleting) {
        currentText = fullText.substring(0, currentText.length - 1);
      } else {
        currentText = fullText.substring(0, currentText.length + 1);
      }
      
      setEmailPlaceholder(currentText + (isDeleting ? "" : "|"));

      let typingSpeed = isDeleting ? 40 : 120; // Type speed

      if (!isDeleting && currentText === fullText) {
        typingSpeed = 2000; // Pause when fully typed
        isDeleting = true;
        setEmailPlaceholder(currentText); // Remove cursor when paused
      } else if (isDeleting && currentText === "") {
        isDeleting = false;
        currentIndex = (currentIndex + 1) % phrases.length;
        typingSpeed = 500; // Pause before typing next phrase
      }

      timeoutId = setTimeout(type, typingSpeed);
    };

    timeoutId = setTimeout(type, 1000);
    return () => clearTimeout(timeoutId);
  }, []);

  // Typewriter effect for the password placeholder
  useEffect(() => {
    const phrases = ["••••••••", "your admin password", "Enter password", "••••••••••"];
    let currentIndex = 0;
    let currentText = "";
    let isDeleting = false;
    let timeoutId;

    const type = () => {
      const fullText = phrases[currentIndex];
      
      if (isDeleting) {
        currentText = fullText.substring(0, currentText.length - 1);
      } else {
        currentText = fullText.substring(0, currentText.length + 1);
      }
      
      setPasswordPlaceholder(currentText + (isDeleting ? "" : "|"));

      let typingSpeed = isDeleting ? 40 : 120; // Type speed

      if (!isDeleting && currentText === fullText) {
        typingSpeed = 2000; // Pause when fully typed
        isDeleting = true;
        setPasswordPlaceholder(currentText); // Remove cursor when paused
      } else if (isDeleting && currentText === "") {
        isDeleting = false;
        currentIndex = (currentIndex + 1) % phrases.length;
        typingSpeed = 500; // Pause before typing next phrase
      }

      timeoutId = setTimeout(type, typingSpeed);
    };

    // Stagger the start slightly
    timeoutId = setTimeout(type, 1800);
    return () => clearTimeout(timeoutId);
  }, []);

  const handleChange = (e) => { setForm({ ...form, [e.target.name]: e.target.value }); setError(""); };

  const handleSubmit = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await loginUser(form);
      const data = res.data;
      if (data.role !== "admin") {
        setError("Access denied. This login is for admins only.");
        return;
      }
      localStorage.setItem("token", data.token);
      localStorage.setItem("role", data.role);
      localStorage.setItem("name", data.name);
      localStorage.setItem("student_id", data.student_id); // Backend might send this
      if (data.teacher_code) localStorage.setItem("teacher_code", data.teacher_code);
      router.push("/admin/dashboard");
    } catch (err) {
      setError(getErrorMessage(err, "Login failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      display: "flex", 
      minHeight: "100vh", 
      position: "relative",
      fontFamily: "'Poppins', sans-serif",
      background: "linear-gradient(to right, #020617 35%, #1e3a8a 85%, #1d4ed8 100%)",
      overflow: "hidden"
    }}>

      {/* Left Panel */}
      <div style={{
        width: "45%",
        display: "flex", flexDirection: "column",
        justifyContent: "center", padding: "60px 48px"
      }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 10, marginBottom: 64
        }}>
          <div style={{
            background: "linear-gradient(135deg, #2563eb, #1d4ed8)", width: 36, height: 36,
            borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 12px rgba(37,99,235,0.4)"
          }}>
            <span style={{ color: "white", fontWeight: 700, fontSize: 12 }}>IDS</span>
          </div>
          <span style={{ color: "white", fontWeight: 600, fontSize: 14 }}>Intelligent Distance System</span>
        </div>

        <p style={{ color: "#60a5fa", fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 16 }}>
          Admin Portal
        </p>
        <h1 style={{
          fontFamily: "'Poppins', sans-serif",
          fontSize: 38, fontWeight: 700, color: "white",
          lineHeight: 1.2, marginBottom: 16
        }}>
          Manage Your Students & Analytics
        </h1>
        <p style={{ color: "#94a3b8", fontSize: 15, lineHeight: 1.6 }}>
          Sign in to access the admin dashboard, monitor student progress, and track performance.
        </p>
      </div>

      {/* Center Image Graphic */}
      <div style={{
        position: "absolute",
        left: "43%", 
        bottom: 0,
        transform: "translateX(-50%)",
        height: "70vh",
        zIndex: 10,
        pointerEvents: "none",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}>
        <img 
          src="/techer_image.png" 
          alt="Teacher Graphic" 
          style={{ height: "100%", width: "auto", objectFit: "contain", objectPosition: "bottom" }} 
        />
      </div>

      {/* Right Form Panel */}
      <div style={{
        flex: 1, 
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "48px", position: "relative"
      }}>
        <ParticleNetwork color="#ffffff" />

        <div 
          className="transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_20px_50px_rgba(37,99,235,0.15)]"
          style={{ 
          width: "100%", maxWidth: 400, position: "relative", zIndex: 1,
          backgroundColor: "rgba(255,255,255,0.05)",
          backdropFilter: "blur(10px)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 20,
          padding: "40px"
        }}>
          
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            backgroundColor: "rgba(251, 191, 36, 0.2)", color: "#fcd34d",
            border: "1px solid rgba(251, 191, 36, 0.3)",
            padding: "6px 12px", borderRadius: 20,
            fontSize: 12, fontWeight: 600, marginBottom: 24
          }}>
            👨‍💼 Administrator Access
          </div>

          <h2 style={{
            fontFamily: "'Poppins', sans-serif",
            fontSize: 28, fontWeight: 700, color: "white", marginBottom: 6
          }}>
            Admin Sign In
          </h2>
          <p style={{ color: "#bfdbfe", fontSize: 14, marginBottom: 32 }}>
            Sign in to access the admin dashboard
          </p>

          {error && (
            <div style={{ backgroundColor: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5", fontSize: 13, padding: "12px 16px", borderRadius: 10, marginBottom: 20 }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: 20 }}>
            <label style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 500, display: "block", marginBottom: 6 }}>
              Email Address
            </label>
            <div className="relative group transition-all duration-300 focus-within:-translate-y-1 focus-within:scale-[1.02] focus-within:shadow-[0_10px_40px_rgba(59,130,246,0.2)] rounded-xl">
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder={emailPlaceholder}
                className="w-full px-4 py-3 border border-white/20 rounded-xl text-sm outline-none bg-white/10 text-white backdrop-blur-sm transition-all duration-300 focus:border-blue-400 focus:bg-white/20"
              />
            </div>
          </div>

          <div style={{ marginBottom: 28 }}>
            <label style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 500, display: "block", marginBottom: 6 }}>
              Password
            </label>
            <div className="relative group transition-all duration-300 focus-within:-translate-y-1 focus-within:scale-[1.02] focus-within:shadow-[0_10px_40px_rgba(59,130,246,0.2)] rounded-xl">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder={passwordPlaceholder}
                className="w-full px-4 py-3 border border-white/20 rounded-xl text-sm outline-none bg-white/10 text-white backdrop-blur-sm transition-all duration-300 focus:border-blue-400 focus:bg-white/20 pr-12"
              />
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
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              width: "100%", padding: "13px",
              backgroundColor: loading ? "#93c5fd" : "#3b82f6",
              color: "white", border: "none", borderRadius: 10,
              fontSize: 14, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer",
              transition: "background 0.2s"
            }}
          >
            {loading ? "Signing in..." : "Sign In →"}
          </button>

          <p style={{ textAlign: "center", color: "#94a3b8", fontSize: 13, marginTop: 24 }}>
            Don't have an admin account?{" "}
            <span
              onClick={() => router.push("/admin/signup")}
              style={{ color: "#93c5fd", cursor: "pointer", fontWeight: 600 }}
            >
              Sign up
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

        </div>
      </div>
    </div>
  );
}