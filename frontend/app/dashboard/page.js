"use client";

import { useRouter } from "next/navigation";
import { useMergedCurriculum } from "@/data/useCurriculum";
import { useEffect, useRef, useState } from "react";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import ChatBot from "@/components/ChatBot";
import { enrollSubject, getEnrollments } from "@/services/api";

const NAVY = "#020617";
const BLUE_D = "#1d4ed8";
const BLUE_XD = "#1e3a8a";
const BLUE = "#3b82f6";

const SUBJECT = {
  Physics: { abbr: "PH", hue: "#3b82f6", dark: "#1e3a8a" },
  Chemistry: { abbr: "CH", hue: "#06b6d4", dark: "#164e63" },
  Biology: { abbr: "BI", hue: "#10b981", dark: "#064e3b" },
  Maths: { abbr: "MA", hue: "#8b5cf6", dark: "#4c1d95" },
  "ආර්ථික විද්‍යාව": { abbr: "₨", hue: "#f59e0b", dark: "#78350f", img: "/L3.jfif" },
  "බුද්ධ ධර්මය": { abbr: "☸", hue: "#d946ef", dark: "#701a75", img: "/L2.jfif" },
  "විද්‍යාව": { abbr: "🔬", hue: "#14b8a6", dark: "#134e4a", img: "/L1.jfif" },
};
const DEFAULT_S = { abbr: "SU", hue: "#64748b", dark: "#1e293b" };

// Grade → education-level mapping
const GRADE_LEVEL = {
  "11 \u0DC1\u0DCA\u200D\u0DBB\u0DDA\u0DAB\u0DD2\u0DBA": "OL",
  "12 \u0DC1\u0DCA\u200D\u0DBB\u0DDA\u0DAB\u0DD2\u0DBA": "AL",
  "13 \u0DC1\u0DCA\u200D\u0DBB\u0DDA\u0DAB\u0DD2\u0DBA": "AL",
};

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

function EnrolledCard({ item, onClick }) {
  const cfg = SUBJECT[item.subject] || DEFAULT_S;

  const lessons = item.lessons || [];
  const doneCount = lessons.reduce((sum, l) => sum + (l.topics?.filter(t => t.done).length || 0), 0);
  const totalCount = lessons.reduce((sum, l) => sum + (l.topics?.length || 0), 0);
  const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  return (
    <div
      className="group transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(59,130,246,0.2)]"
      style={{
        width: "100%", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 24, overflow: "hidden", cursor: "pointer", backdropFilter: "blur(12px)"
      }}
    >
      <div style={{ height: 160, background: cfg.img ? `url(${cfg.img}) center/cover no-repeat` : `linear-gradient(135deg, ${cfg.dark}, ${cfg.hue})`, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {!cfg.img && <span style={{ fontSize: 56, color: "white", opacity: 0.3, fontWeight: 800 }}>{cfg.abbr}</span>}
        <div style={{ position: "absolute", bottom: 12, right: 12, background: "rgba(0,0,0,0.6)", padding: "6px 12px", borderRadius: 8, fontSize: 12, color: "white", fontWeight: 700 }}>
          {item.grade || "Grade 11"}
        </div>
      </div>
      <div style={{ padding: 24 }}>
        <h3 style={{ margin: "0 0 8px", fontSize: 20, color: "white", fontWeight: 700 }}>{item.subject}</h3>
        {/* Progress Bar */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#94a3b8", marginBottom: 6, fontWeight: 600 }}>
            <span>Progress</span>
            <span>{pct}% ({doneCount}/{totalCount})</span>
          </div>
          <div style={{ width: "100%", height: 6, background: "rgba(255,255,255,0.1)", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ width: `${pct}%`, height: "100%", background: cfg.hue || "#3b82f6", borderRadius: 4, transition: "width 0.5s ease" }} />
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onClick(); }}
          className="transition-all duration-300 border border-white/20"
          style={{
            width: "100%", padding: "12px", color: "white", borderRadius: 12, fontWeight: 600,
            backgroundImage: "linear-gradient(to right, #1e3a8a 50%, rgba(255,255,255,0.1) 50%)",
            backgroundSize: "200% 100%",
            backgroundPosition: "100% 0",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundPosition = "0 0";
            e.currentTarget.style.borderColor = "#1e3a8a";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundPosition = "100% 0";
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)";
          }}
        >
          Continue lesson
        </button>
      </div>
    </div>
  );
}

