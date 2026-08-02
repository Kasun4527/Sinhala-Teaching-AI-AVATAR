"use client";

import { useRouter } from "next/navigation";
import { useMergedCurriculum } from "@/data/useCurriculum";
import { useEffect, useRef, useState } from "react";
import Sidebar from "@/components/Sidebar";
import ChatBot from "@/components/ChatBot";

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
import { enrollSubject } from "@/services/api";

// ── Design tokens ──────────────────────────────────────────────────
const BLUE    = "#2563eb";
const BLUE_D  = "#1d4ed8";
const BLUE_XD = "#1e3a8a";
const NAVY    = "#0f172a";

const SUBJECT = {
  Physics:              { abbr: "PH", hue: "#2563eb", bg: "#eff6ff", ring: "#bfdbfe", dark: "#1e3a8a" },
  Chemistry:            { abbr: "CH", hue: "#0891b2", bg: "#ecfeff", ring: "#a5f3fc", dark: "#164e63" },
  Biology:              { abbr: "BI", hue: "#059669", bg: "#ecfdf5", ring: "#6ee7b7", dark: "#064e3b" },
  Maths:                { abbr: "MA", hue: "#7c3aed", bg: "#f5f3ff", ring: "#c4b5fd", dark: "#3b0764" },
  "ආර්ථික විද්‍යාව":   { abbr: "₨", hue: "#b45309", bg: "#fffbeb", ring: "#fde68a", dark: "#78350f" },
  "බුද්ධ ධර්මය":       { abbr: "☸", hue: "#c026d3", bg: "#fdf4ff", ring: "#e879f9", dark: "#701a75" },
  "විද්‍යාව":           { abbr: "🔬", hue: "#0d9488", bg: "#f0fdfa", ring: "#99f6e4", dark: "#134e4a" },
};
const DEFAULT_S = { abbr: "SU", hue: "#475569", bg: "#f8fafc", ring: "#cbd5e1", dark: "#1e293b" };

function Chip({ children, style }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase",
      padding: "4px 12px", borderRadius: 100,
      ...style,
    }}>
      {children}
    </span>
  );
}

