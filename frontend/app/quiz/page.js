"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState, Suspense } from "react";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import { BackgroundBeamsWithCollision } from "@/components/ui/background-beams-with-collision";
import { getErrorMessage, getPreQuiz, getPostQuiz, submitPreQuiz, submitPostQuiz, submitSingleAnswer, getPracticeQuiz, submitPracticeQuiz } from "@/services/api";

const NAVY = "#0f172a";

const SUBJECT_CFG = {
  Physics:              { hue: "#2563eb", dark: "#1e3a8a" },
  Chemistry:            { hue: "#0891b2", dark: "#164e63" },
  Biology:              { hue: "#059669", dark: "#064e3b" },
  Maths:                { hue: "#7c3aed", dark: "#3b0764" },
  "ආර්ථික විද්‍යාව":   { hue: "#b45309", dark: "#78350f" },
  "බුද්ධ ධර්මය":       { hue: "#c026d3", dark: "#701a75" },
};
const DEFAULT_CFG = { hue: "#2563eb", dark: "#1e3a8a" };

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
      speed: 0.5 + Math.random() * 0.32,
      opacity: 0.9 + Math.random() * 0.30,
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

// ── Fullscreen loading/submitting overlay ──────────────────────────
function LoadingScreen({ subject, cfg, title, subtitle }) {
  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", fontFamily: "'Source Sans 3', sans-serif" }}>
      <Sidebar subject={subject} />
      <main style={{
        flex: 1, minWidth: 0,
        background: "linear-gradient(135deg, #020617 0%, #0f172a 50%, #1e3a8a 100%)",
        position: "relative", overflow: "hidden",
      }}>
        <BackgroundBeamsWithCollision className="!h-full w-full absolute inset-0 z-0" />
        
        {/* dot grid */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.15, zIndex: 1,
          backgroundImage: "radial-gradient(rgba(255,255,255,0.2) 1px, transparent 1px)",
          backgroundSize: "32px 32px" }} />
        <div style={{ position: "absolute", top: "10%", right: "10%", width: 400, height: 400, borderRadius: "50%", zIndex: 1,
          background: "radial-gradient(circle, rgba(147,197,253,0.15) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: "-10%", left: "-10%", width: 500, height: 500, borderRadius: "50%", zIndex: 1,
          background: "radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)", pointerEvents: "none" }} />

        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10 }}>
          <div style={{
            position: "relative",
            background: "rgba(255,255,255,0.06)", backdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 24, padding: "52px 64px", textAlign: "center",
            boxShadow: "0 32px 80px rgba(0,0,0,0.3)",
            minWidth: 360,
          }}>
            {/* Spinner ring */}
            <div style={{ position: "relative", width: 64, height: 64, margin: "0 auto 28px" }}>
              <div style={{
                width: 64, height: 64, borderRadius: "50%",
                border: "3px solid rgba(255,255,255,0.12)",
                borderTop: "3px solid #93c5fd",
                animation: "spin 0.9s linear infinite",
                position: "absolute", inset: 0,
              }} />
              <div style={{
                width: 44, height: 44, borderRadius: "50%",
                border: "2px solid rgba(255,255,255,0.07)",
                borderBottom: "2px solid rgba(147,197,253,0.5)",
                animation: "spin 1.4s linear infinite reverse",
                position: "absolute", top: 10, left: 10,
              }} />
            </div>
            <p style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 18, margin: "0 0 8px", fontFamily: "'Raleway', sans-serif", letterSpacing: "0.02em" }}>
              {title}
            </p>
            <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 14, margin: 0, lineHeight: 1.7 }}>
              {subtitle}
            </p>
          </div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </main>
    </div>
  );
}

function QuizPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const subject = searchParams.get("subject");
  const lesson  = searchParams.get("lesson");
  const topic   = searchParams.get("topic");
  const level   = searchParams.get("level") || "Beginner";
  const type    = searchParams.get("type") || "pre";
  const grade   = searchParams.get("grade") || "";

  const [quiz, setQuiz]           = useState({ questions: [] });
  const [answers, setAnswers]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState("");

  const cfg    = SUBJECT_CFG[subject] || DEFAULT_CFG;
  const accent = cfg.hue;
  const isPost = type === "post";
  const isPractice = type === "practice";

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { router.push("/login"); return; }
    const studentId = localStorage.getItem("student_id");
    if (!subject || !lesson || !topic) { setLoading(false); return; }
    if (isPractice && !studentId) { setLoading(false); return; }

    const fetchQuiz = async () => {
      try {
        setError(""); setLoading(true);
        const res  = isPost
          ? await getPostQuiz(subject, lesson, topic, level)
          : isPractice
            ? await getPracticeQuiz(studentId, subject, lesson, topic)
            : await getPreQuiz(subject, lesson, topic);
        const data = res?.data || {};
        const generatedQuiz = data.quiz || data || { questions: [] };
        if (data?.quiz?.error) setError(getErrorMessage(data.quiz.error, "Quiz generator returned an error."));
        if (!generatedQuiz?.questions?.length && !generatedQuiz?.error)
          setError("Quiz generator returned no questions.");
        setQuiz(generatedQuiz);
        setAnswers([]);
      } catch (err) {
        setError(getErrorMessage(err, "Quiz generation failed."));
        setQuiz({ questions: [] });
      } finally {
        setLoading(false);
      }
    };
    fetchQuiz();
  }, [subject, lesson, topic, level, type]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const correctAnswers = quiz.questions.map((q) => q.answer);
      const studentId = localStorage.getItem("student_id");
      // Bug #3 Fix: Send quiz_questions for difficulty tracking
      const payload = { subject, lesson, topic, level, student_answers: answers, correct_answers: correctAnswers, student_id: studentId, quiz_questions: quiz.questions };
      
      // Save data for the QuizReview component
      localStorage.setItem("quiz_review_data", JSON.stringify({
        questions: quiz.questions,
        answers: answers
      }));

      if (isPost) {
        const res = await submitPostQuiz(payload);
        if (res?.data?.content) localStorage.setItem("lesson_content", res.data.content);
        router.push(`/result?score=${res?.data?.score || 0}&level=${res?.data?.level || "Beginner"}&topic=${topic}&type=post&subject=${subject}&lesson=${lesson}&grade=${encodeURIComponent(grade)}`);
      } else if (isPractice) {
        const res = await submitPracticeQuiz({
          subject, lesson, topic, student_id: studentId,
          quiz_questions: quiz.questions, student_answers: answers,
        });
        router.push(`/result?score=${res?.data?.score || 0}&level=${res?.data?.score_level || "Beginner"}&topic=${topic}&type=practice&subject=${subject}&lesson=${lesson}`);
      } else {
        const res = await submitPreQuiz(payload);
        localStorage.setItem("lesson_content", res?.data?.content || "");
        router.push(`/result?score=${res?.data?.score || 0}&level=${res?.data?.level || "Beginner"}&topic=${topic}&type=pre&subject=${subject}&lesson=${lesson}&grade=${encodeURIComponent(grade)}`);
      }
    } catch (err) {
      console.error("Submit error:", err?.response?.data || err.message);
      setSubmitting(false);
    }
  };

  if (loading) return (
    <LoadingScreen
      subject={subject} cfg={cfg}
      title={isPost ? "Preparing Post Quiz..." : isPractice ? "Preparing Practice Quiz..." : "Preparing Pre Quiz..."}
      subtitle={`Generating questions for "${topic}"`}
    />
  );

  if (submitting) return (
    <LoadingScreen
      subject={subject} cfg={cfg}
      title={isPost ? "Evaluating your answers..." : "Analysing your level..."}
      subtitle={isPost ? "Saving your progress..." : "Generating your personalised lesson..."}
    />
  );

  if (!quiz?.questions?.length) return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "'Source Sans 3', sans-serif" }}>
      <Sidebar subject={subject} />
      <main style={{ flex: 1, padding: 48, backgroundColor: "#f8fafc" }}>
        <div style={{ maxWidth: 640, background: "white", borderRadius: 16, padding: 28, border: "1.5px solid #fecaca" }}>
          <p style={{ color: "#b91c1c", fontWeight: 700, marginBottom: 8 }}>{error || "No quiz available."}</p>
          <p style={{ color: "#64748b", fontSize: 14, margin: 0 }}>Check the backend console or verify the /ask endpoint response format.</p>
        </div>
      </main>
    </div>
  );

  const answered  = answers.filter(Boolean).length;
  const progress  = (answered / quiz.questions.length) * 100;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f8fafc", fontFamily: "'Source Sans 3', sans-serif" }}>
      <Sidebar subject={subject} />

      <main style={{ flex: 1, minWidth: 0, height: "100vh", overflowY: "auto" }}>
      
        <div style={{ padding: "40px 60px 0" }}>
          <Navbar />
        </div>

        {/* ── HERO ── */}
        <div style={{
          position: "relative", overflow: "hidden",
          background: `linear-gradient(135deg, #020617 0%, #020617 45%, ${NAVY} 70%, ${cfg.dark} 90%, ${accent} 100%)`,
          padding: "44px 60px 40px",
        }}>
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.3,
            backgroundImage: "radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)",
            backgroundSize: "26px 26px" }} />
          {/* Right side glow */}
          <div style={{ position: "absolute", top: -60, right: -40, width: 300, height: 300, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(147,197,253,0.18) 0%, transparent 70%)", pointerEvents: "none" }} />

          <div style={{ position: "relative" }}>
            {/* Breadcrumb */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14 }}>
              {[subject, lesson, topic].filter(Boolean).map((crumb, i, arr) => (
                <span key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ color: i === arr.length - 1 ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.35)", fontSize: 12, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                    {crumb}
                  </span>
                  {i < arr.length - 1 && <span style={{ color: "rgba(255,255,255,0.2)" }}>›</span>}
                </span>
              ))}
            </div>

            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 32 }}>
              <div>
                <h1 style={{ fontFamily: "'Raleway', sans-serif", fontSize: 36, fontWeight: 700, color: "#f1f5f9", margin: "0 0 8px", letterSpacing: "0.01em" }}>
                  {isPost ? "Post Lesson Quiz" : isPractice ? "Practice Quiz" : "Pre Lesson Quiz"}
                </h1>
                <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, margin: 0 }}>
                  {quiz.questions.length} questions &middot; Answer all before submitting
                </p>
              </div>

              {/* Progress tile */}
              <div style={{
                background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.10)",
                borderRadius: 14, padding: "14px 24px", textAlign: "center", flexShrink: 0,
              }}>
                <p style={{ margin: 0, fontSize: 28, fontWeight: 800, color: "#93c5fd", lineHeight: 1 }}>
                  {answered}/{quiz.questions.length}
                </p>
                <p style={{ margin: "5px 0 0", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.38)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Answered</p>
              </div>
            </div>

            {/* Progress bar inside hero */}
            <div style={{ marginTop: 24, height: 4, background: "rgba(255,255,255,0.12)", borderRadius: 99, overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: 99,
                background: "linear-gradient(90deg, #93c5fd, white)",
                width: `${progress}%`, transition: "width 0.35s ease",
              }} />
            </div>
          </div>
        </div>

        {/* ── BODY ── */}
        <div style={{ padding: "40px 60px 72px", position: "relative", overflow: "visible", display: "flex", gap: "40px", alignItems: "flex-start" }}>
          <FloatingPattern color={accent} />
          
          <div style={{ flex: 1, maxWidth: 860, position: "relative", zIndex: 1 }}>
            {/* Questions */}
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {quiz.questions.map((q, i) => (
                <div key={i} id={`q-${i}`} style={{
                  background: "white", borderRadius: 18, overflow: "hidden",
                  border: answers[i] ? `1.5px solid ${accent}40` : "1.5px solid #e8edf2",
                  boxShadow: answers[i]
                    ? `0 4px 20px ${accent}12`
                    : "0 1px 4px rgba(0,0,0,0.04)",
                  transition: "all 0.2s",
                }}>
                  {/* Question top stripe — fills when answered */}
                  <div style={{ height: 4, background: answers[i] ? `linear-gradient(90deg, ${cfg.dark}, ${accent})` : "#f1f5f9", transition: "background 0.3s" }} />

                  <div style={{ padding: "22px 28px" }}>
                    {/* Question text */}
                    <div style={{ display: "flex", gap: 12, marginBottom: 18, alignItems: "flex-start" }}>
                      <div style={{
                        width: 30, height: 30, borderRadius: 9, flexShrink: 0,
                        background: `linear-gradient(135deg, ${cfg.dark}, ${accent})`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 12, fontWeight: 800, color: "white",
                      }}>
                        {i + 1}
                      </div>
                      <p style={{ flex: 1, margin: 0, fontSize: 15, fontWeight: 600, color: NAVY, lineHeight: 1.6 }}>
                        {q.question}
                      </p>
                    </div>

                    {/* Options */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                      {q.options.map((opt, idx) => {
                        const label    = String.fromCharCode(65 + idx);
                        const isSelected = answers[i] === opt;
                        return (
                          <div
                            key={idx}
                            onClick={() => {
                              const a = [...answers]; a[i] = opt; setAnswers(a);
                              // Bug #10: Fire per-answer online learning update (non-blocking)
                              // Practice quizzes must never feed BKT/mastery — skip entirely.
                              const studentId = localStorage.getItem("student_id");
                              if (studentId && q.answer && !isPractice) {
                                submitSingleAnswer({
                                  student_id: studentId,
                                  subject, lesson, topic,
                                  question_index: i,
                                  student_answer: opt,
                                  correct_answer: q.answer,
                                  question_text: q.question || q.text || "",
                                  quiz_type: isPost ? "post" : "pre"
                                }).catch(err => console.warn("Per-answer update failed:", err?.message));
                              }
                            }}
                            style={{
                              display: "flex", alignItems: "center", gap: 14,
                              padding: "11px 16px", borderRadius: 11, cursor: "pointer",
                              border: `1.5px solid ${isSelected ? accent : "#e8edf2"}`,
                              background: isSelected ? `${accent}0e` : "#fafafa",
                              transition: "all 0.15s ease",
                            }}
                          >
                            <div style={{
                              width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                              background: isSelected ? `linear-gradient(135deg, ${cfg.dark}, ${accent})` : "#f1f5f9",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              transition: "all 0.15s",
                              boxShadow: isSelected ? `0 3px 10px ${accent}45` : "none",
                            }}>
                              <span style={{ color: isSelected ? "white" : "#94a3b8", fontWeight: 800, fontSize: 11 }}>
                                {label}
                              </span>
                            </div>
                            <span style={{ color: isSelected ? NAVY : "#475569", fontSize: 14, fontWeight: isSelected ? 600 : 400, transition: "all 0.15s" }}>
                              {opt}
                            </span>
                            {isSelected && (
                              <div style={{ marginLeft: "auto" }}>
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                  <circle cx="8" cy="8" r="7.5" stroke={accent} strokeWidth="1.5"/>
                                  <path d="M5 8l2.5 2.5L11 5.5" stroke={accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Submit button at the end of the quiz */}
            <div style={{ marginTop: 36, display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={handleSubmit}
                disabled={answered < quiz.questions.length}
                style={{
                  padding: "16px 32px",
                  background: answered < quiz.questions.length
                    ? "#e2e8f0"
                    : `linear-gradient(135deg, ${cfg.dark}, ${accent})`,
                  color: answered < quiz.questions.length ? "#94a3b8" : "white",
                  border: "none", borderRadius: 14,
                  fontSize: 16, fontWeight: 800, cursor: answered < quiz.questions.length ? "not-allowed" : "pointer",
                  boxShadow: answered < quiz.questions.length ? "none" : `0 8px 24px ${accent}45`,
                  transition: "all 0.2s",
                  letterSpacing: "0.02em",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                  animation: answered === quiz.questions.length ? "pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)" : "none",
                }}
                onMouseEnter={(e) => { if(answered === quiz.questions.length) e.currentTarget.style.transform = "scale(1.03)" }}
                onMouseLeave={(e) => { if(answered === quiz.questions.length) e.currentTarget.style.transform = "scale(1)" }}
              >
                {answered < quiz.questions.length ? (
                  <span>{quiz.questions.length - answered} Left</span>
                ) : (
                  <>
                    <span>Submit Quiz</span>
                    <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                      <path d="M3 8h10M9 4l4 4-4 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </>
                )}
              </button>
            </div>
          </div>


          {/* Right side Question Palette */}
          <div style={{
            position: "sticky", top: 40, width: 300, flexShrink: 0,
            background: "white", borderRadius: 20, padding: 28,
            border: "1.5px solid #e8edf2", 
            boxShadow: "0 32px 80px rgba(0,0,0,0.12), 0 8px 24px rgba(0,0,0,0.08)",
            zIndex: 10,
          }}>
            <h3 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 800, color: NAVY, fontFamily: "'Raleway', sans-serif" }}>
              Question Map
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
              {quiz.questions.map((_, i) => {
                const isAnswered = !!answers[i];
                return (
                  <div
                    key={i}
                    onClick={() => {
                      const el = document.getElementById(`q-${i}`);
                      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }}
                    style={{
                      aspectRatio: "1", borderRadius: 12,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontWeight: 800, fontSize: 15, cursor: "pointer",
                      background: isAnswered ? `linear-gradient(135deg, ${cfg.dark}, ${accent})` : "#f8fafc",
                      color: isAnswered ? "white" : "#64748b",
                      border: isAnswered ? "none" : "1.5px solid #e2e8f0",
                      boxShadow: isAnswered ? `0 6px 16px ${accent}40` : "none",
                      transform: isAnswered ? "scale(1.05)" : "scale(1)",
                      transition: "all 0.2s cubic-bezier(.22,.61,.36,1)"
                    }}
                  >
                    {i + 1}
                  </div>
                );
              })}
            </div>

            {/* Quick Submit button at the bottom of the palette */}
            <div style={{ marginTop: 32, paddingTop: 24, borderTop: "1.5px dashed #e2e8f0" }}>
              <button
                onClick={handleSubmit}
                disabled={answered < quiz.questions.length}
                style={{
                  width: "100%", padding: "16px",
                  background: answered < quiz.questions.length
                    ? "#e2e8f0"
                    : `linear-gradient(135deg, ${cfg.dark}, ${accent})`,
                  color: answered < quiz.questions.length ? "#94a3b8" : "white",
                  border: "none", borderRadius: 14,
                  fontSize: 15, fontWeight: 800, cursor: answered < quiz.questions.length ? "not-allowed" : "pointer",
                  boxShadow: answered < quiz.questions.length ? "none" : `0 8px 24px ${accent}45`,
                  transition: "all 0.2s",
                  letterSpacing: "0.02em",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  animation: answered === quiz.questions.length ? "pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)" : "none",
                }}
                onMouseEnter={(e) => { if(answered === quiz.questions.length) e.currentTarget.style.transform = "scale(1.03)" }}
                onMouseLeave={(e) => { if(answered === quiz.questions.length) e.currentTarget.style.transform = "scale(1)" }}
              >
                {answered < quiz.questions.length ? (
                  <span>{quiz.questions.length - answered} Left</span>
                ) : (
                  <>
                    <span>Submit</span>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M3 8h10M9 4l4 4-4 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </main>
      <style>{`
        @keyframes pop {
          0% { transform: scale(0.95); opacity: 0.8; }
          40% { transform: scale(1.04); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

export default function QuizPage() {
  return (
    <Suspense fallback={null}>
      <QuizPageContent />
    </Suspense>
  );
}