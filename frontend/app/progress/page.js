"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import { getPastLessons, getPracticeQuizResults } from "@/services/api";

const NAVY = "#0f172a";
const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

const SUBJECT_CFG = {
  Physics:              { hue: "#2563eb", dark: "#1e3a8a", bg: "#eff6ff", ring: "#bfdbfe" },
  Chemistry:            { hue: "#0891b2", dark: "#164e63", bg: "#ecfeff", ring: "#a5f3fc" },
  Biology:              { hue: "#059669", dark: "#064e3b", bg: "#ecfdf5", ring: "#6ee7b7" },
  Maths:                { hue: "#7c3aed", dark: "#3b0764", bg: "#f5f3ff", ring: "#c4b5fd" },
  "ආර්ථික විද්\u200Dයාව":   { hue: "#b45309", dark: "#78350f", bg: "#fffbeb", ring: "#fde68a" },
  "බුද්ධ ධර්මය":       { hue: "#c026d3", dark: "#701a75", bg: "#fdf4ff", ring: "#e879f9" },
  "විද්\u200Dයාව":           { hue: "#0d9488", dark: "#134e4a", bg: "#f0fdfa", ring: "#99f6e4" },
};
const DEFAULT_CFG = { hue: "#2563eb", dark: "#1e3a8a", bg: "#eff6ff", ring: "#bfdbfe" };

function groupBySubjectThenLesson(topics) {
  const bySubject = new Map();
  for (const t of topics) {
    if (!bySubject.has(t.subject)) bySubject.set(t.subject, new Map());
    const byLesson = bySubject.get(t.subject);
    if (!byLesson.has(t.lesson)) byLesson.set(t.lesson, []);
    byLesson.get(t.lesson).push(t);
  }
  return Array.from(bySubject.entries()).map(([subject, byLesson]) => ({
    subject,
    lessons: Array.from(byLesson.entries()).map(([lesson, items]) => ({ lesson, items })),
  }));
}

