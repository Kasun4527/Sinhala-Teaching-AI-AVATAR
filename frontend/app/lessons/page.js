"use client";

import { useRouter } from "next/navigation";
import { useMergedCurriculum } from "@/data/useCurriculum";
import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import ChatBot from "@/components/ChatBot";
import { enrollSubject, getEnrollments } from "@/services/api";
import { displaySubjectName } from "@/data/subjectDisplay";

const NAVY = "#020617";
const BLUE_D = "#1d4ed8";
const BLUE = "#3b82f6";

const SUBJECT = {
  Physics: { abbr: "PH", hue: "#3b82f6", dark: "#1e3a8a" },
  Chemistry: { abbr: "CH", hue: "#06b6d4", dark: "#164e63" },
  Biology: { abbr: "BI", hue: "#10b981", dark: "#064e3b" },
  Maths: { abbr: "MA", hue: "#8b5cf6", dark: "#4c1d95" },
  "ආර්ථික විද්\u200Dයාව": { abbr: "₨", hue: "#f59e0b", dark: "#78350f", img: "/L3.jfif" },
  "බුද්ධ ධර්මය": { abbr: "☸", hue: "#d946ef", dark: "#701a75", img: "/L2.jfif" },
  "විද්\u200Dයාව": { abbr: "🔬", hue: "#14b8a6", dark: "#134e4a", img: "/L1.jfif" },
  "ඉතිහාසය11": { abbr: "ඉ", hue: "#c2410c", dark: "#7c2d12" },
  "කෘෂි විද්‍යාව12": { abbr: "කෘ", hue: "#65a30d", dark: "#365314" },
  "ගණිතය11": { abbr: "ග", hue: "#6366f1", dark: "#3730a3" },
  "රසායන විද්‍යාව12": { abbr: "ර", hue: "#0891b2", dark: "#164e63" },
  "රසායන විද්‍යාව13": { abbr: "ර", hue: "#2563eb", dark: "#1e3a8a" },
};
const DEFAULT_S = { abbr: "SU", hue: "#64748b", dark: "#1e293b" };

