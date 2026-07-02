"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Sidebar from "@/components/Sidebar";
import AvatarTeacher from "@/components/AvatarTeacher";
import ChatBot from "@/components/ChatBot";

const ENGAGEMENT_SERVER = "http://localhost:5000";
const BACKEND = "http://localhost:8000";

export default function LessonPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const subject = searchParams.get("subject");
  const lesson = searchParams.get("lesson");
  const topic = searchParams.get("topic");
  const level = searchParams.get("level") || "Beginner";

  const [content, setContent] = useState("");
  const [avatarSpeech, setAvatarSpeech] = useState("");
  const [speechReady, setSpeechReady] = useState(false);
  const [speechProgress, setSpeechProgress] = useState(-1);

  // Q&A state
  const [qaOpen, setQaOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [question, setQuestion] = useState("");
  const [qaLoading, setQaLoading] = useState(false);
  const [qaAnswer, setQaAnswer] = useState("");
  const [avatarAnswer, setAvatarAnswer] = useState("");

  // Show only retrieved PDF content (strip LLM intro before "---")
  const displayContent = content.includes("\n---\n")
    ? content.split("\n---\n").slice(1).join("\n---\n").trim()
    : content;

  // Engagement state
  const [engScore, setEngScore] = useState(null);
  const [engState, setEngState] = useState("Connecting...");
  const [engEmotion, setEngEmotion] = useState("");
  const [engAlert, setEngAlert] = useState(false);
  const [engConnected, setEngConnected] = useState(false);
  const engTimelineRef = useRef([]);
  const sessionStartRef = useRef(new Date().toISOString());
  const alertCooldownRef = useRef(false);
  const minScoreRef = useRef(100);
  const maxScoreRef = useRef(0);
  const audioCtxRef = useRef(null);

  // Detect if a line looks like a heading (short, no ending punctuation mid-sentence)
  const isHeading = (line) => {
    const t = line.trim();
    if (!t || t.length > 120) return false;
    if (/^\d+[\.\)]\s/.test(t)) return false; // numbered list items — not headings
    // Short line ending with ":" or no punctuation → likely a heading
    if (t.endsWith(":") || t.endsWith("：")) return true;
    // Short standalone line (likely a section title)
    if (t.length < 60 && !/[,;]/.test(t) && !/[a-z]{4,}/.test(t)) return true;
    return false;
  };

  // Pre-count paragraphs in displayContent so we can map progress → index
  const paraCountRef = useRef(0);
  const highlightedParaIdx = speechProgress >= 0 && paraCountRef.current > 0
    ? Math.min(Math.floor(speechProgress * paraCountRef.current), paraCountRef.current - 1)
    : -1;

  const renderContentWithImages = (text) => {
    const lines = text.split("\n");
    const elements = [];
    let paraLines = [];
    let keyIdx = 0;
    let sectionCount = 0;
    let localParaCount = 0;

    const flushPara = () => {
      const joined = paraLines.join(" ").trim();
      if (!joined) { paraLines = []; return; }
      const thisParaIdx = localParaCount++;

      // Detect bullet / numbered list
      if (/^(\d+[\.\)]|•|●|-)\s/.test(joined)) {
        const items = joined.split(/\n/).filter(Boolean);
        elements.push(
          <ul key={`ul-${keyIdx++}`} style={{ margin: "8px 0 20px 0", paddingLeft: 24 }}>
            {items.map((item, i) => (
              <li key={i} style={{
                marginBottom: 8, lineHeight: 1.85,
                color: "#334155", fontSize: 15,
                listStyleType: "disc",
              }}>{item.replace(/^(\d+[\.\)]|•|●|-)\s*/, "")}</li>
            ))}
          </ul>
        );
      } else {
        const isHighlighted = thisParaIdx === highlightedParaIdx;
        elements.push(
          <p key={`p-${keyIdx++}`} style={{
            marginBottom: 20, lineHeight: 2,
            color: isHighlighted ? "#0f172a" : "#374151", fontSize: 15.5,
            textAlign: "justify",
            borderLeft: isHighlighted ? `4px solid ${accent}` : sectionCount === 0 && thisParaIdx === 0 ? `3px solid ${accent}` : "none",
            paddingLeft: isHighlighted || (sectionCount === 0 && thisParaIdx === 0) ? 16 : 0,
            backgroundColor: isHighlighted ? `${accent}12` : "transparent",
            borderRadius: isHighlighted ? 8 : 0,
            padding: isHighlighted ? "10px 16px" : undefined,
            transition: "all 0.5s ease",
            boxShadow: isHighlighted ? `0 0 0 2px ${accent}30` : "none",
          }}>
            {joined}
          </p>
        );
      }
      paraLines = [];
    };

    lines.forEach((line) => {
      const imageMatch = line.match(/\[IMAGE:\s*([^\]]+)\]/i) || line.match(/^\[([^\]]*\.(?:png|jpg|jpeg|gif|webp))\]$/i);
      if (imageMatch) {
        flushPara();
        const filename = imageMatch[1].trim();
        elements.push(
          <div key={`img-${keyIdx++}`} style={{
            margin: "32px 0", textAlign: "center",
            border: `1px solid ${accent}22`,
            borderRadius: 16, padding: "20px 20px 12px",
            backgroundColor: "#f8fafc",
            boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
          }}>
            <img
              src={`${BACKEND}/images/${filename}`}
              alt={filename}
              style={{ maxWidth: "100%", borderRadius: 10, boxShadow: "0 4px 16px rgba(0,0,0,0.10)" }}
              onError={(e) => { e.target.style.display = "none"; }}
            />
            <p style={{ color: "#64748b", fontSize: 12, marginTop: 10, fontStyle: "italic" }}>
              රූපය: {filename.replace(/\.[^.]+$/, "").replace(/_/g, " ")}
            </p>
          </div>
        );
      } else if (line.trim() === "" || line.trim() === "---") {
        flushPara();
        if (line.trim() === "---") {
          sectionCount++;
          elements.push(
            <div key={`div-${keyIdx++}`} style={{
              margin: "32px 0 24px", display: "flex",
              alignItems: "center", gap: 12,
            }}>
              <div style={{ flex: 1, height: 1, backgroundColor: "#e2e8f0" }} />
              <div style={{
                width: 8, height: 8, borderRadius: "50%",
                backgroundColor: accent, opacity: 0.5,
              }} />
              <div style={{ flex: 1, height: 1, backgroundColor: "#e2e8f0" }} />
            </div>
          );
        }
      } else if (isHeading(line)) {
        flushPara();
        sectionCount++;
        elements.push(
          <div key={`h-${keyIdx++}`} style={{ margin: "32px 0 12px" }}>
            <h3 style={{
              fontSize: 17, fontWeight: 700, color: "#0f172a",
              borderBottom: `2px solid ${accent}`,
              paddingBottom: 6, display: "inline-block",
            }}>
              {line.trim().replace(/:$/, "")}
            </h3>
          </div>
        );
      } else {
        paraLines.push(line.trim());
      }
    });

    flushPara();
    paraCountRef.current = localParaCount;
    return elements;
  };

  const subjectColors = {
    Physics: "#2563eb", Chemistry: "#16a34a",
    Biology: "#059669", Maths: "#9333ea",
  };
  const accent = subjectColors[subject] || "#2563eb";

  const levelConfig = {
    Advanced:     { bg: "#f5f3ff", color: "#7c3aed" },
    Intermediate: { bg: "#fffbeb", color: "#d97706" },
    Beginner:     { bg: "#f0fdf4", color: "#16a34a" },
  };
  const lc = levelConfig[level] || levelConfig["Beginner"];

  // Unlock AudioContext on first user interaction
  useEffect(() => {
    const unlock = () => {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      } else if (audioCtxRef.current.state === "suspended") {
        audioCtxRef.current.resume();
      }
    };
    window.addEventListener("click", unlock, { once: true });
    return () => window.removeEventListener("click", unlock);
  }, []);

  // ── Engagement tracking ──────────────────────────────────────────────────
  useEffect(() => {
    if (!topic) return;
    sessionStartRef.current = new Date().toISOString();
    let es;
    try {
      es = new EventSource(`${ENGAGEMENT_SERVER}/api/stats/stream`);
      es.onopen = () => setEngConnected(true);
      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.stopped) { setEngConnected(false); return; }
          const score = data.current?.score ?? 0;
          const state = data.current?.state ?? "";
          const emotion = data.current?.emotion ?? "";
          setEngScore(Math.round(score));
          setEngState(state);
          setEngEmotion(emotion);
          setEngConnected(true);
          minScoreRef.current = Math.min(minScoreRef.current, score);
          maxScoreRef.current = Math.max(maxScoreRef.current, score);
          engTimelineRef.current.push({
            time: new Date().toLocaleTimeString("en-GB"),
            score: Math.round(score),
            emotion,
          });
          // Keep last 300 points (~60s at 5/s)
          if (engTimelineRef.current.length > 300) engTimelineRef.current.shift();

          // Alert if below 50
          if (score < 50 && !alertCooldownRef.current) {
            setEngAlert(true);
            alertCooldownRef.current = true;
            try {
              if (!audioCtxRef.current) {
                audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
              }
              const ctx = audioCtxRef.current;
              if (ctx.state === "suspended") ctx.resume();
              // Play two beeps
              [0, 0.4].forEach((delay) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain); gain.connect(ctx.destination);
                osc.frequency.value = 880;
                gain.gain.setValueAtTime(0, ctx.currentTime + delay);
                gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + delay + 0.05);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.5);
                osc.start(ctx.currentTime + delay);
                osc.stop(ctx.currentTime + delay + 0.5);
              });
            } catch (_) {}
            setTimeout(() => {
              setEngAlert(false);
              alertCooldownRef.current = false;
            }, 30000); // 30s cooldown
          }
        } catch (_) {}
      };
      es.onerror = () => setEngConnected(false);
    } catch (_) {}

    // Save session on unmount
    const saveSession = () => {
      const timeline = engTimelineRef.current;
      if (timeline.length === 0) return;
      const avg = timeline.reduce((s, p) => s + p.score, 0) / timeline.length;
      const studentId = localStorage.getItem("student_id");
      const payload = {
        student_id: studentId,
        subject, lesson, topic,
        avg_score: Math.round(avg * 10) / 10,
        min_score: minScoreRef.current,
        max_score: maxScoreRef.current,
        duration_seconds: Math.round(timeline.length * 0.2),
        timeline: timeline.filter((_, i) => i % 5 === 0), // sample every 5
        started_at: sessionStartRef.current,
      };
      const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
      navigator.sendBeacon(`${BACKEND}/engagement-log`, blob);
    };

    window.addEventListener("beforeunload", saveSession);
    return () => {
      es?.close();
      saveSession();
      window.removeEventListener("beforeunload", saveSession);
    };
  }, [topic]);

  // ── Content loading ──────────────────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { router.push("/login"); return; }
    if (!topic) return;
    const savedContent = localStorage.getItem("lesson_content");
    if (savedContent) {
      setContent(savedContent);
      localStorage.removeItem("lesson_content");

      fetch(`${BACKEND}/explain-content/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: savedContent }),
      })
        .then(r => r.json())
        .then(data => {
          setAvatarSpeech(data.explanation || savedContent);
          setSpeechReady(true);
        })
        .catch(() => {
          setAvatarSpeech(savedContent);
          setSpeechReady(true);
        });
    }
  }, [topic, level]);

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <Sidebar subject={subject} />

      <main style={{ flex: 1, backgroundColor: "#f8fafc", minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden", height: "100vh" }}>

        {/* ── Top section (does not scroll) ── */}
        <div style={{ padding: "32px 48px 0", flexShrink: 0 }}>

        {/* Header */}
        <div style={{
          display: "flex", alignItems: "flex-start",
          justifyContent: "space-between", marginBottom: 32
        }}>
          <div>
            <p style={{
              color: accent, fontSize: 11, fontWeight: 600,
              letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 8
            }}>
              {subject} — {lesson}
            </p>
            <h1 style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 32, fontWeight: 700, color: "#0f172a", marginBottom: 8
            }}>
              {topic}
            </h1>
          </div>

          <span style={{
            backgroundColor: lc.bg, color: lc.color,
            padding: "6px 16px", borderRadius: 20,
            fontSize: 12, fontWeight: 600, flexShrink: 0
          }}>
            {level} Level
          </span>
        </div>

        {/* ── Engagement Widget ── */}
        {(() => {
          const scoreColor = engScore === null ? "#94a3b8"
            : engScore >= 75 ? "#22c55e"
            : engScore >= 50 ? "#f59e0b"
            : "#ef4444";
          return (
            <div style={{
              display: "flex", alignItems: "center", gap: 12,
              marginBottom: 20,
              backgroundColor: "white",
              border: `1.5px solid ${engAlert ? "#ef4444" : "#e2e8f0"}`,
              borderRadius: 14, padding: "12px 20px",
              boxShadow: engAlert ? "0 0 0 3px rgba(239,68,68,0.15)" : "0 1px 4px rgba(0,0,0,0.05)",
              transition: "all 0.3s",
            }}>
              {/* Dot */}
              <div style={{
                width: 8, height: 8, borderRadius: "50%",
                backgroundColor: engConnected ? "#22c55e" : "#94a3b8",
                flexShrink: 0,
              }} />

              <span style={{ color: "#64748b", fontSize: 12, fontWeight: 600 }}>
                Student Engagement
              </span>

              {/* Score gauge */}
              <div style={{ flex: 1, height: 6, backgroundColor: "#f1f5f9", borderRadius: 6, overflow: "hidden" }}>
                <div style={{
                  height: "100%", borderRadius: 6,
                  width: `${engScore ?? 0}%`,
                  backgroundColor: scoreColor,
                  transition: "width 0.4s ease, background-color 0.3s",
                }} />
              </div>

              <span style={{ color: scoreColor, fontWeight: 700, fontSize: 14, minWidth: 36 }}>
                {engScore !== null ? `${engScore}%` : "—"}
              </span>

              {engEmotion && (
                <span style={{
                  backgroundColor: "#f8fafc", border: "1px solid #e2e8f0",
                  borderRadius: 20, padding: "2px 10px",
                  color: "#64748b", fontSize: 11,
                }}>
                  {engEmotion}
                </span>
              )}

              {engAlert && (
                <span style={{
                  backgroundColor: "#fef2f2", color: "#ef4444",
                  borderRadius: 20, padding: "3px 12px",
                  fontSize: 11, fontWeight: 700,
                  animation: "pulse 1s infinite",
                }}>
                  ⚠️ Low Engagement
                </span>
              )}
              <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
            </div>
          );
        })()}

        </div>{/* end top section */}

        {/* Avatar + Content side by side — fills remaining height */}
        <div style={{ display: "flex", flex: 1, gap: 24, overflow: "hidden", padding: "16px 48px 32px" }}>

          {/* Avatar — never scrolls, always visible */}
          <div style={{ width: 420, flexShrink: 0, overflowY: "auto", scrollbarWidth: "none" }}>
            <AvatarTeacher
              content={avatarSpeech || content}
              topic={topic}
              speechReady={speechReady}
              onSentenceChange={setSpeechProgress}
              answerContent={avatarAnswer || undefined}
              onAnswerSpoken={() => setAvatarAnswer("")}
            />
          </div>

          {/* Content — only this column scrolls */}
          <div style={{ flex: 1, minWidth: 0, overflowY: "auto", scrollbarWidth: "thin" }}>
        <div style={{
          backgroundColor: "white", borderRadius: 20,
          marginBottom: 24, overflow: "hidden",
          boxShadow: "0 4px 24px rgba(0,0,0,0.07)",
          border: "1px solid #f1f5f9",
        }}>
          {/* Card header bar */}
          <div style={{
            background: `linear-gradient(135deg, ${accent}15 0%, ${accent}05 100%)`,
            borderBottom: `1px solid ${accent}20`,
            padding: "16px 40px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                backgroundColor: accent, display: "flex",
                alignItems: "center", justifyContent: "center",
                fontSize: 16,
              }}>📖</div>
              <div>
                <p style={{ fontWeight: 700, color: "#0f172a", fontSize: 14, margin: 0 }}>
                  {lesson}
                </p>
                <p style={{ color: "#64748b", fontSize: 12, margin: 0 }}>{topic}</p>
              </div>
            </div>
            {content && (
              <span style={{
                backgroundColor: `${accent}15`, color: accent,
                fontSize: 12, fontWeight: 600,
                padding: "4px 12px", borderRadius: 20,
              }}>
                ~{Math.ceil(displayContent.replace(/\[IMAGE:[^\]]+\]/gi, "").length / 800)} min read
              </span>
            )}
          </div>

          {/* Content body */}
          <div style={{ padding: "36px 48px" }}>
            {content ? (
              <div style={{ maxWidth: 780 }}>
                {renderContentWithImages(displayContent)}
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "40px 0" }}>
                <div style={{
                  width: 40, height: 40, borderRadius: "50%",
                  border: "3px solid #e2e8f0",
                  borderTop: `3px solid ${accent}`,
                  animation: "spin 0.8s linear infinite",
                  margin: "0 auto 16px"
                }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                <p style={{ color: "#94a3b8", fontSize: 14 }}>Loading lesson content...</p>
              </div>
            )}
          </div>
        </div>{/* end content card */}
          {/* Finish Button inside content column */}
          {content && (
            <button
              onClick={() => router.push(`/quiz?topic=${topic}&level=${level}&type=post&subject=${subject}&lesson=${lesson}`)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "8px 20px", marginBottom: 24,
                backgroundColor: accent, color: "white",
                border: "none", borderRadius: 8,
                fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}
            >
              Finish Lesson → Take Quiz
            </button>
          )}
          </div>{/* end right column */}
        </div>{/* end flex row */}

      </main>

      {/* ── Floating Q&A Widget ── */}
      {content && (() => {
        const startListening = () => {
          const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
          if (!SR) { alert("Your browser does not support speech recognition. Use Chrome."); return; }
          const recog = new SR();
          recog.lang = "si-LK";
          recog.interimResults = false;
          recog.onstart = () => setListening(true);
          recog.onend   = () => setListening(false);
          recog.onresult = (e) => {
            const text = e.results[0][0].transcript;
            setQuestion(text);
            setQaAnswer("");
            setAvatarAnswer("");
          };
          recog.onerror = () => setListening(false);
          recog.start();
        };

        const askQuestion = async () => {
          if (!question.trim()) return;
          setQaLoading(true);
          setQaAnswer("");
          try {
            const res = await fetch(`${BACKEND}/ask-question`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ question, subject, lesson, topic, student_id: localStorage.getItem("student_id") }),
            });
            const data = await res.json();
            setQaAnswer(data.answer || "පිළිතුර ලබා ගත නොහැකි විය.");
          } catch {
            setQaAnswer("Error fetching answer.");
          } finally {
            setQaLoading(false);
          }
        };

        return (
          <div style={{ position: "fixed", bottom: 32, right: 32, zIndex: 1000 }}>
            {/* Panel */}
            {qaOpen && (
              <div style={{
                width: 360, backgroundColor: "white",
                borderRadius: 16, marginBottom: 12,
                boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
                border: "1px solid #e2e8f0", overflow: "hidden",
              }}>
                {/* Header */}
                <div style={{
                  background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
                  padding: "14px 18px",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 16 }}>🎤</span>
                    <span style={{ color: "white", fontWeight: 700, fontSize: 14 }}>Ask the Teacher</span>
                  </div>
                  <button onClick={() => setQaOpen(false)} style={{
                    background: "rgba(255,255,255,0.2)", border: "none",
                    color: "white", borderRadius: 6, padding: "2px 8px",
                    cursor: "pointer", fontSize: 12,
                  }}>✕</button>
                </div>

                <div style={{ padding: "16px" }}>
                  {/* Mic + question */}
                  <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                    <button
                      onClick={startListening}
                      style={{
                        width: 40, height: 40, borderRadius: "50%", border: "none",
                        backgroundColor: listening ? "#ef4444" : accent,
                        color: "white", fontSize: 16, cursor: "pointer", flexShrink: 0,
                        animation: listening ? "pulse 1s infinite" : "none",
                      }}
                    >
                      🎤
                    </button>
                    <input
                      value={question}
                      onChange={e => setQuestion(e.target.value)}
                      placeholder="ප්‍රශ්නය කතා කරන්න හෝ ටයිප් කරන්න..."
                      style={{
                        flex: 1, border: "1.5px solid #e2e8f0", borderRadius: 8,
                        padding: "8px 12px", fontSize: 13, outline: "none",
                        color: "#0f172a",
                      }}
                      onKeyDown={e => e.key === "Enter" && askQuestion()}
                    />
                  </div>

                  <button
                    onClick={askQuestion}
                    disabled={!question.trim() || qaLoading}
                    style={{
                      width: "100%", padding: "9px",
                      backgroundColor: (!question.trim() || qaLoading) ? "#e2e8f0" : accent,
                      color: (!question.trim() || qaLoading) ? "#94a3b8" : "white",
                      border: "none", borderRadius: 8,
                      fontSize: 13, fontWeight: 600, cursor: qaLoading ? "wait" : "pointer",
                      marginBottom: 12,
                    }}
                  >
                    {qaLoading ? "Thinking..." : "Get Answer"}
                  </button>

                  {/* Answer */}
                  {qaAnswer && (
                    <div style={{
                      backgroundColor: "#f8fafc", borderRadius: 10,
                      border: `1px solid ${accent}30`, padding: "12px 14px",
                    }}>
                      <p style={{ color: "#374151", fontSize: 13, lineHeight: 1.8, margin: "0 0 10px" }}>
                        {qaAnswer}
                      </p>
                      <button
                        onClick={() => { setAvatarAnswer(qaAnswer); setQaOpen(false); }}
                        style={{
                          backgroundColor: accent, color: "white",
                          border: "none", borderRadius: 8,
                          padding: "7px 16px", fontSize: 12, fontWeight: 600,
                          cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                        }}
                      >
                        ▶ Hear from Avatar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Floating mic button */}
            <button
              onClick={() => setQaOpen(o => !o)}
              style={{
                width: 56, height: 56, borderRadius: "50%",
                backgroundColor: qaOpen ? "#64748b" : accent,
                border: "none", color: "white",
                fontSize: 22, cursor: "pointer",
                boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.2s",
              }}
              title="Ask a question"
            >
              {qaOpen ? "✕" : "🎤"}
            </button>
            <style>{`@keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.7;transform:scale(1.1)} }`}</style>
          </div>
        );
      })()}

      <ChatBot subject={subject} lesson={lesson} topic={topic} accent={accent} />
    </div>
  );
}