export default function ProgressPage() {
  const router = useRouter();
  const [tab, setTab] = useState("past");

  // Past lessons state
  const [topics, setTopics] = useState([]);
  const [resultsByTopic, setResultsByTopic] = useState({});
  const [pastLoading, setPastLoading] = useState(true);
  const [hovered, setHovered] = useState(null);

  // Improvements state
  const [improvement, setImprovement] = useState(null);
  const [impLoading, setImpLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { router.push("/login"); return; }
    const studentId = localStorage.getItem("student_id");
    if (!studentId) { setPastLoading(false); setImpLoading(false); return; }

    // Past lessons
    Promise.all([getPastLessons(studentId), getPracticeQuizResults(studentId)])
      .then(([lessonsRes, resultsRes]) => {
        setTopics(lessonsRes?.data?.topics || []);
        const map = {};
        for (const r of resultsRes?.data?.results || []) {
          const key = `${r.subject}|${r.lesson}|${r.topic}`;
          if (!map[key]) map[key] = { count: 0, best: 0 };
          map[key].count += 1;
          map[key].best = Math.max(map[key].best, r.score);
        }
        setResultsByTopic(map);
      })
      .catch(() => {})
      .finally(() => setPastLoading(false));

    // Improvements
    fetch(`${BACKEND}/progress-improvement?student_id=${encodeURIComponent(studentId)}`)
      .then(r => r.json())
      .then(data => setImprovement(data))
      .catch(() => setImprovement(null))
      .finally(() => setImpLoading(false));
  }, []);

  const grouped = topics.reduce((acc, t) => {
    (acc[t.subject] = acc[t.subject] || []).push(t);
    return acc;
  }, {});

  const impGrouped = improvement?.topics ? groupBySubjectThenLesson(improvement.topics) : [];

  const goReview = (t) => {
    const level = t.level || "Beginner";
    router.push(`/lesson?subject=${encodeURIComponent(t.subject)}&lesson=${encodeURIComponent(t.lesson)}&topic=${encodeURIComponent(t.topic)}&level=${encodeURIComponent(level)}&mode=review`);
  };

  const tabBtnStyle = (active) => ({
    padding: "10px 28px", borderRadius: 12, border: "none",
    background: active ? "linear-gradient(135deg, #1d4ed8, #3b82f6)" : "transparent",
    color: active ? "white" : "#64748b",
    fontWeight: 600, fontSize: 14, cursor: "pointer",
    boxShadow: active ? "0 4px 12px rgba(37,99,235,0.3)" : "none",
    transition: "all 0.2s",
  });

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(to bottom, #020617 0%, #0f172a 100%)" }}>
      <Navbar />

      {/* Hero */}
      <div style={{
        position: "relative", overflow: "hidden",
        background: `linear-gradient(145deg, ${NAVY} 0%, #1e3a8a 55%, #2563eb 100%)`,
        padding: "44px 0 40px",
      }}>
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none",
          backgroundImage: "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "48px 48px" }} />
        <div style={{ position: "relative", maxWidth: 1200, margin: "0 auto", padding: "0 32px" }}>
          <h1 className="text-page-title c-white" style={{ margin: "0 0 10px" }}>Your Progress</h1>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, margin: 0, lineHeight: 1.7 }}>
            Review past lessons and track your improvement over time.
          </p>
        </div>
      </div>

      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 32px 80px" }}>
        {/* Tabs */}
        <div style={{ display: "flex", gap: 6, alignItems: "center", background: "#1e293b", padding: 6, borderRadius: 16, marginBottom: 32, width: "fit-content" }}>
          <button onClick={() => setTab("past")} style={tabBtnStyle(tab === "past")}>Past Lessons</button>
          <button onClick={() => setTab("improvements")} style={tabBtnStyle(tab === "improvements")}>Improvements</button>
        </div>

        {/* ── Tab: Past Lessons ── */}
        {tab === "past" && (
          <>
            {pastLoading && <p style={{ color: "#94a3b8", fontSize: 14 }}>Loading your past lessons…</p>}
            {!pastLoading && topics.length === 0 && (
              <p style={{ color: "#94a3b8", fontSize: 14 }}>You haven't studied any lessons yet — completed topics will show up here.</p>
            )}
            {!pastLoading && Object.entries(grouped).map(([subject, subjectTopics]) => {
              const cfg = SUBJECT_CFG[subject] || DEFAULT_CFG;
              return (
                <div key={subject} style={{ marginBottom: 36 }}>
                  <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: "2px solid #334155" }}>
                    <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#f8fafc" }}>{subject}</h2>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {subjectTopics.map((t) => {
                      const key = `${subject}|${t.lesson}|${t.topic}`;
                      const isH = hovered === key;
                      const stats = resultsByTopic[key];
                      return (
                        <div
                          key={key}
                          onClick={() => goReview(t)}
                          onMouseEnter={() => setHovered(key)}
                          onMouseLeave={() => setHovered(null)}
                          style={{
                            background: "#1e293b",
                            border: `1.5px solid ${isH ? cfg.hue + "55" : "#334155"}`,
                            borderRadius: 14, overflow: "hidden", cursor: "pointer",
                            boxShadow: isH ? `0 12px 36px rgba(0,0,0,0.2)` : "0 4px 6px -1px rgba(0,0,0,0.1)",
                            transform: isH ? "translateX(4px)" : "translateX(0)",
                            transition: "all 0.2s cubic-bezier(.22,.61,.36,1)",
                            display: "flex", alignItems: "stretch",
                          }}
                        >
                          <div style={{
                            width: 4, flexShrink: 0,
                            background: isH ? `linear-gradient(180deg, ${cfg.dark}, ${cfg.hue})` : "#f1f5f9",
                            transition: "background 0.2s",
                          }} />
                          <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "18px 24px", flex: 1 }}>
                            <div style={{ flex: 1 }}>
                              <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: isH ? "#f8fafc" : "#cbd5e1" }}>{t.topic}</p>
                              <p style={{ margin: "4px 0 0", fontSize: 12, color: "#94a3b8" }}>
                                {t.lesson}{t.level ? ` · ${t.level}` : ""}
                                {stats ? ` · ${stats.count} practice attempt${stats.count !== 1 ? "s" : ""}, best ${stats.best.toFixed(1)}/10` : ""}
                              </p>
                            </div>
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
                              Review
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
              );
            })}
          </>
        )}

        {/* ── Tab: Improvements ── */}
        {tab === "improvements" && (
          <>
            {impLoading && <p style={{ color: "#94a3b8", fontSize: 14 }}>Loading your improvement history…</p>}
            {!impLoading && (!improvement || improvement.count === 0) && (
              <p style={{ color: "#94a3b8", fontSize: 14 }}>No comparisons yet — complete both a pre-quiz and post-quiz for a topic to see your improvement here.</p>
            )}
            {!impLoading && improvement && improvement.count > 0 && (
              <>
                <div style={{ display: "flex", gap: 16, marginBottom: 40, flexWrap: "wrap" }}>
                  <div style={{ background: "#1e293b", border: "1.5px solid #334155", borderRadius: 14, padding: "16px 24px", minWidth: 160, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)" }}>
                    <p style={{
                      margin: 0, fontSize: 28, fontWeight: 800, lineHeight: 1,
                      color: improvement.average_improvement > 0 ? "#059669" : improvement.average_improvement < 0 ? "#dc2626" : "#64748b",
                    }}>
                      {improvement.average_improvement > 0 ? "+" : ""}{improvement.average_improvement}
                    </p>
                    <p style={{ margin: "6px 0 0", fontSize: 11, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Avg. Improvement</p>
                  </div>
                  <div style={{ background: "#1e293b", border: "1.5px solid #334155", borderRadius: 14, padding: "16px 24px", minWidth: 160, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)" }}>
                    <p style={{ margin: 0, fontSize: 28, fontWeight: 800, lineHeight: 1, color: "#f8fafc" }}>{improvement.count}</p>
                    <p style={{ margin: "6px 0 0", fontSize: 11, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Topics Compared</p>
                  </div>
                </div>

                {impGrouped.map(({ subject, lessons }) => {
                  const cfg = SUBJECT_CFG[subject] || DEFAULT_CFG;
                  return (
                    <div key={subject} style={{ marginBottom: 36 }}>
                      <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: "2px solid #334155" }}>
                        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#f8fafc" }}>{subject}</h2>
                      </div>
                      {lessons.map(({ lesson, items }) => (
                        <div key={lesson} style={{ marginBottom: 20 }}>
                          <h3 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 700, color: cfg.hue }}>{lesson}</h3>
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {items.map((t, i) => {
                              const delta = t.improvement;
                              const dColor = delta > 0 ? "#059669" : delta < 0 ? "#dc2626" : "#64748b";
                              const dBg = delta > 0 ? "#ecfdf5" : delta < 0 ? "#fef2f2" : "#f1f5f9";
                              return (
                                <div key={i} style={{
                                  display: "flex", alignItems: "center", justifyContent: "space-between",
                                  padding: "12px 16px", borderRadius: 10, background: "#1e293b",
                                  border: "1px solid #334155", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
                                }}>
                                  <div style={{ minWidth: 0 }}>
                                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#cbd5e1", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.topic}</p>
                                    <p style={{ margin: "2px 0 0", fontSize: 11, color: "#94a3b8" }}>
                                      {t.level ? `${t.level} · ` : ""}{t.initial_quiz_marks} → {t.final_quiz_marks}
                                    </p>
                                  </div>
                                  <span style={{
                                    background: delta > 0 ? "rgba(16, 185, 129, 0.15)" : delta < 0 ? "rgba(239, 68, 68, 0.15)" : "#334155", color: delta > 0 ? "#10b981" : delta < 0 ? "#ef4444" : "#94a3b8", fontWeight: 700, fontSize: 12,
                                    padding: "4px 12px", borderRadius: 20, flexShrink: 0, marginLeft: 12,
                                  }}>
                                    {delta > 0 ? "+" : ""}{delta}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