export default function StudentDashboard() {
  const router = useRouter();
  const curriculum = useMergedCurriculum();
  const [name, setName] = useState("");
  const [hovered, setHovered] = useState(null);
  const [pendingEnroll, setPending] = useState(null);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollErr, setEnrollErr] = useState("");
  const [grade, setGrade] = useState(0);
  const [needsTeacherCode, setNeedsTeacherCode] = useState(false);
  const [teacherCodeInput, setTeacherCodeInput] = useState("");
  const [teacherCodeStatus, setTeacherCodeStatus] = useState({ saving: false, error: "" });
  const [educationLevel, setEducationLevel] = useState(null);
  const [hasSetDefaultGrade, setHasSetDefaultGrade] = useState(false);
  const [enrolledSubjects, setEnrolledSubjects] = useState([]);
  const [enrolled, setEnrolled] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const [currentQuoteIndex, setCurrentQuoteIndex] = useState(0);

  const slideshowImages = ["/d1.jpg", "/d2.jfif", "/d3.jpg", "/d4.jpg"];
  const quotes = [
    { text: "“Education is the most powerful weapon which you can use to change the world.”", author: "— Nelson Mandela" },
    { text: "“The important thing is to never stop questioning.”", author: "— Albert Einstein" },
    { text: "“I have no special talent. I am only passionately curious.”", author: "— Albert Einstein" },
    { text: "“Live as if you were to die tomorrow. Learn as if you were to live forever.”", author: "— Mahatma Gandhi" },
    { text: "“The roots of education are bitter, but the fruit is sweet.”", author: "— Aristotle" }
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % slideshowImages.length);
      setCurrentQuoteIndex((prev) => (prev + 1) % quotes.length);
    }, 5000); // Change both every 5 seconds
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) router.push("/login");

    const studentId = localStorage.getItem("student_id");
    setName(localStorage.getItem("name") || "Student");
    setNeedsTeacherCode(!localStorage.getItem("teacher_id"));
    setEducationLevel(localStorage.getItem("education_level") || null);

    // Fetch current enrollments so we know which subjects are already enrolled
    const sid = localStorage.getItem("student_id");
    if (sid) {
      fetch(`${BACKEND}/enrollments?student_id=${encodeURIComponent(sid)}`)
        .then(r => r.json())
        .then(d => setEnrolledSubjects((d.subjects || []).map(s => s.subject)))
        .catch(() => { });
    }

    const fetchEnrollments = async () => {
      if (!studentId) return;
      try {
        const res = await getEnrollments(studentId);
        if (res.data?.subjects) {
          setEnrolled(res.data.subjects);
        }
      } catch (e) {
        console.error("Failed to fetch enrollments", e);
      }
    };
    fetchEnrollments();
  }, [router]);

  useEffect(() => {
    if (!hasSetDefaultGrade && curriculum.length > 0) {
      const edLevel = localStorage.getItem("education_level") || null;
      if (edLevel) {
        const defaultIndex = curriculum.findIndex(g => GRADE_LEVEL[g.grade] === edLevel);
        if (defaultIndex !== -1) setGrade(defaultIndex);
      }
      setHasSetDefaultGrade(true);
    }
  }, [curriculum, hasSetDefaultGrade]);

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
      window.location.reload();
    } catch (err) {
      setTeacherCodeStatus({ saving: false, error: err.message || "Invalid code" });
    }
  };

  const current = curriculum[grade] || { subjects: [] };

  return (
    <div style={{
      display: "flex", minHeight: "100vh",
      background: "linear-gradient(to right, #020617 35%, #0f172a 75%, #1e3a8a 100%)",
      fontFamily: "'Times New Roman', Times, serif"
    }}>
      <Sidebar />

      <main style={{ flex: 1, padding: "48px", display: "flex", flexDirection: "column", gap: "48px", height: "100vh", overflowY: "auto", minWidth: 0 }}>

        {/* Navigation Bar */}
        <Navbar />

        {/* Top Split Section */}
        <div style={{ display: "flex", gap: "48px" }}>

          {/* Left Column - Featured */}
          <div style={{ width: "42%", minWidth: 420, display: "flex", flexDirection: "column", gap: 24, position: "relative", zIndex: 10 }}>

            {/* Main Featured Block */}
            <div style={{
              background: "rgba(255,255,255,0.03)", borderRadius: 32, padding: 32,
              border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(20px)",
              boxShadow: "0 20px 50px rgba(0,0,0,0.4)", position: "relative", overflow: "hidden"
            }}>
              {/* Glow Behind */}
              <div style={{ position: "absolute", top: -50, right: -50, width: 200, height: 200, background: "#3b82f6", filter: "blur(100px)", opacity: 0.3 }} />

              <div style={{ height: 380, borderRadius: 20, overflow: "hidden", position: "relative", border: "1px solid rgba(255,255,255,0.15)", boxShadow: "0 10px 30px rgba(0,0,0,0.5)" }}>
                {slideshowImages.map((src, idx) => (
                  <img
                    key={src}
                    src={src}
                    alt={`Slide ${idx + 1}`}
                    style={{
                      position: "absolute", inset: 0,
                      width: "100%", height: "100%", objectFit: "cover",
                      opacity: idx === currentImageIndex ? 1 : 0,
                      transition: "opacity 1s ease-in-out"
                    }}
                  />
                ))}
              </div>

              <div style={{ position: "relative", height: 130, marginTop: 32, overflow: "hidden" }}>
                {quotes.map((q, idx) => {
                  let offset = "100%";
                  let opacity = 0;
                  if (idx === currentQuoteIndex) {
                    offset = "0%";
                    opacity = 1;
                  } else if (idx === (currentQuoteIndex - 1 + quotes.length) % quotes.length) {
                    offset = "-100%";
                  }

                  return (
                    <div key={idx} style={{
                      position: "absolute", top: 0, left: 0, width: "100%",
                      transform: `translateX(${offset})`,
                      opacity: opacity,
                      transition: "transform 0.8s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.8s ease-in-out"
                    }}>
                      <h3 style={{ color: "white", fontSize: 20, fontWeight: 700, margin: "0 0 12px", lineHeight: 1.5, fontStyle: "italic" }}>
                        {q.text}
                      </h3>
                      <p style={{ color: "#94a3b8", fontSize: 15, margin: 0, fontWeight: 600, textAlign: "right" }}>
                        {q.author}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Teacher Code Block (if needed) */}
            {needsTeacherCode && (
              <div style={{
                background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.3)", borderRadius: 24,
                padding: "24px", position: "relative", zIndex: 1, backdropFilter: "blur(10px)"
              }}>
                <p style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: "white" }}>
                  Link to your teacher
                </p>
                <p style={{ margin: "0 0 16px", fontSize: 14, color: "#bfdbfe" }}>
                  Enter the code your teacher gave you so their lessons appear.
                </p>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <input
                    value={teacherCodeInput}
                    onChange={(e) => setTeacherCodeInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submitTeacherCode()}
                    placeholder="Teacher code"
                    style={{
                      flex: "1 1 200px", padding: "12px 16px", borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.05)",
                      fontSize: 14, outline: "none", color: "white",
                    }}
                  />
                  <button
                    onClick={submitTeacherCode}
                    disabled={teacherCodeStatus.saving || !teacherCodeInput.trim()}
                    style={{
                      padding: "12px 24px", borderRadius: 12, border: "none",
                      background: "#3b82f6", color: "white", fontWeight: 600, fontSize: 14,
                      cursor: teacherCodeStatus.saving ? "default" : "pointer",
                      opacity: teacherCodeStatus.saving ? 0.6 : 1, transition: "background 0.2s"
                    }}
                    className="hover:bg-blue-500"
                  >
                    {teacherCodeStatus.saving ? "Linking..." : "Link"}
                  </button>
                </div>
                {teacherCodeStatus.error && (
                  <p style={{ margin: "10px 0 0", fontSize: 13, color: "#fca5a5" }}>{teacherCodeStatus.error}</p>
                )}
              </div>
            )}

          </div>

          {/* Right Column - Content */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative", zIndex: 10 }}>

            <div style={{
              marginBottom: 48,
              background: "rgba(0,0,0,0.25)",
              borderRadius: 24,
              padding: 32,
              border: "1px solid rgba(255,255,255,0.05)",
              backdropFilter: "blur(20px)",
              boxShadow: "0 20px 40px rgba(0,0,0,0.4)"
            }}>
              <h1 style={{ fontSize: 44, color: "white", fontWeight: 700, margin: "0 0 12px" }}>
                Hello, <span style={{ color: "#93c5fd" }}>{name}</span>
              </h1>
              <p style={{ color: "#bfdbfe", fontSize: 16, margin: 0, lineHeight: 1.6 }}>
                Explore your curriculum below. Select a subject to enrol and begin your personalised learning journey.
              </p>
            </div>

            {/* Continue Learning */}
            {enrolled.length > 0 && (
              <div style={{ marginBottom: 56 }}>
                <h2 style={{ fontSize: 24, color: "white", fontWeight: 700, marginBottom: 24 }}>Continue learning</h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 280px)", gap: 24, paddingBottom: 24 }}>
                  {[...enrolled].reverse().slice(0, 2).map((item, i) => (
                    <EnrolledCard
                      key={i}
                      item={item}
                      onClick={() => router.push(`/sub-lesson?subject=${encodeURIComponent(item.subject)}&grade=${encodeURIComponent(item.grade || "")}`)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Other Lessons / Curriculum */}
        <div id="other-lessons" style={{ scrollMarginTop: "120px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
            <h2 style={{ fontSize: 24, color: "white", fontWeight: 700, margin: 0 }}>Other lessons</h2>

            {/* Grade Tabs */}
            <div style={{ display: "flex", gap: 6, alignItems: "center", background: "rgba(255,255,255,0.05)", padding: "6px", borderRadius: 16, border: "1px solid rgba(255,255,255,0.1)" }}>
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
          </div>

          {/* Cards Grid */}
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
                  {/* Top stripe */}
                  <div style={{ height: 6, background: `linear-gradient(90deg, ${cfg.dark}, ${cfg.hue})` }} />

                  {/* Card header */}
                  <div style={{ padding: "24px", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
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

                  {/* Card body */}
                  <div style={{ padding: "0 24px 24px" }}>
                    <h3 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 700, color: "white" }}>
                      {item.subject}
                    </h3>
                    <p style={{ margin: "0 0 24px", fontSize: 13, color: "#94a3b8", fontWeight: 500 }}>
                      {current.grade}{tops > 0 && <> &middot; {tops} topics</>}
                    </p>

                    <div style={{ height: 3, background: "#f1f5f9", borderRadius: 99, marginBottom: 20 }}>
                      <div style={{
                        height: "100%", borderRadius: 99, width: "40%",
                        background: cfg.ring,
                      }} />
                    </div>

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

              <div style={{ padding: "32px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", gap: 20 }}>
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
                  <h3 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: "white" }}>
                    {pendingEnroll.subject}
                  </h3>
                  <p style={{ margin: "6px 0 0", fontSize: 14, color: "#94a3b8" }}>
                    {pendingEnroll.grade} &middot; {pendingEnroll.lessons?.length || 0} lessons &middot; {tops} topics
                  </p>
                </div>
              </div>

              <div style={{ padding: "26px 30px 30px" }}>
                {pendingEnroll.isLocked ? (
                  <div style={{ padding: "16px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, marginBottom: 16 }}>
                    <p style={{ margin: 0, color: "#b91c1c", fontSize: 14, fontWeight: 600, lineHeight: 1.6 }}>
                      🔒 This subject is for {pendingEnroll.gradeLevel === "OL" ? "O/L" : "A/L"} students. Your account is registered as {educationLevel === "OL" ? "O/L" : "A/L"}.
                    </p>
                  </div>
                ) : pendingEnroll.alreadyEnrolled ? (
                  <p style={{ color: "#374151", fontSize: 15, lineHeight: 1.8, margin: 0 }}>
                    You are already enrolled in <strong style={{ color: NAVY }}>{pendingEnroll.subject}</strong>. Continue where you left off.
                  </p>
                ) : (
                  <p style={{ color: "#374151", fontSize: 15, lineHeight: 1.8, margin: 0 }}>
                    You are about to enrol in <strong style={{ color: NAVY }}>{pendingEnroll.subject}</strong>. Your progress will be tracked and lessons unlocked as you advance.
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
                      } finally {
                        setEnrolling(false);
                      }
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