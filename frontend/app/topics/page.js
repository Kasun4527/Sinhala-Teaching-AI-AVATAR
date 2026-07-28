"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { findSubjectByGrade, findSubject } from "@/data/curriculum";
import { useEffect, useRef, useState, Suspense } from "react";
import Sidebar from "@/components/Sidebar";
import ChatBot from "@/components/ChatBot";

const NAVY = "#0f172a";

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

const SUBJECT_CFG = {
  Physics:              { hue: "#2563eb", dark: "#1e3a8a", bg: "#eff6ff", ring: "#bfdbfe" },
  Chemistry:            { hue: "#0891b2", dark: "#164e63", bg: "#ecfeff", ring: "#a5f3fc" },
  Biology:              { hue: "#059669", dark: "#064e3b", bg: "#ecfdf5", ring: "#6ee7b7" },
  Maths:                { hue: "#7c3aed", dark: "#3b0764", bg: "#f5f3ff", ring: "#c4b5fd" },
  "ආර්ථික විද්‍යාව":   { hue: "#b45309", dark: "#78350f", bg: "#fffbeb", ring: "#fde68a" },
  "බුද්ධ ධර්මය":       { hue: "#c026d3", dark: "#701a75", bg: "#fdf4ff", ring: "#e879f9" },
  "විද්‍යාව":           { hue: "#0d9488", dark: "#134e4a", bg: "#f0fdfa", ring: "#99f6e4" },
};
const DEFAULT_CFG = { hue: "#2563eb", dark: "#1e3a8a", bg: "#eff6ff", ring: "#bfdbfe" };

