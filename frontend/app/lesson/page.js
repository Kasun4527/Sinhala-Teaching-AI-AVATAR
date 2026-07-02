"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Sidebar from "@/components/Sidebar";
import AvatarTeacher from "@/components/AvatarTeacher";
import ChatBot from "@/components/ChatBot";
import HexPattern from "@/components/HexPattern";

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

  const SUBJECT_CFG = {
    Physics:              { hue: "#2563eb", dark: "#1e3a8a" },
    Chemistry:            { hue: "#0891b2", dark: "#164e63" },
    Biology:              { hue: "#059669", dark: "#064e3b" },
    Maths:                { hue: "#7c3aed", dark: "#3b0764" },
    "ආර්ථික විද්‍යාව":   { hue: "#b45309", dark: "#78350f" },
    "බුද්ධ ධර්මය":       { hue: "#c026d3", dark: "#701a75" },
  };
  const cfg    = SUBJECT_CFG[subject] || { hue: "#2563eb", dark: "#1e3a8a" };
  const accent = cfg.hue;
  const NAVY   = "#0f172a";

  const levelConfig = {
    Advanced:     { bg: "#f5f3ff", color: "#7c3aed", border: "#c4b5fd" },
    Intermediate: { bg: "#fffbeb", color: "#d97706", border: "#fde68a" },
    Beginner:     { bg: "#f0fdf4", color: "#16a34a", border: "#6ee7b7" },
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
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", fontFamily: "'Source Sans 3', sans-serif" }}>
      <Sidebar subject={subject} />

      <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden", height: "100vh", background: "#f8fafc" }}>

        {/* ── HERO ── */}
        <div style={{
          position: "relative", overflow: "hidden", flexShrink: 0,
          background: `linear-gradient(145deg, ${NAVY} 0%, ${cfg.dark} 55%, ${accent} 100%)`,
          padding: "36px 52px 32px",
        }}>
          {/* dot grid */}
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.3,
            backgroundImage: "radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)",
            backgroundSize: "26px 26px" }} />
          <div style={{ position: "absolute", top: -60, right: -40, width: 280, height: 280, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(147,197,253,0.18) 0%, transparent 70%)", pointerEvents: "none" }} />

          <div style={{ position: "relative" }}>
            {/* Breadcrumb */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14 }}>
              {[subject, lesson].filter(Boolean).map((crumb, i, arr) => (
                <span key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                    {crumb}
                  </span>
                  {i < arr.length - 1 && <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 11 }}>›</span>}
                </span>
              ))}
            </div>

            {/* Title row */}
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24 }}>
              <h1 style={{
                fontFamily: "'Raleway', sans-serif",
                fontSize: 34, fontWeight: 700, color: "#f1f5f9",
                margin: 0, letterSpacing: "0.01em", lineHeight: 1.15,
              }}>
                {topic}
              </h1>

              <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                {/* Level badge */}
                <span style={{
                  backgroundColor: lc.bg, color: lc.color,
                  border: `1px solid ${lc.border}`,
                  padding: "5px 16px", borderRadius: 100,
                  fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
                }}>
                  {level}
                </span>

                {/* Engagement inline pill */}
                {(() => {
                  const scoreColor = engScore === null ? "#94a3b8"
                    : engScore >= 75 ? "#22c55e"
                    : engScore >= 50 ? "#f59e0b"
                    : "#ef4444";
                  return (
                    <div style={{
                      display: "flex", alignItems: "center", gap: 8,
                      background: engAlert ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.08)",
                      border: `1px solid ${engAlert ? "rgba(239,68,68,0.4)" : "rgba(255,255,255,0.14)"}`,
                      borderRadius: 100, padding: "5px 14px",
                      transition: "all 0.3s",
                    }}>
                      <div style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: engConnected ? "#22c55e" : "#94a3b8", flexShrink: 0 }} />
                      <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 11, fontWeight: 600 }}>Engagement</span>
                      <span style={{ color: scoreColor, fontWeight: 800, fontSize: 13 }}>
                        {engScore !== null ? `${engScore}%` : "—"}
                      </span>
                      {engEmotion && (
                        <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>{engEmotion}</span>
                      )}
                      {engAlert && (
                        <span style={{ color: "#f87171", fontSize: 11, fontWeight: 700, animation: "pulse 1s infinite" }}>
                          ⚠ Low
                        </span>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
          <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
        </div>

        {/* ── Avatar + Content ── */}
        <div style={{ display: "flex", flex: 1, gap: 20, overflow: "hidden", padding: "20px 52px 28px", position: "relative" }}>
          <HexPattern color={accent} />

          {/* Avatar column */}
          <div style={{ width: 400, flexShrink: 0, overflowY: "auto", scrollbarWidth: "none", position: "relative", zIndex: 1 }}>
            <AvatarTeacher
              content={avatarSpeech || content}
              topic={topic}
              speechReady={speechReady}
              onSentenceChange={setSpeechProgress}
              answerContent={avatarAnswer || undefined}
              onAnswerSpoken={() => setAvatarAnswer("")}
            />
          </div>

          {/* Content column */}
          <div style={{ flex: 1, minWidth: 0, overflowY: "auto", scrollbarWidth: "thin", position: "relative", zIndex: 1 }}>

            {/* Content card */}
            <div style={{
              backgroundColor: "white", borderRadius: 22,
              marginBottom: 20, overflow: "hidden",
              boxShadow: `0 8px 40px rgba(0,0,0,0.09), 0 0 0 1.5px ${accent}20`,
            }}>
              {/* Hero header band */}
              <div style={{
                background: `linear-gradient(135deg, ${cfg.dark} 0%, ${accent} 100%)`,
                padding: "22px 36px",
                position: "relative", overflow: "hidden",
              }}>
                {/* faint dot grid inside header */}
                <div style={{ position: "absolute", inset: 0, pointerEvents: "none",
                  backgroundImage: "radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)",
                  backgroundSize: "22px 22px" }} />
                <div style={{ position: "absolute", top: -40, right: -30, width: 160, height: 160, borderRadius: "50%",
                  background: "radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)", pointerEvents: "none" }} />

                <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    {/* Icon badge */}
                    <div style={{
                      width: 44, height: 44, borderRadius: 13,
                      background: "rgba(255,255,255,0.15)",
                      border: "1.5px solid rgba(255,255,255,0.25)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0, backdropFilter: "blur(4px)",
                    }}>
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <path d="M4 5h12M4 9h8M4 13h10M4 17h6" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
                      </svg>
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "white", fontFamily: "'Raleway', sans-serif", letterSpacing: "0.01em" }}>{lesson}</p>
                      <p style={{ margin: "3px 0 0", fontSize: 11, color: "rgba(255,255,255,0.55)", fontWeight: 500 }}>{topic}</p>
                    </div>
                  </div>

                  {content && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{
                        background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)",
                        color: "white", fontSize: 11, fontWeight: 700,
                        padding: "4px 14px", borderRadius: 100, letterSpacing: "0.05em",
                      }}>
                        ~{Math.ceil(displayContent.replace(/\[IMAGE:[^\]]+\]/gi, "").length / 800)} min read
                      </span>
                      <span style={{
                        backgroundColor: lc.bg, color: lc.color,
                        border: `1px solid ${lc.border}`,
                        fontSize: 11, fontWeight: 700, padding: "4px 14px",
                        borderRadius: 100, letterSpacing: "0.05em",
                      }}>
                        {level}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Content body */}
              <div style={{ padding: "38px 48px", background: "white" }}>
                {content ? (
                  <div style={{ maxWidth: 780 }}>
                    {renderContentWithImages(displayContent)}
                  </div>
                ) : (
                  <div style={{ textAlign: "center", padding: "72px 0" }}>
                    <div style={{ position: "relative", width: 60, height: 60, margin: "0 auto 22px" }}>
                      <div style={{ width: 60, height: 60, borderRadius: "50%", border: "3px solid #f1f5f9", borderTop: `3px solid ${accent}`, animation: "spin 0.9s linear infinite", position: "absolute", inset: 0 }} />
                      <div style={{ width: 40, height: 40, borderRadius: "50%", border: `2px solid ${accent}20`, borderBottom: `2px solid ${accent}70`, animation: "spin 1.4s linear infinite reverse", position: "absolute", top: 10, left: 10 }} />
                    </div>
                    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                    <p style={{ color: NAVY, fontWeight: 700, fontSize: 15, margin: "0 0 6px", fontFamily: "'Raleway', sans-serif" }}>Loading Lesson Content</p>
                    <p style={{ color: "#94a3b8", fontSize: 13, margin: 0 }}>Preparing your personalised material...</p>
                  </div>
                )}
              </div>

              {/* Footer CTA */}
              {content && (
                <div style={{
                  padding: "16px 36px 20px",
                  borderTop: "1px solid #f1f5f9",
                  background: `linear-gradient(135deg, ${accent}06 0%, #f8fafc 100%)`,
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: `linear-gradient(135deg, ${cfg.dark}, ${accent})` }} />
                    <p style={{ margin: 0, fontSize: 13, color: "#64748b", fontWeight: 500 }}>
                      Finished reading? Take the post-lesson quiz.
                    </p>
                  </div>
                  <button
                    onClick={() => router.push(`/quiz?topic=${topic}&level=${level}&type=post&subject=${subject}&lesson=${lesson}`)}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 8,
                      padding: "10px 22px",
                      background: `linear-gradient(135deg, ${cfg.dark}, ${accent})`,
                      color: "white", border: "none", borderRadius: 10,
                      fontSize: 13, fontWeight: 700, cursor: "pointer",
                      boxShadow: `0 4px 16px ${accent}45`,
                      flexShrink: 0,
                    }}
                  >
                    Finish &amp; Take Quiz
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M2.5 7h9M7 3l4 4-4 4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

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
          <div style={{ position: "fixed", bottom: 100, right: 32, zIndex: 1000 }}>
            {qaOpen && (
              <div style={{
                width: 380, backgroundColor: "white",
                borderRadius: 20, marginBottom: 12,
                boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
                border: "1.5px solid #e8edf2", overflow: "hidden",
              }}>
                {/* Top stripe */}
                <div style={{ height: 4, background: `linear-gradient(90deg, ${cfg.dark}, ${accent})` }} />

                {/* Header */}
                <div style={{
                  background: `linear-gradient(135deg, ${accent}10 0%, transparent 100%)`,
                  borderBottom: `1px solid ${accent}18`,
                  padding: "16px 20px",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10,
                      background: `linear-gradient(135deg, ${cfg.dark}, ${accent})`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      boxShadow: `0 4px 10px ${accent}40`,
                    }}>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M8 2a5 5 0 0 1 5 5c0 2.1-1.3 3.9-3.1 4.7L8 14l-1.9-2.3A5 5 0 0 1 3 7a5 5 0 0 1 5-5z" stroke="white" strokeWidth="1.4" strokeLinejoin="round"/>
                        <circle cx="8" cy="7" r="1.2" fill="white"/>
                      </svg>
                    </div>
                    <div>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: NAVY, fontFamily: "'Raleway', sans-serif" }}>Ask the Teacher</p>
                      <p style={{ margin: 0, fontSize: 10, color: "#94a3b8" }}>{topic}</p>
                    </div>
                  </div>
                  <button onClick={() => setQaOpen(false)} style={{
                    width: 28, height: 28, borderRadius: "50%",
                    background: "#f1f5f9", border: "none",
                    color: "#64748b", cursor: "pointer", fontSize: 13,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>✕</button>
                </div>

                <div style={{ padding: "16px 18px" }}>
                  {/* Mic + input row */}
                  <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                    <button
                      onClick={startListening}
                      style={{
                        width: 42, height: 42, borderRadius: 12, border: "none",
                        background: listening
                          ? "linear-gradient(135deg, #7f1d1d, #ef4444)"
                          : `linear-gradient(135deg, ${cfg.dark}, ${accent})`,
                        color: "white", cursor: "pointer", flexShrink: 0,
                        boxShadow: listening ? "0 4px 12px rgba(239,68,68,0.4)" : `0 4px 12px ${accent}40`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        animation: listening ? "pulse 1s infinite" : "none",
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <rect x="5" y="1" width="6" height="9" rx="3" stroke="white" strokeWidth="1.5"/>
                        <path d="M2 8a6 6 0 0 0 12 0M8 14v2" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    </button>
                    <input
                      value={question}
                      onChange={e => setQuestion(e.target.value)}
                      placeholder="ප්‍රශ්නය ටයිප් කරන්න..."
                      style={{
                        flex: 1, border: "1.5px solid #e2e8f0", borderRadius: 12,
                        padding: "10px 14px", fontSize: 13, outline: "none",
                        color: NAVY, background: "#f8fafc",
                        fontFamily: "inherit",
                      }}
                      onKeyDown={e => e.key === "Enter" && askQuestion()}
                    />
                  </div>

                  <button
                    onClick={askQuestion}
                    disabled={!question.trim() || qaLoading}
                    style={{
                      width: "100%", padding: "10px",
                      background: (!question.trim() || qaLoading)
                        ? "#f1f5f9"
                        : `linear-gradient(135deg, ${cfg.dark}, ${accent})`,
                      color: (!question.trim() || qaLoading) ? "#94a3b8" : "white",
                      border: "none", borderRadius: 10,
                      fontSize: 13, fontWeight: 700, cursor: qaLoading ? "wait" : "pointer",
                      marginBottom: 12,
                      boxShadow: (!question.trim() || qaLoading) ? "none" : `0 4px 14px ${accent}40`,
                      transition: "all 0.2s",
                    }}
                  >
                    {qaLoading ? "Thinking..." : "Get Answer"}
                  </button>

                  {qaAnswer && (
                    <div style={{
                      backgroundColor: "#f8fafc", borderRadius: 12,
                      border: `1.5px solid ${accent}20`, padding: "14px 16px",
                    }}>
                      <p style={{ color: "#374151", fontSize: 13, lineHeight: 1.85, margin: "0 0 12px" }}>
                        {qaAnswer}
                      </p>
                      <button
                        onClick={() => { setAvatarAnswer(qaAnswer); setQaOpen(false); }}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 6,
                          background: `linear-gradient(135deg, ${cfg.dark}, ${accent})`,
                          color: "white", border: "none", borderRadius: 8,
                          padding: "7px 16px", fontSize: 12, fontWeight: 700,
                          cursor: "pointer", boxShadow: `0 3px 10px ${accent}40`,
                        }}
                      >
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <polygon points="2,1 11,6 2,11" fill="white"/>
                        </svg>
                        Hear from Avatar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Floating button */}
            <button
              onClick={() => setQaOpen(o => !o)}
              style={{
                width: 56, height: 56, borderRadius: "50%", border: "none",
                background: qaOpen
                  ? "linear-gradient(135deg, #334155, #64748b)"
                  : `linear-gradient(135deg, ${cfg.dark}, ${accent})`,
                color: "white", cursor: "pointer",
                boxShadow: qaOpen ? "0 4px 16px rgba(0,0,0,0.2)" : `0 6px 20px ${accent}50`,
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.2s",
              }}
            >
              {qaOpen
                ? <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M4 4l10 10M14 4L4 14" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>
                : <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="3" y="2" width="10" height="13" rx="3" stroke="white" strokeWidth="1.6"/><path d="M3 10a8 8 0 0 0 15 0" stroke="white" strokeWidth="1.6" strokeLinecap="round"/><path d="M10 15v3" stroke="white" strokeWidth="1.6" strokeLinecap="round"/></svg>
              }
            </button>
            <style>{`@keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.7;transform:scale(1.08)} }`}</style>
          </div>
        );
      })()}

      <ChatBot subject={subject} lesson={lesson} topic={topic} accent={accent} />
    </div>
  );
}