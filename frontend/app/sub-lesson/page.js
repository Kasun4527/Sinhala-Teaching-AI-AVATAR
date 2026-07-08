"use client";
import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { findSubjectByGrade, findSubject } from "@/data/curriculum";
import { useEffect, useRef, useState } from "react";
import Sidebar from "@/components/Sidebar";
import ChatBot from "@/components/ChatBot";

const NAVY = "#0f172a";

function HexPattern({ color }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let W = canvas.width  = canvas.offsetWidth;
    let H = canvas.height = canvas.offsetHeight;
    let t = 0;

    const SIZE  = 38;
    const HX    = SIZE * Math.sqrt(3);
    const HY    = SIZE * 1.5;

    const drawHex = (cx, cy, s, alpha) => {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 6;
        const px = cx + s * Math.cos(angle);
        const py = cy + s * Math.sin(angle);
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.strokeStyle = color + Math.round(alpha * 255).toString(16).padStart(2, "0");
      ctx.lineWidth = 1.2;
      ctx.stroke();
    };

    let raf;
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      const cols = Math.ceil(W / HX) + 2;
      const rows = Math.ceil(H / HY) + 2;

      for (let row = -1; row < rows; row++) {
        for (let col = -1; col < cols; col++) {
          const cx = col * HX + (row % 2 === 0 ? HX / 2 : 0);
          const cy = row * HY;
          const wave = Math.sin(t + col * 0.4 + row * 0.35);
          const alpha = 0.10 + Math.abs(wave) * 0.32;
          const sizeVar = SIZE * (0.85 + Math.abs(wave) * 0.18);
          drawHex(cx, cy, sizeVar, alpha);
        }
      }
      t += 0.012;
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
};
const DEFAULT_CFG = { hue: "#2563eb", dark: "#1e3a8a", bg: "#eff6ff", ring: "#bfdbfe" };

