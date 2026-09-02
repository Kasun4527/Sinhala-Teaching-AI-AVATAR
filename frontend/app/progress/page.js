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

  const [topics, setTopics] = useState([]);
  const [resultsByTopic, setResultsByTopic] = useState({});
  const [sidebarData, setSidebarData] = useState([]);
  const [topicDetails, setTopicDetails] = useState({});
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

    // Past lessons & additional progress data
    Promise.all([
      getPastLessons(studentId),
      getPracticeQuizResults(studentId),
      fetch(`${BACKEND}/sidebar-progress?student_id=${encodeURIComponent(studentId)}`).then(r => r.json()).catch(() => ({}))
    ])
      .then(async ([lessonsRes, resultsRes, sidebarRes]) => {
        const pastTopics = lessonsRes?.data?.topics || [];
        setTopics(pastTopics);
        
        const map = {};
        for (const r of resultsRes?.data?.results || []) {
          const key = `${r.subject}|${r.lesson}|${r.topic}`;
          if (!map[key]) map[key] = { count: 0, best: 0 };
          map[key].count += 1;
          map[key].best = Math.max(map[key].best, r.score);
        }
        setResultsByTopic(map);
        setSidebarData(sidebarRes?.subjects || []);

        // Fetch topic details to know pre/post quiz status
        const uniqueSubjects = [...new Set(pastTopics.map(t => t.subject))];
        const detailsMap = {};
        for (const subj of uniqueSubjects) {
          try {
            const res = await fetch(`${BACKEND}/admin/topic-details?student_id=${encodeURIComponent(studentId)}&subject=${encodeURIComponent(subj)}`);
            if (res.ok) {
              const td = await res.json();
              for (const t of td.topics || []) {
                detailsMap[`${subj}|${t.lesson}|${t.topic}`] = t;
              }
            }
          } catch (e) {}
        }
        setTopicDetails(detailsMap);
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

  const getSubjectProgress = (subject) => {
    const subjData = sidebarData.find(s => s.subject === subject);
    if (!subjData) return { pct: 0, done: 0, total: 0 };
    let total = 0; let done = 0;
    subjData.lessons.forEach(l => {
      l.topics.forEach(t => { total++; if (t.done) done++; });
    });
    return { pct: total > 0 ? Math.round((done / total) * 100) : 0, done, total };
  };

  const getLessonProgress = (subject, lesson) => {
    const subjData = sidebarData.find(s => s.subject === subject);
    if (!subjData) return { pct: 0, done: 0, total: 0 };
    const lsnData = subjData.lessons.find(l => l.name === lesson);
    if (!lsnData) return { pct: 0, done: 0, total: 0 };
    let total = 0; let done = 0;
    lsnData.topics.forEach(t => { total++; if (t.done) done++; });
    return { pct: total > 0 ? Math.round((done / total) * 100) : 0, done, total };
  };

  const getMasteryLevel = (marks) => {
    if (marks == null) return { label: "Unknown", color: "#64748b" };
    if (marks <= 3) return { label: "Beginner", color: "#ef4444" }; // red
    if (marks <= 6) return { label: "Intermediate", color: "#f59e0b" }; // amber
    return { label: "Advanced", color: "#10b981" }; // emerald
  };

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
          <button onClick={() => setTab("past")} style={tabBtnStyle(tab === "past")}>Recent Lessons</button>
          <button onClick={() => setTab("improvements")} style={tabBtnStyle(tab === "improvements")}>Improvements</button>
        </div>

        {/* ── Tab: Recent Lessons ── */}
        {tab === "past" && (
          <>
            {pastLoading && <p style={{ color: "#94a3b8", fontSize: 14 }}>Loading your past lessons…</p>}
            {!pastLoading && topics.length === 0 && (
              <p style={{ color: "#94a3b8", fontSize: 14 }}>You haven't studied any lessons yet — completed topics will show up here.</p>
            )}
            {!pastLoading && Object.entries(grouped).map(([subject, subjectTopics]) => {
              const cfg = SUBJECT_CFG[subject] || DEFAULT_CFG;
              const subjProg = getSubjectProgress(subject);
              
              const lessonsMap = {};
              subjectTopics.forEach(t => {
                if (!lessonsMap[t.lesson]) lessonsMap[t.lesson] = [];
                lessonsMap[t.lesson].push(t);
              });

              return (
                <div key={subject} style={{ marginBottom: 36 }}>
                  {/* Subject Header & Progress */}
                  <div style={{ marginBottom: 24, paddingBottom: 16, borderBottom: "2px solid #334155" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 12 }}>
                      <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#f8fafc" }}>{subject}</h2>
                      <span style={{ color: "#94a3b8", fontSize: 13, fontWeight: 600 }}>{subjProg.done}/{subjProg.total} topics</span>
                    </div>
                    <div style={{ height: 6, background: "#1e293b", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${subjProg.pct}%`, background: cfg.hue, borderRadius: 3, transition: "width 0.5s" }} />
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                    {Object.entries(lessonsMap).map(([lesson, topics]) => {
                      const lsnProg = getLessonProgress(subject, lesson);
                      return (
                        <div key={lesson} style={{ paddingLeft: 12, borderLeft: `2px solid ${cfg.hue}40` }}>
                          {/* Lesson Header & Progress */}
                          <div style={{ marginBottom: 16 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#cbd5e1" }}>{lesson}</h3>
                              <span style={{ color: "#64748b", fontSize: 12 }}>{lsnProg.pct}%</span>
                            </div>
                            <div style={{ height: 4, background: "#1e293b", borderRadius: 2, overflow: "hidden" }}>
                              <div style={{ height: "100%", width: `${lsnProg.pct}%`, background: cfg.hue, borderRadius: 2, transition: "width 0.5s" }} />
                            </div>
                          </div>

                          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            {topics.map((t) => {
                              const key = `${subject}|${t.lesson}|${t.topic}`;
                              const isH = hovered === key;
                              const stats = resultsByTopic[key];
                              const details = topicDetails[key];
                              const hasPreQuiz = details?.initial_quiz_marks != null;
                              const hasPostQuiz = details?.final_quiz_marks != null;

                              return (
                                <div
                                  key={key}
                                  onClick={() => goReview(t)}
                                  onMouseEnter={() => setHovered(key)}
                                  onMouseLeave={() => setHovered(null)}
                                  style={{
                                    background: "#1e293b",
                                    border: `1.5px solid ${isH ? cfg.hue + "55" : "#334155"}`,
                                    borderRadius: 12, overflow: "hidden", cursor: "pointer",
                                    boxShadow: isH ? `0 8px 24px rgba(0,0,0,0.2)` : "0 2px 4px rgba(0,0,0,0.1)",
                                    transform: isH ? "translateX(4px)" : "translateX(0)",
                                    transition: "all 0.2s cubic-bezier(.22,.61,.36,1)",
                                    display: "flex", alignItems: "stretch",
                                  }}
                                >
                                  <div style={{
                                    width: 4, flexShrink: 0,
                                    background: isH ? `linear-gradient(180deg, ${cfg.dark}, ${cfg.hue})` : "#475569",
                                    transition: "background 0.2s",
                                  }} />
                                  <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 20px", flex: 1 }}>
                                    <div style={{ flex: 1 }}>
                                      <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: isH ? "#f8fafc" : "#e2e8f0" }}>{t.topic}</p>
                                      
                                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                                        {/* Pre-Quiz Badge */}
                                        <div style={{ 
                                          padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600,
                                          background: hasPreQuiz ? "rgba(16, 185, 129, 0.15)" : "#334155",
                                          color: hasPreQuiz ? "#10b981" : "#64748b" 
                                        }}>
                                          {hasPreQuiz ? "✓ Pre-Quiz" : "Pending Pre-Quiz"}
                                        </div>
                                        {/* Post-Quiz Badge */}
                                        <div style={{ 
                                          padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600,
                                          background: hasPostQuiz ? "rgba(59, 130, 246, 0.15)" : "#334155",
                                          color: hasPostQuiz ? "#3b82f6" : "#64748b" 
                                        }}>
                                          {hasPostQuiz ? "✓ Post-Quiz" : "Pending Post-Quiz"}
                                        </div>
                                        {/* Practice Badge */}
                                        {stats && (
                                          <div style={{ padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600, background: "#334155", color: "#94a3b8" }}>
                                            {stats.count} Practice{stats.count !== 1 ? "s" : ""}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    <div style={{
                                      display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
                                      background: isH ? `linear-gradient(135deg, ${cfg.dark}, ${cfg.hue})` : cfg.bg,
                                      border: `1px solid ${isH ? "transparent" : cfg.ring}`,
                                      color: isH ? "white" : cfg.hue,
                                      padding: "6px 14px", borderRadius: 100,
                                      fontSize: 11, fontWeight: 700, letterSpacing: "0.02em",
                                      boxShadow: isH ? `0 4px 12px ${cfg.hue}40` : "none",
                                      transition: "all 0.2s",
                                    }}>
                                      Review
                                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                                        <path d="M2.5 6h7M6 2.5L9.5 6 6 9.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
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
                          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            {items.map((t, i) => {
                              const delta = t.improvement;
                              const preMastery = getMasteryLevel(t.initial_quiz_marks);
                              const postMastery = getMasteryLevel(t.final_quiz_marks);
                              const isLow = t.final_quiz_marks < 5;
                              const isDecline = delta < 0;

                              return (
                                <div key={i} style={{
                                  display: "flex", flexDirection: "column", gap: 12,
                                  padding: "16px", borderRadius: 12, background: "#1e293b",
                                  border: "1px solid #334155", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
                                }}>
                                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#cbd5e1" }}>{t.topic}</p>
                                      
                                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                                        {/* Pre-Quiz Mastery */}
                                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                          <span style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700 }}>Pre-Quiz ({t.initial_quiz_marks}/10)</span>
                                          <span style={{ fontSize: 13, fontWeight: 600, color: preMastery.color }}>{preMastery.label}</span>
                                        </div>
                                        
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ margin: "0 4px", color: "#475569", marginTop: 12 }}>
                                          <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                        </svg>
                                        
                                        {/* Post-Quiz Mastery */}
                                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                          <span style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700 }}>Post-Quiz ({t.final_quiz_marks}/10)</span>
                                          <span style={{ fontSize: 13, fontWeight: 600, color: postMastery.color }}>{postMastery.label}</span>
                                        </div>
                                      </div>
                                    </div>

                                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                                      <span style={{
                                        background: delta > 0 ? "rgba(16, 185, 129, 0.15)" : delta < 0 ? "rgba(239, 68, 68, 0.15)" : "#334155", 
                                        color: delta > 0 ? "#10b981" : delta < 0 ? "#ef4444" : "#94a3b8", 
                                        fontWeight: 800, fontSize: 14,
                                        padding: "6px 14px", borderRadius: 20,
                                      }}>
                                        {delta > 0 ? "+" : ""}{delta}
                                      </span>
                                      {delta >= 3 && t.final_quiz_marks >= 8 && (
                                        <span style={{ fontSize: 10, color: "#10b981", fontWeight: 700, textTransform: "uppercase" }}>★ Mastery Achieved</span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Learning Recommendations */}
                                  {(isLow || isDecline) && (
                                    <div style={{
                                      marginTop: 8, padding: 12, borderRadius: 8,
                                      background: isDecline ? "rgba(239, 68, 68, 0.1)" : "rgba(245, 158, 11, 0.1)",
                                      border: `1px solid ${isDecline ? "rgba(239, 68, 68, 0.2)" : "rgba(245, 158, 11, 0.2)"}`,
                                      display: "flex", alignItems: "flex-start", gap: 10
                                    }}>
                                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ color: isDecline ? "#ef4444" : "#f59e0b", flexShrink: 0, marginTop: 2 }}>
                                        <path d="M12 9V14M12 17.5V18M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                      </svg>
                                      <div>
                                        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: isDecline ? "#ef4444" : "#f59e0b" }}>
                                          Recommendation: Needs Review
                                        </p>
                                        <p style={{ margin: "4px 0 0", fontSize: 12, color: "#cbd5e1", lineHeight: 1.5 }}>
                                          {isDecline 
                                            ? "Your mastery level declined on the post-quiz. We recommend reviewing the core concepts of this topic before moving forward." 
                                            : "Your final marks are still low. Please consider revisiting the lesson materials or taking practice quizzes."}
                                        </p>
                                        <button 
                                          onClick={() => goReview(t)}
                                          style={{
                                            marginTop: 10, padding: "6px 14px", borderRadius: 6,
                                            background: isDecline ? "#ef4444" : "#f59e0b", color: "white",
                                            border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer"
                                          }}
                                        >
                                          Review Lesson Now
                                        </button>
                                      </div>
                                    </div>
                                  )}
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