const GRADE_LEVEL = {
  "11 \u0DC1\u0DCA\u200D\u0DBB\u0DDA\u0DAB\u0DD2\u0DBA": "OL",
  "12 \u0DC1\u0DCA\u200D\u0DBB\u0DDA\u0DAB\u0DD2\u0DBA": "AL",
  "13 \u0DC1\u0DCA\u200D\u0DBB\u0DDA\u0DAB\u0DD2\u0DBA": "AL",
};

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export default function LessonsPage() {
  const router = useRouter();
  const curriculum = useMergedCurriculum();
  const [hovered, setHovered] = useState(null);
  const [pendingEnroll, setPending] = useState(null);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollErr, setEnrollErr] = useState("");
  const [grade, setGrade] = useState(0);
  const [educationLevel, setEducationLevel] = useState(null);
  const [hasSetDefaultGrade, setHasSetDefaultGrade] = useState(false);
  const [enrolledSubjects, setEnrolledSubjects] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { router.push("/login"); return; }
    setEducationLevel(localStorage.getItem("education_level") || null);
    const sid = localStorage.getItem("student_id");
    if (sid) {
      fetch(`${BACKEND}/enrollments?student_id=${encodeURIComponent(sid)}`)
        .then(r => r.json())
        .then(d => setEnrolledSubjects((d.subjects || []).map(s => s.subject)))
        .catch(() => {});
    }
  }, [router]);

  useEffect(() => {
    if (!hasSetDefaultGrade && curriculum.length > 0) {
      const edLevel = localStorage.getItem("education_level") || null;
      if (edLevel) {
        const idx = curriculum.findIndex(g => GRADE_LEVEL[g.grade] === edLevel);
        if (idx !== -1) setGrade(idx);
      }
      setHasSetDefaultGrade(true);
    }
  }, [curriculum, hasSetDefaultGrade]);

  const current = curriculum[grade] || { subjects: [] };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(to bottom, #020617 0%, #0f172a 100%)" }}>
      <Navbar />

      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 32px 80px" }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 className="text-page-title c-white" style={{ margin: "0 0 8px" }}>Browse Lessons</h1>
          <p className="text-body c-muted">Explore the curriculum and enrol in new subjects.</p>
        </div>

        {/* Grade Tabs */}
        <div style={{ display: "flex", gap: 6, alignItems: "center", background: "rgba(255,255,255,0.05)", padding: 6, borderRadius: 16, border: "1px solid rgba(255,255,255,0.1)", marginBottom: 32, width: "fit-content" }}>
          {curriculum.map((g, i) => (
            <button
              key={i}
              onClick={() => setGrade(i)}
              style={{
                padding: "8px 24px", borderRadius: 12, border: "none",
                background: grade === i ? `linear-gradient(135deg, ${BLUE_D}, ${BLUE})` : "transparent",
                color: grade === i ? "white" : "#94a3b8",
                fontWeight: 600, fontSize: 13, cursor: "pointer",
                boxShadow: grade === i ? `0 4px 12px rgba(59,130,246,0.4)` : "none",
                transition: "all 0.2s ease",
              }}
            >
              {g.grade}
            </button>
          ))}
        </div>

        {/* Subject Cards Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 24 }}>
          {current.subjects.map((item, i) => {
            const cfg = SUBJECT[item.subject] || DEFAULT_S;
            const isH = hovered === i;
            const tops = item.lessons?.reduce((a, l) => a + (l.topics?.length || 0), 0) || 0;
            const gradeLevel = GRADE_LEVEL[current.grade];
            const isLocked = educationLevel && gradeLevel && educationLevel !== gradeLevel;

            return (
              <div
                key={i}
                onClick={() => {
                  const alreadyEnrolled = enrolledSubjects.includes(item.subject);
                  setPending({ ...item, grade: current.grade, isLocked, gradeLevel, alreadyEnrolled });
                }}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                className="group"
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: `1.5px solid ${isH ? "rgba(59,130,246,0.5)" : "rgba(255,255,255,0.1)"}`,
                  borderRadius: 24, overflow: "hidden", cursor: "pointer", backdropFilter: "blur(10px)",
                  boxShadow: isH ? `0 20px 56px rgba(0,0,0,0.3)` : "0 4px 20px rgba(0,0,0,0.1)",
                  transform: isH ? "translateY(-5px)" : "translateY(0)",
                  transition: "all 0.22s cubic-bezier(.22,.61,.36,1)",
                  position: "relative",
                }}
              >
                <div style={{ height: 6, background: `linear-gradient(90deg, ${cfg.dark}, ${cfg.hue})` }} />
                <div style={{ padding: 24, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: 16,
                    background: cfg.img ? `url(${cfg.img}) center/cover no-repeat` : `linear-gradient(135deg, ${cfg.dark}, ${cfg.hue})`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 16, fontWeight: 800, letterSpacing: "0.06em", color: "white",
                    boxShadow: `0 8px 20px ${cfg.hue}40`, flexShrink: 0,
                  }}>
                    {!cfg.img && cfg.abbr}
                  </div>
                  <div style={{ background: "rgba(255,255,255,0.1)", color: "white", padding: "6px 14px", borderRadius: 100, fontSize: 11, fontWeight: 700, border: "1px solid rgba(255,255,255,0.1)" }}>
                    {item.lessons?.length || 0} lessons
                  </div>
                </div>
                <div style={{ padding: "0 24px 24px" }}>
                  <h3 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 700, color: "white" }}>{displaySubjectName(item.subject)}</h3>
                  <p style={{ margin: "0 0 24px", fontSize: 13, color: "#94a3b8", fontWeight: 500 }}>
                    {current.grade}{tops > 0 && <> &middot; {tops} topics</>}
                  </p>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span className="group-hover:text-blue-400 transition-colors" style={{ fontSize: 14, fontWeight: 700, color: "#cbd5e1" }}>Preview lesson</span>
                    <div className="group-hover:bg-blue-600 group-hover:border-blue-500 transition-all duration-300" style={{
                      width: 38, height: 38, borderRadius: "50%",
                      background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
                        <path d="M3 7h8M7 3l4 4-4 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* ═══ ENROL MODAL ═══ */}
      {pendingEnroll && (() => {
        const cfg = SUBJECT[pendingEnroll.subject] || DEFAULT_S;
        const tops = pendingEnroll.lessons?.reduce((a, l) => a + (l.topics?.length || 0), 0) || 0;
        return (
          <div
            onClick={e => e.target === e.currentTarget && (setPending(null), setEnrollErr(""))}
            style={{
              position: "fixed", inset: 0, zIndex: 3000,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "rgba(2,6,23,0.7)", backdropFilter: "blur(12px)",
            }}
          >
            <div style={{
              width: 480, background: "rgba(30,41,59,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 24,
              overflow: "hidden", boxShadow: "0 40px 100px rgba(0,0,0,0.5)", color: "white"
            }}>
              <div style={{ height: 6, background: `linear-gradient(90deg, ${cfg.dark}, ${cfg.hue})` }} />
              <div style={{ padding: 32, borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", gap: 20 }}>
                <div style={{
                  width: 64, height: 64, borderRadius: 16,
                  background: cfg.img ? `url(${cfg.img}) center/cover no-repeat` : `linear-gradient(135deg, ${cfg.dark}, ${cfg.hue})`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 20, fontWeight: 800, color: "white", letterSpacing: "0.06em",
                  boxShadow: `0 8px 24px ${cfg.hue}45`,
                }}>
                  {!cfg.img && cfg.abbr}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: "white" }}>{displaySubjectName(pendingEnroll.subject)}</h3>
                  <p style={{ margin: "6px 0 0", fontSize: 14, color: "#94a3b8" }}>
                    {pendingEnroll.grade} &middot; {pendingEnroll.lessons?.length || 0} lessons &middot; {tops} topics
                  </p>
                </div>
              </div>
              <div style={{ padding: "26px 30px 30px" }}>
                {pendingEnroll.isLocked ? (
                  <div style={{ padding: 16, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, marginBottom: 16 }}>
                    <p style={{ margin: 0, color: "#b91c1c", fontSize: 14, fontWeight: 600, lineHeight: 1.6 }}>
                      🔒 This subject is for {pendingEnroll.gradeLevel === "OL" ? "O/L" : "A/L"} students. Your account is registered as {educationLevel === "OL" ? "O/L" : "A/L"}.
                    </p>
                  </div>
                ) : pendingEnroll.alreadyEnrolled ? (
                  <p style={{ color: "#374151", fontSize: 15, lineHeight: 1.8, margin: 0 }}>
                    You are already enrolled in <strong style={{ color: NAVY }}>{displaySubjectName(pendingEnroll.subject)}</strong>. Continue where you left off.
                  </p>
                ) : (
                  <p style={{ color: "#374151", fontSize: 15, lineHeight: 1.8, margin: 0 }}>
                    You are about to enrol in <strong style={{ color: NAVY }}>{displaySubjectName(pendingEnroll.subject)}</strong>. Your progress will be tracked and lessons unlocked as you advance.
                  </p>
                )}
                {enrollErr && (
                  <div style={{ marginTop: 20, padding: "14px 16px", borderRadius: 12, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5", fontSize: 14 }}>
                    {enrollErr}
                  </div>
                )}
                <div style={{ display: "flex", gap: 8, marginTop: 24, flexWrap: "wrap" }}>
                  {[`${pendingEnroll.lessons?.length || 0} Lessons`, `${tops} Topics`, "Sinhala Medium", "Adaptive Path"].map((t, i) => (
                    <div key={i} style={{ background: "rgba(255,255,255,0.05)", color: "#cbd5e1", border: "1px solid rgba(255,255,255,0.1)", padding: "6px 14px", borderRadius: 100, fontSize: 12, fontWeight: 600 }}>{t}</div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 12, marginTop: 32 }}>
                  <button
                    onClick={() => { setPending(null); setEnrollErr(""); }}
                    style={{
                      flex: 1, padding: "14px 0", borderRadius: 14,
                      border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)",
                      color: "white", fontWeight: 600, fontSize: 15, cursor: "pointer", transition: "all 0.2s"
                    }}
                    className="hover:bg-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        setEnrolling(true); setEnrollErr("");
                        const studentId = localStorage.getItem("student_id");
                        if (!studentId) throw new Error("Not logged in");
                        await enrollSubject({ student_id: studentId, subject: pendingEnroll.subject, lessons: pendingEnroll.lessons || [], grade: pendingEnroll.grade || "" });
                        setPending(null);
                        router.push(`/sub-lesson?subject=${encodeURIComponent(pendingEnroll.subject)}&grade=${encodeURIComponent(pendingEnroll.grade || "")}`);
                      } catch (err) {
                        setEnrollErr(err?.message || "Enrolment failed. Please try again.");
                      } finally { setEnrolling(false); }
                    }}
                    disabled={enrolling || pendingEnroll.isLocked}
                    style={{
                      flex: 2, padding: "13px 0", borderRadius: 12, border: "none",
                      background: (enrolling || pendingEnroll.isLocked) ? "#94a3b8" : `linear-gradient(135deg, ${BLUE_D}, ${BLUE})`,
                      color: "white", fontWeight: 700, fontSize: 14,
                      cursor: (enrolling || pendingEnroll.isLocked) ? "not-allowed" : "pointer",
                      boxShadow: (enrolling || pendingEnroll.isLocked) ? "none" : `0 6px 20px ${BLUE}50`,
                      transition: "all 0.2s",
                    }}
                    className={!enrolling ? "hover:scale-[1.02]" : ""}
                  >
                    {enrolling ? "Enrolling..." : pendingEnroll.isLocked ? "Locked" : pendingEnroll.alreadyEnrolled ? "Continue Learning →" : "Enrol & Continue →"}
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
