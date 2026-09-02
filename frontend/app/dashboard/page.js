"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Navbar from "@/components/Navbar";
import ChatBot from "@/components/ChatBot";
import { getEnrollments } from "@/services/api";
import { displaySubjectName } from "@/data/subjectDisplay";

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
  "ඉතිහාසය11": { abbr: "ඉ", hue: "#c2410c", dark: "#7c2d12" },
  "කෘෂි විද්‍යාව12": { abbr: "කෘ", hue: "#65a30d", dark: "#365314" },
  "ගණිතය11": { abbr: "ග", hue: "#6366f1", dark: "#3730a3" },
  "රසායන විද්‍යාව12": { abbr: "ර", hue: "#0891b2", dark: "#164e63" },
  "රසායන විද්‍යාව13": { abbr: "ර", hue: "#2563eb", dark: "#1e3a8a" },
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
        <h3 style={{ margin: "0 0 8px", fontSize: 20, color: "white", fontWeight: 700 }}>{displaySubjectName(item.subject)}</h3>
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
  const [name, setName] = useState("");
  const [enrolled, setEnrolled] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [profileComplete, setProfileComplete] = useState(true);

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

    // Check profile completeness
    if (studentId) {
      fetch(`${BACKEND}/student-profile?student_id=${encodeURIComponent(studentId)}`)
        .then(r => r.json())
        .then(data => {
          const complete = data.profile_complete;
          setProfileComplete(complete);
          localStorage.setItem("profile_complete", complete ? "true" : "false");
        })
        .catch(() => {});
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



  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(to bottom, #020617 0%, #0f172a 100%)" }}>
      <Navbar />

      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 32px 80px", display: "flex", flexDirection: "column", gap: 48 }}>

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
              <h1 className="text-page-title c-white" style={{ margin: "0 0 12px" }}>
                Hello, <span className="c-blue-pill">{name}</span>
              </h1>
              <p className="text-body c-blue-muted" style={{ margin: 0 }}>
                Explore your curriculum below. Select a subject to enrol and begin your personalised learning journey.
              </p>
            </div>

            {/* Continue Learning */}
            {enrolled.length > 0 && (
              <div style={{ marginBottom: 56 }}>
                <h2 className="text-section-title c-white" style={{ marginBottom: 24 }}>Continue learning</h2>
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
      </main>

      <ChatBot accent={BLUE} />
    </div>
  );
}