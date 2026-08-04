"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState, Suspense } from "react";
import Sidebar from "@/components/Sidebar";

function FloatingPattern({ color }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const chars = "0123456789ABCDEFabcdefijklmnopqrstuvwxyz+-=><[]{}|/\\".split("");
    let W = canvas.width  = canvas.offsetWidth;
    let H = canvas.height = canvas.offsetHeight;
    const particles = Array.from({ length: 120 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      char: chars[Math.floor(Math.random() * chars.length)],
      size: 9 + Math.random() * 8,
      speed: 0.18 + Math.random() * 0.32,
      opacity: 0.35 + Math.random() * 0.30,
      drift: (Math.random() - 0.5) * 0.15,
    }));
    let raf;
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      for (const p of particles) {
        ctx.font = `${p.size}px monospace`;
        ctx.fillStyle = color + Math.round(p.opacity * 255).toString(16).padStart(2, "0");
        ctx.fillText(p.char, p.x, p.y);
        p.y += p.speed; p.x += p.drift;
        if (p.y > H + 20) { p.y = -20; p.x = Math.random() * W; p.char = chars[Math.floor(Math.random() * chars.length)]; }
        if (p.x < -20 || p.x > W + 20) p.x = Math.random() * W;
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

const NAVY = "#0f172a";

const SUBJECT_CFG = {
  Physics:              { hue: "#2563eb", dark: "#1e3a8a" },
  Chemistry:            { hue: "#0891b2", dark: "#164e63" },
  Biology:              { hue: "#059669", dark: "#064e3b" },
  Maths:                { hue: "#7c3aed", dark: "#3b0764" },
  "ආර්ථික විද්‍යාව":   { hue: "#b45309", dark: "#78350f" },
  "බුද්ධ ධර්මය":       { hue: "#c026d3", dark: "#701a75" },
};
const DEFAULT_CFG = { hue: "#2563eb", dark: "#1e3a8a" };

const LEVEL_CFG = {
  Advanced:     { bg: "#f5f3ff", color: "#7c3aed", border: "#c4b5fd", dark: "#3b0764" },
  Intermediate: { bg: "#fffbeb", color: "#d97706", border: "#fde68a", dark: "#78350f" },
  Beginner:     { bg: "#f0fdf4", color: "#16a34a", border: "#6ee7b7", dark: "#064e3b" },
};

function scoreConfig(score) {
  if (score >= 8) return { color: "#059669", dark: "#064e3b", bg: "#ecfdf5", ring: "#6ee7b7", label: "Excellent" };
  if (score >= 5) return { color: "#d97706", dark: "#78350f", bg: "#fffbeb", ring: "#fde68a", label: "Good" };
  return       { color: "#dc2626", dark: "#7f1d1d", bg: "#fef2f2", ring: "#fecaca", label: "Needs Work" };
}

// Animated ring SVG
function ScoreRing({ score, color, dark }) {
  const [animated, setAnimated] = useState(false);
  const radius = 64;
  const circ   = 2 * Math.PI * radius;
  const pct    = score / 10;

  useEffect(() => { const t = setTimeout(() => setAnimated(true), 120); return () => clearTimeout(t); }, []);

  return (
    <div style={{ position: "relative", width: 160, height: 160, margin: "0 auto" }}>
      <svg width="160" height="160" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="80" cy="80" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
        <circle
          cx="80" cy="80" r={radius} fill="none"
          stroke="url(#scoreGrad)" strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={animated ? circ * (1 - pct) : circ}
          style={{ transition: "stroke-dashoffset 1.1s cubic-bezier(.22,.61,.36,1)" }}
        />
        <defs>
          <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.7)" />
            <stop offset="100%" stopColor="white" />
          </linearGradient>
        </defs>
      </svg>
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
      }}>
        <span style={{ fontFamily: "'Raleway', sans-serif", fontSize: 42, fontWeight: 800, color: "white", lineHeight: 1 }}>
          {score.toFixed(1)}
        </span>
        <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: 600, marginTop: 3 }}>/ 10</span>
      </div>
    </div>
  );
}

function ResultPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const subject = searchParams.get("subject");
  const lesson  = searchParams.get("lesson");
  const score   = Number(searchParams.get("score"));
  const level   = searchParams.get("level");
  const topic   = searchParams.get("topic");
  const type    = searchParams.get("type");
  const grade   = searchParams.get("grade") || "";
  const isPost  = type === "post";
  const isPractice = type === "practice";

  useEffect(() => {
    if (!localStorage.getItem("token")) router.push("/login");
  }, []);

  const cfg    = SUBJECT_CFG[subject] || DEFAULT_CFG;
  const sc     = scoreConfig(score);
  const lc     = LEVEL_CFG[level] || LEVEL_CFG["Beginner"];

  const message = isPost
    ? score >= 6
      ? { text: "Excellent work! You've mastered this topic.", cta: "Next Topic" }
      : { text: "Keep going — review the lesson and try again.", cta: "Review Lesson" }
    : isPractice
      ? { text: "Here's how you did on this practice quiz.", cta: "" }
      : { text: "Your personalised lesson has been prepared based on your result.", cta: "Start Lesson" };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f8fafc", fontFamily: "'Source Sans 3', sans-serif" }}>
      <Sidebar />

      <main style={{ flex: 1, minWidth: 0, overflowY: "auto" }}>

        {/* ── HERO (score ring lives here) ── */}
        <div style={{
          position: "relative", overflow: "hidden",
          background: `linear-gradient(145deg, ${NAVY} 0%, ${sc.dark} 55%, ${sc.color} 100%)`,
          padding: "56px 60px 52px",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 48,
        }}>
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.28,
            backgroundImage: "radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)",
            backgroundSize: "26px 26px" }} />
          <div style={{ position: "absolute", top: -80, right: -60, width: 380, height: 380, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(255,255,255,0.07) 0%, transparent 70%)", pointerEvents: "none" }} />

          {/* Left text */}
          <div style={{ position: "relative", flex: 1 }}>
            {/* Breadcrumb */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
              {[subject, lesson, topic].filter(Boolean).map((crumb, i, arr) => (
                <span key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ color: i === arr.length - 1 ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.3)", fontSize: 12, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>{crumb}</span>
                  {i < arr.length - 1 && <span style={{ color: "rgba(255,255,255,0.18)" }}>›</span>}
                </span>
              ))}
            </div>

            <h1 style={{ fontFamily: "'Raleway', sans-serif", fontSize: 38, fontWeight: 700, color: "#f1f5f9", margin: "0 0 10px", letterSpacing: "0.01em", lineHeight: 1.15 }}>
              {isPost ? "Post Quiz Result" : isPractice ? "Practice Quiz Result" : "Pre Quiz Result"}
            </h1>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, margin: "0 0 24px", lineHeight: 1.7 }}>
              {message.text}
            </p>

            {/* Score label chip */}
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.18)",
              borderRadius: 100, padding: "7px 18px",
            }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "white" }} />
              <span style={{ color: "white", fontWeight: 700, fontSize: 13, letterSpacing: "0.04em" }}>
                {sc.label}
              </span>
            </div>
          </div>

          {/* Score ring */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            <ScoreRing score={score} color={sc.color} dark={sc.dark} />
          </div>
        </div>

        {/* ── BODY ── */}
        <div style={{ padding: "44px 60px 72px", display: "flex", flexDirection: "column", alignItems: "center", position: "relative", overflow: "hidden" }}>
          <FloatingPattern color={sc.color} />
          <div style={{ width: "100%", maxWidth: 600, position: "relative", zIndex: 1 }}>

            {/* Info cards row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 32 }}>
              {/* Score card */}
              <div style={{
                background: "white", borderRadius: 18, overflow: "hidden",
                border: `1.5px solid ${sc.ring}`,
                boxShadow: `0 4px 20px ${sc.color}14`,
              }}>
                <div style={{ height: 4, background: `linear-gradient(90deg, ${sc.dark}, ${sc.color})` }} />
                <div style={{ padding: "20px 22px" }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 11, marginBottom: 14,
                    background: sc.bg, border: `1.5px solid ${sc.ring}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                      <path d="M9 2l1.8 3.6L15 6.3l-3 2.9.7 4.1L9 11.1l-3.7 2.2.7-4.1-3-2.9 4.2-.7z" fill={sc.color} />
                    </svg>
                  </div>
                  <p style={{ margin: "0 0 2px", fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.09em" }}>Score</p>
                  <p style={{ margin: 0, fontFamily: "'Raleway', sans-serif", fontSize: 32, fontWeight: 800, color: sc.color, lineHeight: 1 }}>{score.toFixed(1)}</p>
                  <p style={{ margin: "5px 0 0", fontSize: 11, color: "#cbd5e1", fontWeight: 500 }}>out of 10</p>
                  {/* Mini bar */}
                  <div style={{ marginTop: 14, height: 3, background: "#f1f5f9", borderRadius: 99 }}>
                    <div style={{ height: "100%", borderRadius: 99, width: `${(score / 10) * 100}%`, background: `linear-gradient(90deg, ${sc.dark}, ${sc.color})`, transition: "width 1s ease" }} />
                  </div>
                </div>
              </div>

              {/* Level card */}
              <div style={{
                background: "white", borderRadius: 18, overflow: "hidden",
                border: `1.5px solid ${lc.border}`,
                boxShadow: `0 4px 20px ${lc.color}14`,
              }}>
                <div style={{ height: 4, background: `linear-gradient(90deg, ${lc.dark}, ${lc.color})` }} />
                <div style={{ padding: "20px 22px" }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 11, marginBottom: 14,
                    background: lc.bg, border: `1.5px solid ${lc.border}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                      <rect x="2" y="11" width="3" height="5" rx="1" fill={lc.color}/>
                      <rect x="7" y="7" width="3" height="9" rx="1" fill={lc.color} opacity="0.7"/>
                      <rect x="12" y="3" width="3" height="13" rx="1" fill={lc.color} opacity="0.5"/>
                    </svg>
                  </div>
                  <p style={{ margin: "0 0 2px", fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.09em" }}>Level</p>
                  <p style={{ margin: 0, fontFamily: "'Raleway', sans-serif", fontSize: 20, fontWeight: 800, color: lc.color, lineHeight: 1.2 }}>{level}</p>
                  <span style={{
                    display: "inline-block", marginTop: 8,
                    background: lc.bg, border: `1px solid ${lc.border}`,
                    color: lc.color, fontSize: 10, fontWeight: 700,
                    padding: "2px 10px", borderRadius: 100, letterSpacing: "0.05em",
                  }}>Assigned</span>
                </div>
              </div>

              {/* Quiz type card */}
              <div style={{
                background: "white", borderRadius: 18, overflow: "hidden",
                border: "1.5px solid #e2e8f0",
                boxShadow: "0 4px 20px rgba(0,0,0,0.04)",
              }}>
                <div style={{ height: 4, background: `linear-gradient(90deg, ${cfg.dark}, ${cfg.hue})` }} />
                <div style={{ padding: "20px 22px" }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 11, marginBottom: 14,
                    background: "#f8fafc", border: "1.5px solid #e2e8f0",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                      <rect x="3" y="3" width="12" height="12" rx="2.5" stroke={cfg.hue} strokeWidth="1.5"/>
                      <path d="M6 9h6M6 6.5h4M6 11.5h3" stroke={cfg.hue} strokeWidth="1.4" strokeLinecap="round"/>
                    </svg>
                  </div>
                  <p style={{ margin: "0 0 2px", fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.09em" }}>Quiz</p>
                  <p style={{ margin: 0, fontFamily: "'Raleway', sans-serif", fontSize: 20, fontWeight: 800, color: NAVY, lineHeight: 1.2 }}>{isPost ? "Post" : isPractice ? "Practice" : "Pre"}</p>
                  <span style={{
                    display: "inline-block", marginTop: 8,
                    background: `${cfg.hue}12`, border: `1px solid ${cfg.hue}30`,
                    color: cfg.hue, fontSize: 10, fontWeight: 700,
                    padding: "2px 10px", borderRadius: 100, letterSpacing: "0.05em",
                  }}>Completed</span>
                </div>
              </div>
            </div>

            {/* Section divider */}
            <div style={{ height: 1, background: "linear-gradient(90deg, #e2e8f0, transparent)", marginBottom: 28 }} />

            {/* Action buttons */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

              {/* Primary CTA */}
              {(type === "pre" || (isPost && score < 6)) && (
                <button
                  onClick={() => router.push(`/lesson?topic=${topic}&level=${level}&subject=${subject}&lesson=${lesson}`)}
                  style={{
                    width: "100%", padding: "15px",
                    background: `linear-gradient(135deg, ${cfg.dark}, ${cfg.hue})`,
                    color: "white", border: "none", borderRadius: 14,
                    fontSize: 15, fontWeight: 700, cursor: "pointer",
                    boxShadow: `0 8px 24px ${cfg.hue}45`,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    letterSpacing: "0.02em",
                  }}
                >
                  {type === "pre" ? "Start Lesson" : "Review Lesson Again"}
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8h10M9 4l4 4-4 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              )}

              {isPractice && (
                <>
                  <button
                    onClick={() => router.push(`/lesson?topic=${topic}&level=${level}&subject=${subject}&lesson=${lesson}&mode=review`)}
                    style={{
                      width: "100%", padding: "15px",
                      background: `linear-gradient(135deg, ${cfg.dark}, ${cfg.hue})`,
                      color: "white", border: "none", borderRadius: 14,
                      fontSize: 15, fontWeight: 700, cursor: "pointer",
                      boxShadow: `0 8px 24px ${cfg.hue}45`,
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      letterSpacing: "0.02em",
                    }}
                  >
                    Review Lesson Content
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M3 8h10M9 4l4 4-4 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  <button
                    onClick={() => router.push(`/quiz?topic=${topic}&level=${level}&type=practice&subject=${subject}&lesson=${lesson}`)}
                    style={{
                      width: "100%", padding: "14px",
                      background: "white", color: cfg.hue,
                      border: `1.5px solid ${cfg.hue}40`, borderRadius: 14,
                      fontSize: 14, fontWeight: 700, cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      letterSpacing: "0.02em",
                    }}
                  >
                    Retake Practice Quiz
                  </button>
                </>
              )}

              {isPost && score >= 6 && (
                <button
                  onClick={() => router.push(`/topics?subject=${subject}&lesson=${encodeURIComponent(lesson)}&grade=${encodeURIComponent(grade)}`)}
                  style={{
                    width: "100%", padding: "15px",
                    background: "linear-gradient(135deg, #064e3b, #059669)",
                    color: "white", border: "none", borderRadius: 14,
                    fontSize: 15, fontWeight: 700, cursor: "pointer",
                    boxShadow: "0 8px 24px rgba(5,150,105,0.4)",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    letterSpacing: "0.02em",
                  }}
                >
                  Next Topic
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8h10M9 4l4 4-4 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              )}

              <button
                onClick={() => router.push("/dashboard")}
                style={{
                  width: "100%", padding: "14px",
                  background: "white", color: "#64748b",
                  border: "1.5px solid #e2e8f0", borderRadius: 14,
                  fontSize: 14, fontWeight: 600, cursor: "pointer",
                  transition: "border-color 0.15s",
                }}
              >
                Back to Dashboard
              </button>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}

export default function ResultPage() {
  return (
    <Suspense fallback={null}>
      <ResultPageContent />
    </Suspense>
  );
}
