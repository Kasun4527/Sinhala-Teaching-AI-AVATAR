"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import { getPastLessons, getPracticeQuizResults } from "@/services/api";

const NAVY = "#0f172a";

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

export default function PastLessonsPage() {
  const router = useRouter();
  const [topics, setTopics] = useState([]);
  const [resultsByTopic, setResultsByTopic] = useState({});
  const [loading, setLoading] = useState(true);
  const [hovered, setHovered] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { router.push("/login"); return; }

    const studentId = localStorage.getItem("student_id");
    if (!studentId) { setLoading(false); return; }

    Promise.all([
      getPastLessons(studentId),
      getPracticeQuizResults(studentId),
    ])
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
      .finally(() => setLoading(false));
  }, []);

  const grouped = topics.reduce((acc, t) => {
    (acc[t.subject] = acc[t.subject] || []).push(t);
    return acc;
  }, {});

  const goReview = (t) => {
    const level = t.level || "Beginner";
    router.push(
      `/lesson?subject=${encodeURIComponent(t.subject)}&lesson=${encodeURIComponent(t.lesson)}&topic=${encodeURIComponent(t.topic)}&level=${encodeURIComponent(level)}&mode=review`
    );
  };

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
              Past Lessons
            </h1>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, margin: 0, lineHeight: 1.7 }}>
              Revisit content you've already studied — no quiz required to read it again.
            </p>
          </div>
        </div>

        {/* ── BODY ── */}
        <div style={{ padding: "44px 60px 72px" }}>
          {loading && (
            <p style={{ color: "#94a3b8", fontSize: 14 }}>Loading your past lessons…</p>
          )}

          {!loading && topics.length === 0 && (
            <p style={{ color: "#94a3b8", fontSize: 14 }}>
              You haven't studied any lessons yet — completed topics will show up here.
            </p>
          )}

          {!loading && Object.entries(grouped).map(([subject, subjectTopics]) => {
            const cfg = SUBJECT_CFG[subject] || DEFAULT_CFG;
            return (
              <div key={subject} style={{ marginBottom: 36 }}>
                <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: "2px solid #e2e8f0" }}>
                  <h2 style={{ margin: 0, fontFamily: "'Raleway', sans-serif", fontSize: 20, fontWeight: 700, color: NAVY }}>
                    {subject}
                  </h2>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {subjectTopics.map((t, i) => {
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
                        <div style={{
                          width: 4, flexShrink: 0,
                          background: isH ? `linear-gradient(180deg, ${cfg.dark}, ${cfg.hue})` : "#f1f5f9",
                          transition: "background 0.2s",
                        }} />

                        <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "18px 24px", flex: 1 }}>
                          <div style={{ flex: 1 }}>
                            <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: isH ? NAVY : "#334155" }}>
                              {t.topic}
                            </p>
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
        </div>
      </main>
    </div>
  );
}
