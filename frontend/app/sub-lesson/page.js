"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useMergedCurriculum, findSubjectIn } from "@/data/useCurriculum";
import { useEffect, useRef, useState, Suspense } from "react";
import ChatBot from "@/components/ChatBot";
import CursorGlow from "@/components/CursorGlow";
import { SparklesCore } from "@/components/ui/sparkles";
import Navbar from "@/components/Navbar";
import { Atom, FlaskConical, Dna, Sigma, Leaf, BookOpen, Microscope } from "lucide-react";

const NAVY = "#0f172a";

const SUBJECT_ICON = {
  Physics:              Atom,
  Chemistry:            FlaskConical,
  Biology:              Dna,
  Maths:                Sigma,
  "ආර්ථික විද්‍යාව":   BookOpen,
  "බුද්ධ ධර්මය":       Leaf,
  "විද්‍යාව":           Microscope,
};

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
  "විද්‍යාව":           { hue: "#0d9488", dark: "#134e4a", bg: "#f0fdfa", ring: "#99f6e4" },
};
const DEFAULT_CFG = { hue: "#2563eb", dark: "#1e3a8a", bg: "#eff6ff", ring: "#bfdbfe" };

function LessonsPageContent() {
  const params     = useSearchParams();
  const router     = useRouter();
  const subject    = params.get("subject");
  const grade      = params.get("grade") || "";
  const curriculumData = useMergedCurriculum();
  const subjectData = findSubjectIn(curriculumData, subject, grade || undefined);
  const [hovered, setHovered] = useState(null);

  useEffect(() => {
    if (!localStorage.getItem("token")) router.push("/login");
  }, []);

  const cfg = SUBJECT_CFG[subject] || DEFAULT_CFG;

  if (!subjectData) return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <Navbar />
      <main style={{ flex: 1, padding: 48, backgroundColor: "#f8fafc", }}>
        <p style={{ color: "#94a3b8" }}>No lessons found.</p>
      </main>
    </div>
  );

  const lessons = subjectData.lessons || [];
  const totalTopics = lessons.reduce((a, l) => a + (l.topics?.length || 0), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "linear-gradient(to bottom, #020617 0%, #020617 250px, #1e3a8a 550px, #ffffff 950px)", }}>
      <Navbar />
      <CursorGlow color={cfg.hue} opacity={0.08} size={900} />

      <main style={{ flex: 1, minWidth: 0, overflowY: "auto", background: "transparent" }}>

        <div style={{ padding: "48px 60px 0", position: "relative", zIndex: 20 }}>
          
        </div>

        {/* ── HERO ── */}
        <div style={{
          position: "relative", overflow: "hidden",
          padding: "24px 60px 48px",
        }}>
          {/* Sparkles Effect */}
          <div style={{ position: "absolute", inset: 0 }}>
            <SparklesCore
              id="tsparticles-hero"
              background="transparent"
              minSize={0.6}
              maxSize={1.4}
              particleDensity={100}
              className="w-full h-full"
              particleColor="#FFFFFF"
            />
          </div>

          <div style={{ position: "relative", zIndex: 10 }}>
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
          {/* Section label */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28, paddingTop: 18, paddingBottom: 18, borderTop: "1px solid rgba(255,255,255,0.15)", borderBottom: "1px solid rgba(255,255,255,0.15)", position: "relative", zIndex: 1 }}>
            <div>
              <h2 style={{ margin: 0,  fontSize: 22, fontWeight: 700, color: "white", letterSpacing: "0.03em" }}>
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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 18, position: "relative", zIndex: 1 }}>
            {lessons.map((lesson, i) => {
              const isH = hovered === i;
              const topicCount = lesson.topics?.length || 0;
              const Icon = SUBJECT_ICON[subject] || BookOpen;

              return (
                <div
                  key={i}
                  onClick={() => router.push(`/topics?subject=${subject}&lesson=${encodeURIComponent(lesson.name)}&grade=${encodeURIComponent(grade)}`)}
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                  className="group"
                  style={{
                    position: "relative",
                    background: isH ? `linear-gradient(to bottom, ${cfg.bg}, #ffffff)` : "linear-gradient(to bottom, #f8fafc, #ffffff)",
                    border: `1.5px solid ${isH ? cfg.hue + "55" : "#e2e8f0"}`,
                    borderRadius: 24, overflow: "hidden", cursor: "pointer",
                    boxShadow: isH
                      ? `0 20px 56px rgba(0,0,0,0.15), 0 0 0 1px ${cfg.hue}25`
                      : "0 8px 30px rgba(0,0,0,0.08)",
                    transform: isH ? "translateY(-5px)" : "translateY(0)",
                    transition: "all 0.3s cubic-bezier(.22,.61,.36,1)",
                    display: "flex", flexDirection: "column",
                  }}
                >
                  {/* Watermark Icon */}
                  <div style={{
                    position: "absolute", bottom: -20, right: -20,
                    opacity: isH ? 0.08 : 0.02,
                    transform: isH ? "scale(1.15) rotate(-10deg)" : "scale(1) rotate(0deg)",
                    transition: "all 0.5s cubic-bezier(.22,.61,.36,1)",
                    pointerEvents: "none"
                  }}>
                    <Icon size={160} color={cfg.hue} />
                  </div>

                  {/* Top stripe */}
                  <div style={{ height: 6, background: `linear-gradient(90deg, ${cfg.dark}, ${cfg.hue})` }} />

                  {/* Card header */}
                  <div style={{ padding: "20px", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: 14,
                      background: isH ? `linear-gradient(135deg, ${cfg.dark}, ${cfg.hue})` : cfg.bg,
                      border: `1.5px solid ${isH ? "transparent" : cfg.ring}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 16, fontWeight: 800, color: isH ? "white" : cfg.hue,
                      boxShadow: isH ? `0 8px 20px ${cfg.hue}40` : "none", flexShrink: 0,
                      transition: "all 0.3s",
                    }}>
                      {String(i + 1).padStart(2, "0")}
                    </div>
                    <div style={{ background: cfg.bg, color: cfg.hue, padding: "5px 12px", borderRadius: 100, fontSize: 11, fontWeight: 700, border: `1px solid ${cfg.ring}` }}>
                      {topicCount} topic{topicCount !== 1 ? "s" : ""}
                    </div>
                  </div>

                  {/* Card body */}
                  <div style={{ padding: "0 20px 20px", flex: 1, display: "flex", flexDirection: "column", position: "relative", zIndex: 2 }}>
                    <h3 style={{ margin: "0 0 12px",  fontSize: 18, fontWeight: 700, color: NAVY }}>
                      {lesson.name}
                    </h3>
                    
                    <div style={{ marginTop: "auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: isH ? cfg.hue : "#64748b", transition: "color 0.3s" }}>
                        Start learning
                      </span>
                      <div style={{
                        width: 32, height: 32, borderRadius: "50%",
                        background: isH ? cfg.hue : "#f1f5f9",
                        border: `1px solid ${isH ? "transparent" : "#e2e8f0"}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        transition: "all 0.3s",
                      }}>
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <path d="M3 7h8M7 3l4 4-4 4" stroke={isH ? "white" : "#64748b"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    </div>
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
    <Suspense fallback={null}>
      <LessonsPageContent />
    </Suspense>
  );
}
