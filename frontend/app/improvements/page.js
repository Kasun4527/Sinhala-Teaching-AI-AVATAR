"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";

const NAVY = "#0f172a";
const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

const SUBJECT_CFG = {
  Physics:              { hue: "#2563eb", dark: "#1e3a8a" },
  Chemistry:            { hue: "#0891b2", dark: "#164e63" },
  Biology:              { hue: "#059669", dark: "#064e3b" },
  Maths:                { hue: "#7c3aed", dark: "#3b0764" },
  "ආර්ථික විද්‍යාව":   { hue: "#b45309", dark: "#78350f" },
  "බුද්ධ ධර්මය":       { hue: "#c026d3", dark: "#701a75" },
  "විද්‍යාව":           { hue: "#0d9488", dark: "#134e4a" },
};
const DEFAULT_CFG = { hue: "#2563eb", dark: "#1e3a8a" };

// Groups a flat topics[] (each already carrying subject/lesson/topic) into
// Subject -> Lesson -> [topics], preserving each level's first-seen order.
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

export default function ImprovementsPage() {
  const router = useRouter();
  const [improvement, setImprovement] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { router.push("/login"); return; }

    const studentId = localStorage.getItem("student_id");
    if (!studentId) { setLoading(false); return; }

    fetch(`${BACKEND}/progress-improvement?student_id=${encodeURIComponent(studentId)}`)
      .then((res) => res.json())
      .then((data) => setImprovement(data))
      .catch(() => setImprovement(null))
      .finally(() => setLoading(false));
  }, []);

  const grouped = improvement?.topics ? groupBySubjectThenLesson(improvement.topics) : [];

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f8fafc", fontFamily: "'Source Sans 3', sans-serif" }}>
      <Sidebar />

      <main style={{ flex: 1, minWidth: 0, overflowY: "auto" }}>
        {/* ── HERO ── */}
        <div style={{
          position: "relative", overflow: "hidden",
          background: `linear-gradient(145deg, ${NAVY} 0%, #1e3a8a 55%, #2563eb 100%)`,
          padding: "52px 60px 48px",
        }}>
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none",
            backgroundImage: "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
            backgroundSize: "48px 48px" }} />
          <div style={{ position: "relative" }}>
            <h1 style={{
              fontFamily: "'Raleway', sans-serif",
              fontSize: 40, fontWeight: 700, color: "#f1f5f9",
              margin: "0 0 10px", letterSpacing: "0.01em", lineHeight: 1.1,
            }}>
              Your Improvement
            </h1>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, margin: 0, lineHeight: 1.7 }}>
              How much your scores improved from pre-quiz to post-quiz, by subject and lesson.
            </p>
          </div>
        </div>

        {/* ── BODY ── */}
        <div style={{ padding: "44px 60px 72px" }}>
          {loading && (
            <p style={{ color: "#94a3b8", fontSize: 14 }}>Loading your improvement history…</p>
          )}

          {!loading && (!improvement || improvement.count === 0) && (
            <p style={{ color: "#94a3b8", fontSize: 14 }}>
              No comparisons yet — complete both a pre-quiz and post-quiz for a topic to see your improvement here.
            </p>
          )}

          {!loading && improvement && improvement.count > 0 && (
            <>
              {/* Summary cards */}
              <div style={{ display: "flex", gap: 16, marginBottom: 40, flexWrap: "wrap" }}>
                <div style={{ background: "white", border: "1.5px solid #e8edf2", borderRadius: 14, padding: "16px 24px", minWidth: 160, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
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
                <div style={{ background: "white", border: "1.5px solid #e8edf2", borderRadius: 14, padding: "16px 24px", minWidth: 160, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                  <p style={{ margin: 0, fontSize: 28, fontWeight: 800, lineHeight: 1, color: NAVY }}>{improvement.count}</p>
                  <p style={{ margin: "6px 0 0", fontSize: 11, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Topics Compared
                  </p>
                </div>
              </div>

              {/* Subject -> Lesson -> Topic breakdown */}
              {grouped.map(({ subject, lessons }) => {
                const cfg = SUBJECT_CFG[subject] || DEFAULT_CFG;
                return (
                  <div key={subject} style={{ marginBottom: 36 }}>
                    <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: "2px solid #e2e8f0" }}>
                      <h2 style={{ margin: 0, fontFamily: "'Raleway', sans-serif", fontSize: 20, fontWeight: 700, color: NAVY }}>
                        {subject}
                      </h2>
                    </div>

                    {lessons.map(({ lesson, items }) => (
                      <div key={lesson} style={{ marginBottom: 20 }}>
                        <h3 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 700, color: cfg.hue }}>
                          {lesson}
                        </h3>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {items.map((t, i) => {
                            const delta = t.improvement;
                            const dColor = delta > 0 ? "#059669" : delta < 0 ? "#dc2626" : "#64748b";
                            const dBg = delta > 0 ? "#ecfdf5" : delta < 0 ? "#fef2f2" : "#f1f5f9";
                            return (
                              <div key={i} style={{
                                display: "flex", alignItems: "center", justifyContent: "space-between",
                                padding: "12px 16px", borderRadius: 10, background: "white",
                                border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.03)",
                              }}>
                                <div style={{ minWidth: 0 }}>
                                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: NAVY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {t.topic}
                                  </p>
                                  <p style={{ margin: "2px 0 0", fontSize: 11, color: "#94a3b8" }}>
                                    {t.level ? `${t.level} · ` : ""}{t.initial_quiz_marks} &rarr; {t.final_quiz_marks}
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
                    ))}
                  </div>
                );
              })}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