function TopicsPageContent() {
  const params      = useSearchParams();
  const router      = useRouter();
  const subject     = params.get("subject");
  const lesson      = params.get("lesson");
  const grade       = params.get("grade") || "";
  const subjectData = grade ? findSubjectByGrade(subject, grade) : findSubject(subject);
  const lessonData  = subjectData?.lessons.find((l) => l.name === lesson);
  const [hovered, setHovered] = useState(null);

  useEffect(() => {
    if (!localStorage.getItem("token")) router.push("/login");
  }, []);

  const cfg = SUBJECT_CFG[subject] || DEFAULT_CFG;

  if (!lessonData || lessonData.topics.length === 0) return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar subject={subject} />
      <main style={{ flex: 1, padding: 48, backgroundColor: "#f8fafc", fontFamily: "'Source Sans 3', sans-serif" }}>
        <p style={{ color: "#94a3b8" }}>No topics available.</p>
      </main>
      <ChatBot subject={subject} lesson={lesson} accent={cfg.hue} />
    </div>
  );

  const topics = lessonData.topics;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f8fafc", fontFamily: "'Source Sans 3', sans-serif" }}>
      <Sidebar subject={subject} />

      <main style={{ flex: 1, minWidth: 0, overflowY: "auto" }}>

        {/* ── HERO ── */}
        <div style={{
          position: "relative", overflow: "hidden",
          background: `linear-gradient(145deg, ${NAVY} 0%, ${cfg.dark} 55%, ${cfg.hue} 100%)`,
          padding: "52px 60px 48px",
        }}>
          {/* Blueprint grid — matches dashboard */}
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none",
            backgroundImage: "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
            backgroundSize: "48px 48px" }} />
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none",
            backgroundImage: "linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)",
            backgroundSize: "12px 12px" }} />
          <div style={{ position: "absolute", top: -80, right: -60, width: 360, height: 360, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(147,197,253,0.2) 0%, transparent 70%)", pointerEvents: "none" }} />

          <div style={{ position: "relative" }}>
            {/* Back button */}
            <button
              onClick={() => router.push(`/sub-lesson?subject=${subject}&grade=${encodeURIComponent(grade)}`)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)",
                color: "rgba(255,255,255,0.6)", borderRadius: 100,
                padding: "5px 14px", fontSize: 12, fontWeight: 600,
                cursor: "pointer", marginBottom: 22, letterSpacing: "0.03em",
              }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M8 2L4 6l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Lessons
            </button>

            {/* Breadcrumb */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14 }}>
              {[grade, subject, lesson].filter(Boolean).map((crumb, i, arr) => (
                <span key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ color: i === arr.length - 1 ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.35)", fontSize: 12, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                    {crumb}
                  </span>
                  {i < arr.length - 1 && <span style={{ color: "rgba(255,255,255,0.2)" }}>›</span>}
                </span>
              ))}
            </div>

            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 32 }}>
              <div>
                <h1 style={{
                  fontFamily: "'Raleway', sans-serif",
                  fontSize: 40, fontWeight: 700, color: "#f1f5f9",
                  margin: "0 0 10px", letterSpacing: "0.01em", lineHeight: 1.1,
                }}>
                  Topics
                </h1>
                <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, margin: 0, lineHeight: 1.7 }}>
                  Select a topic to take your pre-lesson quiz and begin learning
                </p>
              </div>

              {/* Topic count tile */}
              <div style={{
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.10)",
                borderRadius: 14, padding: "14px 24px", textAlign: "center", flexShrink: 0,
              }}>
                <p style={{ margin: 0, fontSize: 32, fontWeight: 800, color: "#93c5fd", lineHeight: 1 }}>{topics.length}</p>
                <p style={{ margin: "6px 0 0", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.38)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Topics</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── BODY ── */}
        <div style={{ padding: "44px 60px 72px", position: "relative" }}>
          <ParticleNetwork color={cfg.hue} />


          {/* Section header */}
          <div style={{ marginBottom: 28, paddingBottom: 18, borderBottom: "2px solid #e2e8f0", position: "relative", zIndex: 1 }}>
            <h2 style={{ margin: 0, fontFamily: "'Raleway', sans-serif", fontSize: 22, fontWeight: 700, color: NAVY, letterSpacing: "0.03em" }}>
              {lesson}
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#94a3b8" }}>
              {topics.length} topic{topics.length !== 1 ? "s" : ""} — click any topic to start with a pre-quiz
            </p>
          </div>

          {/* Topics list */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12, position: "relative", zIndex: 1 }}>
            {topics.map((topic, i) => {
              const isH = hovered === i;
              return (
                <div
                  key={i}
                  onClick={() => router.push(
                    `/quiz?subject=${subject}&lesson=${encodeURIComponent(lesson)}&topic=${encodeURIComponent(topic)}&type=pre&grade=${encodeURIComponent(grade)}`
                  )}
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                  style={{
                    background: "white",
                    border: `1.5px solid ${isH ? cfg.hue + "55" : "#e8edf2"}`,
                    borderRadius: 14, overflow: "hidden", cursor: "pointer",
                    boxShadow: isH
                      ? `0 12px 36px rgba(0,0,0,0.08), 0 0 0 1px ${cfg.hue}12`
                      : "0 1px 4px rgba(0,0,0,0.04)",
                    transform: isH ? "translateX(4px)" : "translateX(0)",
                    transition: "all 0.2s cubic-bezier(.22,.61,.36,1)",
                    display: "flex", alignItems: "stretch",
                  }}
                >
                  {/* Left accent bar */}
                  <div style={{
                    width: 4, flexShrink: 0,
                    background: isH ? `linear-gradient(180deg, ${cfg.dark}, ${cfg.hue})` : "#f1f5f9",
                    transition: "background 0.2s",
                  }} />

                  <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "18px 24px", flex: 1 }}>
                    {/* Number badge */}
                    <div style={{
                      width: 42, height: 42, borderRadius: 12, flexShrink: 0,
                      background: isH ? `linear-gradient(135deg, ${cfg.dark}, ${cfg.hue})` : cfg.bg,
                      border: `1.5px solid ${isH ? "transparent" : cfg.ring}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontWeight: 800, fontSize: 14,
                      color: isH ? "white" : cfg.hue,
                      boxShadow: isH ? `0 4px 14px ${cfg.hue}40` : "none",
                      transition: "all 0.2s",
                    }}>
                      {String(i + 1).padStart(2, "0")}
                    </div>

                    {/* Topic name */}
                    <p style={{
                      flex: 1, margin: 0,
                      fontSize: 15, fontWeight: 600, color: isH ? NAVY : "#334155",
                      transition: "color 0.2s",
                    }}>
                      {topic}
                    </p>

                    {/* CTA chip */}
                    <div style={{
                      display: "flex", alignItems: "center", gap: 7, flexShrink: 0,
                      background: isH ? `linear-gradient(135deg, ${cfg.dark}, ${cfg.hue})` : cfg.bg,
                      border: `1.5px solid ${isH ? "transparent" : cfg.ring}`,
                      color: isH ? "white" : cfg.hue,
                      padding: "7px 16px", borderRadius: 100,
                      fontSize: 12, fontWeight: 700, letterSpacing: "0.03em",
                      boxShadow: isH ? `0 4px 14px ${cfg.hue}40` : "none",
                      transition: "all 0.2s",
                    }}>
                      Start Quiz
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2.5 6h7M6 2.5L9.5 6 6 9.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      <ChatBot subject={subject} lesson={lesson} accent={cfg.hue} />
    </div>
  );
}

export default function TopicsPage() {
  return (
    <Suspense fallback={null}>
      <TopicsPageContent />
    </Suspense>
  );
}