function SubLessonPageContent() {
  const params     = useSearchParams();
  const router     = useRouter();
  const subject    = params.get("subject");
  const grade      = params.get("grade") || "";
  const subjectData = grade ? findSubjectByGrade(subject, grade) : findSubject(subject);
  const [hovered, setHovered] = useState(null);

  useEffect(() => {
    if (!localStorage.getItem("token")) router.push("/login");
  }, []);

  const cfg = SUBJECT_CFG[subject] || DEFAULT_CFG;

  if (!subjectData) return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar subject={subject} />
      <main style={{ flex: 1, padding: 48, backgroundColor: "#f8fafc", fontFamily: "'Source Sans 3', sans-serif" }}>
        <p style={{ color: "#94a3b8" }}>No lessons found.</p>
      </main>
    </div>
  );

  const lessons = subjectData.lessons || [];
  const totalTopics = lessons.reduce((a, l) => a + (l.topics?.length || 0), 0);

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
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.3,
            backgroundImage: "radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)",
            backgroundSize: "26px 26px" }} />
          <div style={{ position: "absolute", top: -80, right: -60, width: 360, height: 360, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(147,197,253,0.2) 0%, transparent 70%)", pointerEvents: "none" }} />

          <div style={{ position: "relative" }}>
            {/* Back link */}
            <button
              onClick={() => router.push("/dashboard")}
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
              Dashboard
            </button>

            {/* Breadcrumb */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14 }}>
              <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase" }}>{grade}</span>
              <span style={{ color: "rgba(255,255,255,0.2)" }}>›</span>
              <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase" }}>{subject}</span>
            </div>

            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 32 }}>
              <div>
                <h1 style={{
                  fontFamily: "'Raleway', sans-serif",
                  fontSize: 40, fontWeight: 700, color: "#f1f5f9",
                  margin: "0 0 10px", letterSpacing: "0.01em", lineHeight: 1.1,
                }}>
                  Available Lessons
                </h1>
                <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, margin: 0, lineHeight: 1.7 }}>
                  Select a lesson to explore its topics and begin learning
                </p>
              </div>

              {/* Stats row */}
              <div style={{ display: "flex", gap: 12, flexShrink: 0 }}>
                {[
                  { value: lessons.length, label: "Lessons" },
                  { value: totalTopics,    label: "Topics" },
                ].map((s, i) => (
                  <div key={i} style={{
                    background: "rgba(255,255,255,0.07)",
                    border: "1px solid rgba(255,255,255,0.10)",
                    borderRadius: 14, padding: "14px 20px", textAlign: "center", minWidth: 90,
                  }}>
                    <p style={{ margin: 0, fontSize: 28, fontWeight: 800, color: "#93c5fd", lineHeight: 1 }}>{s.value}</p>
                    <p style={{ margin: "6px 0 0", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.38)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── BODY ── */}
        <div style={{ padding: "44px 60px 72px", position: "relative" }}>
          <HexPattern color={cfg.hue} />

          {/* Section label */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28, paddingBottom: 18, borderBottom: "2px solid #e2e8f0", position: "relative", zIndex: 1 }}>
            <div>
              <h2 style={{ margin: 0, fontFamily: "'Raleway', sans-serif", fontSize: 22, fontWeight: 700, color: NAVY, letterSpacing: "0.03em" }}>
                {subject} Lessons
              </h2>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "#94a3b8" }}>
                {lessons.length} lesson{lessons.length !== 1 ? "s" : ""} &middot; {totalTopics} topics total
              </p>
            </div>
            <span style={{
              backgroundColor: cfg.bg, color: cfg.hue,
              border: `1px solid ${cfg.ring}`,
              fontSize: 11, fontWeight: 700, padding: "5px 16px",
              borderRadius: 100, letterSpacing: "0.05em", textTransform: "uppercase",
            }}>
              {grade}
            </span>
          </div>

          {/* Lessons grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 18, position: "relative", zIndex: 1 }}>
            {lessons.map((lesson, i) => {
              const isH = hovered === i;
              const topicCount = lesson.topics?.length || 0;

              return (
                <div
                  key={i}
                  onClick={() => router.push(`/topics?subject=${subject}&lesson=${encodeURIComponent(lesson.name)}&grade=${encodeURIComponent(grade)}`)}
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                  style={{
                    background: "white",
                    border: `1.5px solid ${isH ? cfg.hue + "55" : "#e8edf2"}`,
                    borderRadius: 16, overflow: "hidden", cursor: "pointer",
                    boxShadow: isH
                      ? `0 16px 48px rgba(0,0,0,0.08), 0 0 0 1px ${cfg.hue}15`
                      : "0 1px 4px rgba(0,0,0,0.04)",
                    transform: isH ? "translateY(-4px)" : "translateY(0)",
                    transition: "all 0.22s cubic-bezier(.22,.61,.36,1)",
                    display: "flex", flexDirection: "column",
                  }}
                >
                  {/* Top stripe */}
                  <div style={{ height: 4, background: `linear-gradient(90deg, ${cfg.dark}, ${cfg.hue})` }} />

                  <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "22px 24px" }}>
                    {/* Number badge */}
                    <div style={{
                      width: 48, height: 48, borderRadius: 14, flexShrink: 0,
                      background: isH ? `linear-gradient(135deg, ${cfg.dark}, ${cfg.hue})` : cfg.bg,
                      border: `1.5px solid ${isH ? "transparent" : cfg.ring}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontWeight: 800, fontSize: 17,
                      color: isH ? "white" : cfg.hue,
                      boxShadow: isH ? `0 6px 18px ${cfg.hue}40` : "none",
                      transition: "all 0.22s",
                    }}>
                      {String(i + 1).padStart(2, "0")}
                    </div>

                    {/* Text */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        margin: "0 0 4px",
                        fontFamily: "'Playfair Display', serif",
                        fontSize: 17, fontWeight: 700,
                        color: NAVY,
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      }}>
                        {lesson.name}
                      </p>
                      <p style={{ margin: 0, color: "#94a3b8", fontSize: 12, fontWeight: 500 }}>
                        {topicCount} topic{topicCount !== 1 ? "s" : ""}
                      </p>
                    </div>

                    {/* Arrow */}
                    <div style={{
                      width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                      background: isH ? `linear-gradient(135deg, ${cfg.dark}, ${cfg.hue})` : cfg.bg,
                      border: `1.5px solid ${isH ? "transparent" : cfg.ring}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      boxShadow: isH ? `0 4px 12px ${cfg.hue}45` : "none",
                      transition: "all 0.22s",
                    }}>
                      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                        <path d="M3 6.5h7M7 3l3.5 3.5L7 10" stroke={isH ? "white" : cfg.hue} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  </div>

                  {/* Topic dots */}
                  <div style={{ display: "flex", gap: 5, padding: "0 24px 18px", flexWrap: "wrap" }}>
                    {Array.from({ length: Math.min(topicCount, 8) }).map((_, di) => (
                      <div key={di} style={{
                        width: 7, height: 7, borderRadius: "50%",
                        background: di < 3
                          ? `linear-gradient(135deg, ${cfg.dark}, ${cfg.hue})`
                          : isH ? `${cfg.hue}40` : "#e2e8f0",
                        transition: "background 0.22s",
                      }} />
                    ))}
                    {topicCount > 8 && (
                      <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, lineHeight: "7px" }}>+{topicCount - 8}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      <ChatBot subject={subject} accent={cfg.hue} />
    </div>
  );
}

export default function LessonsPage() {
  return (
    <Suspense fallback={<div style={{ padding: "50px", textAlign: "center", fontFamily: "sans-serif" }}>Loading lessons...</div>}>
      <SubLessonPageContent />
    </Suspense>
  );
}