function StatTile({ value, label }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.10)",
      borderRadius: 14, padding: "18px 22px", minWidth: 108,
    }}>
      <p style={{ margin: 0, fontSize: 32, fontWeight: 800, color: "#93c5fd", lineHeight: 1 }}>{value}</p>
      <p style={{ margin: "7px 0 0", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.40)", letterSpacing: "0.09em", textTransform: "uppercase" }}>{label}</p>
    </div>
  );
}

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export default function StudentDashboard() {
  const router = useRouter();
  const curriculum = useMergedCurriculum();
  const [name, setName]             = useState("");
  const [hovered, setHovered]       = useState(null);
  const [pendingEnroll, setPending] = useState(null);
  const [enrolling, setEnrolling]   = useState(false);
  const [enrollErr, setEnrollErr]   = useState("");
  const [grade, setGrade]           = useState(0);
  const [improvement, setImprovement] = useState(null);
  const [needsTeacherCode, setNeedsTeacherCode] = useState(false);
  const [teacherCodeInput, setTeacherCodeInput] = useState("");
  const [teacherCodeStatus, setTeacherCodeStatus] = useState({ saving: false, error: "" });

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { router.push("/login"); return; }
    setName(localStorage.getItem("name") || "Student");
    setNeedsTeacherCode(!localStorage.getItem("teacher_id"));

    const studentId = localStorage.getItem("student_id");
    if (studentId) {
      fetch(`${BACKEND}/progress-improvement?student_id=${encodeURIComponent(studentId)}`)
        .then((res) => res.json())
        .then((data) => setImprovement(data))
        .catch(() => setImprovement(null));
    }
  }, []);

  const submitTeacherCode = async () => {
    const code = teacherCodeInput.trim();
    if (!code) return;
    setTeacherCodeStatus({ saving: true, error: "" });
    try {
      const res = await fetch(`${BACKEND}/auth/set-teacher-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: localStorage.getItem("student_id"), teacher_code: code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Invalid code");
      localStorage.setItem("teacher_id", data.teacher_id);
      setNeedsTeacherCode(false);
      // Reload so useMergedCurriculum (only fetches once on mount) picks up
      // this teacher's content immediately instead of on next visit.
      window.location.reload();
    } catch (err) {
      setTeacherCodeStatus({ saving: false, error: err.message || "Invalid code" });
    }
  };

  const totalSubjects = curriculum.reduce((a, g) => a + g.subjects.length, 0);
  const totalLessons  = curriculum.reduce((a, g) => a + g.subjects.reduce((s, sub) => s + (sub.lessons?.length || 0), 0), 0);
  const totalTopics   = curriculum.reduce((a, g) => a + g.subjects.reduce((s, sub) => s + sub.lessons?.reduce((t, l) => t + (l.topics?.length || 0), 0), 0), 0);
  const current       = curriculum[grade];

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f8fafc", fontFamily: "'Source Sans 3', sans-serif" }}>
      <Sidebar />

      <main style={{ flex: 1, overflowY: "auto", minWidth: 0 }}>

        {/* ═══ HERO ═══ */}
        <div style={{
          position: "relative", overflow: "hidden",
          background: `linear-gradient(145deg, ${NAVY} 0%, ${BLUE_XD} 55%, ${BLUE_D} 100%)`,
          padding: "60px 60px 56px",
        }}>
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none",
            backgroundImage: "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
            backgroundSize: "48px 48px" }} />
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none",
            backgroundImage: "linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)",
            backgroundSize: "12px 12px" }} />
          <div style={{ position: "absolute", top: -100, right: -60, width: 420, height: 420, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(59,130,246,0.25) 0%, transparent 70%)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", bottom: -80, left: "40%", width: 300, height: 300, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 70%)", pointerEvents: "none" }} />

          <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 56 }}>
            <div style={{ flex: 1 }}>
              <Chip style={{ background: "rgba(147,197,253,0.12)", border: "1px solid rgba(147,197,253,0.22)", color: "#93c5fd", marginBottom: 24 }}>
                <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "#60a5fa", marginRight: 7 }} />
                Adaptive Learning Platform
              </Chip>

              <h1 style={{
                fontFamily: "'Raleway', sans-serif",
                fontSize: 48, fontWeight: 300, lineHeight: 1.12,
                color: "#f1f5f9", margin: "0 0 6px", letterSpacing: "0.02em",
              }}>
                Hello,{" "}
                <span style={{ fontWeight: 700, color: "#93c5fd", textShadow: "0 0 40px rgba(147,197,253,0.35)" }}>
                  {name}
                </span>
              </h1>
              <p style={{ color: "rgba(255,255,255,0.40)", fontSize: 15, margin: "14px 0 0", maxWidth: 400, lineHeight: 1.8 }}>
                Explore your curriculum below. Select a subject to enrol and begin your personalised learning journey.
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, flexShrink: 0 }}>
              <StatTile value={curriculum.length} label="Grades" />
              <StatTile value={totalSubjects}     label="Subjects" />
              <StatTile value={totalLessons}      label="Lessons" />
              <StatTile value={totalTopics}       label="Topics" />
            </div>
          </div>
        </div>

        {/* ═══ BODY ═══ */}
        <div style={{ padding: "48px 60px 80px", position: "relative" }}>
          <FloatingPattern color={BLUE} />

          {/* Teacher code prompt — shown until a teacher is linked */}
          {needsTeacherCode && (
            <div style={{
              background: "#fffbeb", border: "1.5px solid #fde68a", borderRadius: 16,
              padding: "20px 24px", marginBottom: 32, position: "relative", zIndex: 1,
            }}>
              <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: "#78350f" }}>
                Link to your teacher
              </p>
              <p style={{ margin: "0 0 14px", fontSize: 13, color: "#92400e" }}>
                Enter the code your teacher gave you so their added lessons and your progress show up correctly.
              </p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <input
                  value={teacherCodeInput}
                  onChange={(e) => setTeacherCodeInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitTeacherCode()}
                  placeholder="Teacher code"
                  style={{
                    flex: "1 1 220px", padding: "9px 14px", borderRadius: 10,
                    border: "1.5px solid #fde68a", fontSize: 13, outline: "none",
                  }}
                />
                <button
                  onClick={submitTeacherCode}
                  disabled={teacherCodeStatus.saving || !teacherCodeInput.trim()}
                  style={{
                    padding: "9px 20px", borderRadius: 10, border: "none",
                    background: "#b45309", color: "white", fontWeight: 600, fontSize: 13,
                    cursor: teacherCodeStatus.saving ? "default" : "pointer",
                    opacity: teacherCodeStatus.saving ? 0.6 : 1,
                  }}
                >
                  {teacherCodeStatus.saving ? "Linking..." : "Link"}
                </button>
              </div>
              {teacherCodeStatus.error && (
                <p style={{ margin: "10px 0 0", fontSize: 12, color: "#dc2626" }}>{teacherCodeStatus.error}</p>
              )}
            </div>
          )}

          {/* Header row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32, flexWrap: "wrap", gap: 16, position: "relative", zIndex: 1 }}>
            <div>
              <h2 style={{ margin: 0, fontFamily: "'Raleway', sans-serif", fontSize: 26, fontWeight: 700, color: NAVY, letterSpacing: "0.03em" }}>
                Your Curriculum
              </h2>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "#94a3b8" }}>
                Select a grade to browse available subjects
              </p>
            </div>

            <div style={{ display: "flex", gap: 6, alignItems: "center", background: "#f1f5f9", padding: "5px 6px", borderRadius: 12 }}>
              {curriculum.map((g, i) => (
                <button
                  key={i}
                  onClick={() => setGrade(i)}
                  style={{
                    padding: "8px 20px", borderRadius: 9, border: "none",
                    background: grade === i ? `linear-gradient(135deg, ${BLUE_D}, ${BLUE})` : "transparent",
                    color: grade === i ? "white" : "#64748b",
                    fontWeight: 600, fontSize: 13, cursor: "pointer",
                    boxShadow: grade === i ? `0 3px 10px ${BLUE}50` : "none",
                    transition: "all 0.18s ease",
                  }}
                >
                  {g.grade}
                </button>
              ))}
            </div>
          </div>

          <div style={{ height: 1, background: "linear-gradient(90deg, #e2e8f0, transparent)", marginBottom: 36, position: "relative", zIndex: 1 }} />

          {/* Your Improvement (pre-quiz → post-quiz) */}
          {improvement && improvement.count > 0 && (
            <div style={{
              background: "white", border: "1.5px solid #e8edf2", borderRadius: 18,
              padding: "24px 28px", marginBottom: 36, position: "relative", zIndex: 1,
              boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
            }}>
              <h3 style={{ margin: "0 0 4px", fontFamily: "'Raleway', sans-serif", fontSize: 20, fontWeight: 700, color: NAVY }}>
                Your Improvement
              </h3>
              <p style={{ margin: "0 0 20px", fontSize: 13, color: "#94a3b8" }}>
                How much your scores improved from pre-quiz to post-quiz, across all subjects
              </p>

              <div style={{ display: "flex", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
                <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: "16px 22px", minWidth: 140 }}>
                  <p style={{
                    margin: 0, fontSize: 28, fontWeight: 800, lineHeight: 1,
                    color: improvement.average_improvement > 0 ? "#059669" : improvement.average_improvement < 0 ? "#dc2626" : "#64748b",
                  }}>
                    {improvement.average_improvement > 0 ? "+" : ""}{improvement.average_improvement}
                  </p>
                  <p style={{ margin: "6px 0 0", fontSize: 11, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Avg. Improvement
                  </p>
                </div>
                <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: "16px 22px", minWidth: 140 }}>
                  <p style={{ margin: 0, fontSize: 28, fontWeight: 800, lineHeight: 1, color: NAVY }}>{improvement.count}</p>
                  <p style={{ margin: "6px 0 0", fontSize: 11, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Topics Compared
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {improvement.topics.slice(-5).reverse().map((t, i) => {
                  const delta = t.improvement;
                  const dColor = delta > 0 ? "#059669" : delta < 0 ? "#dc2626" : "#64748b";
                  const dBg = delta > 0 ? "#ecfdf5" : delta < 0 ? "#fef2f2" : "#f1f5f9";
                  return (
                    <div key={i} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "10px 14px", borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0",
                    }}>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: NAVY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {t.topic}
                        </p>
                        <p style={{ margin: "2px 0 0", fontSize: 11, color: "#94a3b8" }}>
                          {t.subject} &middot; {t.initial_quiz_marks} &rarr; {t.final_quiz_marks}
                        </p>
                      </div>
                      <span style={{
                        background: dBg, color: dColor, fontWeight: 700, fontSize: 12,
                        padding: "4px 12px", borderRadius: 20, flexShrink: 0, marginLeft: 12,
                      }}>
                        {delta > 0 ? "+" : ""}{delta}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Cards grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(295px, 1fr))", gap: 20, position: "relative", zIndex: 1 }}>
            {current.subjects.map((item, i) => {
              const cfg = SUBJECT[item.subject] || DEFAULT_S;
              const isH = hovered === i;
              const tops = item.lessons?.reduce((a, l) => a + (l.topics?.length || 0), 0) || 0;

              return (
                <div
                  key={i}
                  onClick={() => setPending({ ...item, grade: current.grade })}
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                  style={{
                    background: "white",
                    border: `1.5px solid ${isH ? cfg.hue + "60" : "#e8edf2"}`,
                    borderRadius: 18, overflow: "hidden", cursor: "pointer",
                    boxShadow: isH
                      ? `0 20px 56px rgba(0,0,0,0.09), 0 0 0 1px ${cfg.hue}18`
                      : "0 1px 4px rgba(0,0,0,0.04)",
                    transform: isH ? "translateY(-5px)" : "translateY(0)",
                    transition: "all 0.22s cubic-bezier(.22,.61,.36,1)",
                  }}
                >
                  {/* Top stripe */}
                  <div style={{ height: 5, background: `linear-gradient(90deg, ${cfg.dark}, ${cfg.hue})` }} />

                  {/* Card header */}
                  <div style={{ padding: "22px 24px 16px", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                    <div style={{
                      width: 52, height: 52, borderRadius: 14,
                      background: isH ? `linear-gradient(135deg, ${cfg.dark}, ${cfg.hue})` : cfg.bg,
                      border: `1.5px solid ${isH ? "transparent" : cfg.ring}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 13, fontWeight: 800, letterSpacing: "0.06em",
                      color: isH ? "white" : cfg.hue,
                      boxShadow: isH ? `0 6px 18px ${cfg.hue}45` : "none",
                      transition: "all 0.22s", flexShrink: 0,
                    }}>
                      {cfg.abbr}
                    </div>
                    <Chip style={{ background: cfg.bg, color: cfg.hue, border: `1px solid ${cfg.ring}` }}>
                      {item.lessons?.length || 0} lessons
                    </Chip>
                  </div>

                  {/* Card body */}
                  <div style={{ padding: "0 24px 22px" }}>
                    <h3 style={{ margin: "0 0 4px", fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: NAVY }}>
                      {item.subject}
                    </h3>
                    <p style={{ margin: "0 0 20px", fontSize: 12, color: "#94a3b8", fontWeight: 500 }}>
                      {current.grade}{tops > 0 && <> &middot; {tops} topics</>}
                    </p>

                    {/* Decorative progress bar */}
                    <div style={{ height: 3, background: "#f1f5f9", borderRadius: 99, marginBottom: 20 }}>
                      <div style={{
                        height: "100%", borderRadius: 99, width: isH ? "70%" : "40%",
                        background: `linear-gradient(90deg, ${cfg.dark}, ${cfg.hue})`,
                        transition: "width 0.5s ease",
                      }} />
                    </div>

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: cfg.hue }}>Start Learning</span>
                      <div style={{
                        width: 34, height: 34, borderRadius: "50%",
                        background: isH ? `linear-gradient(135deg, ${cfg.dark}, ${cfg.hue})` : cfg.bg,
                        border: `1.5px solid ${isH ? "transparent" : cfg.ring}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        boxShadow: isH ? `0 6px 16px ${cfg.hue}50` : "none",
                        transition: "all 0.22s",
                      }}>
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <path d="M3 7h8M7 3l4 4-4 4" stroke={isH ? "white" : cfg.hue} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
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

      {/* ═══ ENROL MODAL ═══ */}
      {pendingEnroll && (() => {
        const cfg  = SUBJECT[pendingEnroll.subject] || DEFAULT_S;
        const tops = pendingEnroll.lessons?.reduce((a, l) => a + (l.topics?.length || 0), 0) || 0;
        return (
          <div
            onClick={e => e.target === e.currentTarget && (setPending(null), setEnrollErr(""))}
            style={{
              position: "fixed", inset: 0, zIndex: 3000,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "rgba(2,6,23,0.55)", backdropFilter: "blur(8px)",
            }}
          >
            <div style={{
              width: 460, background: "white", borderRadius: 22,
              overflow: "hidden", boxShadow: "0 40px 100px rgba(0,0,0,0.28)",
            }}>
              <div style={{ height: 5, background: `linear-gradient(90deg, ${cfg.dark}, ${cfg.hue})` }} />

              <div style={{ padding: "28px 30px 24px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: 18 }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 16,
                  background: `linear-gradient(135deg, ${cfg.dark}, ${cfg.hue})`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 16, fontWeight: 800, color: "white", letterSpacing: "0.06em",
                  boxShadow: `0 8px 24px ${cfg.hue}45`,
                }}>
                  {cfg.abbr}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: NAVY }}>
                    {pendingEnroll.subject}
                  </h3>
                  <p style={{ margin: "4px 0 0", fontSize: 13, color: "#94a3b8" }}>
                    {pendingEnroll.grade} &middot; {pendingEnroll.lessons?.length || 0} lessons &middot; {tops} topics
                  </p>
                </div>
              </div>

              <div style={{ padding: "26px 30px 30px" }}>
                <p style={{ color: "#374151", fontSize: 15, lineHeight: 1.8, margin: 0 }}>
                  You are about to enrol in <strong style={{ color: NAVY }}>{pendingEnroll.subject}</strong>. Your progress will be tracked and lessons unlocked as you advance.
                </p>

                {enrollErr && (
                  <div style={{ marginTop: 16, padding: "11px 16px", borderRadius: 10, background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", fontSize: 13 }}>
                    {enrollErr}
                  </div>
                )}

                <div style={{ display: "flex", gap: 8, marginTop: 20, flexWrap: "wrap" }}>
                  {[`${pendingEnroll.lessons?.length || 0} Lessons`, `${tops} Topics`, "Sinhala Medium", "Adaptive Path"].map((t, i) => (
                    <Chip key={i} style={{ background: "#f8fafc", color: "#64748b", border: "1px solid #e2e8f0" }}>{t}</Chip>
                  ))}
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: 28 }}>
                  <button
                    onClick={() => { setPending(null); setEnrollErr(""); }}
                    style={{
                      flex: 1, padding: "13px 0", borderRadius: 12,
                      border: "1.5px solid #e2e8f0", background: "white",
                      color: "#374151", fontWeight: 600, fontSize: 14, cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        setEnrolling(true); setEnrollErr("");
                        const studentId = localStorage.getItem("student_id");
                        if (!studentId) throw new Error("Not logged in");
                        await enrollSubject({ student_id: studentId, subject: pendingEnroll.subject, lessons: pendingEnroll.lessons || [] });
                        setPending(null);
                        router.push(`/sub-lesson?subject=${encodeURIComponent(pendingEnroll.subject)}&grade=${encodeURIComponent(pendingEnroll.grade || "")}`);
                      } catch (err) {
                        setEnrollErr(err?.message || "Enrolment failed. Please try again.");
                      } finally {
                        setEnrolling(false);
                      }
                    }}
                    disabled={enrolling}
                    style={{
                      flex: 2, padding: "13px 0", borderRadius: 12, border: "none",
                      background: enrolling ? "#93c5fd" : `linear-gradient(135deg, ${BLUE_D}, ${BLUE})`,
                      color: "white", fontWeight: 700, fontSize: 14,
                      cursor: enrolling ? "not-allowed" : "pointer",
                      boxShadow: enrolling ? "none" : `0 6px 20px ${BLUE}50`,
                      transition: "all 0.2s",
                    }}
                  >
                    {enrolling ? "Enrolling…" : "Enrol & Start Learning →"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      <ChatBot accent={BLUE} />
    </div>
  );
}