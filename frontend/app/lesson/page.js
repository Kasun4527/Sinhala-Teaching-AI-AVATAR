"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useMemo, Suspense } from "react";
import Navbar from "@/components/Navbar";
import AvatarSelector from "@/components/AvatarSelector";
import ChatBot from "@/components/ChatBot";
import { useMergedCurriculum, findSubjectIn } from "@/data/useCurriculum";
import { getPastLessons } from "@/services/api";
import YouTubePanel from "@/components/YouTubePanel";

const ENGAGEMENT_SERVER = process.env.NEXT_PUBLIC_ENGAGEMENT_URL || "http://localhost:5000";
const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

function FloatingPattern({ color }) {
  return null;
}

function LessonPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const subject = searchParams.get("subject");
  const lesson = searchParams.get("lesson");
  const topic = searchParams.get("topic");
  const level = searchParams.get("level") || "Beginner";
  const mode = searchParams.get("mode") || "live";
  const isReview = mode === "review";

  const [content, setContent] = useState("");
  const [avatarSpeech, setAvatarSpeech] = useState("");
  const [speechReady, setSpeechReady] = useState(false);
  const [speechProgress, setSpeechProgress] = useState(-1);
  const handleSentenceChange = (idx) => {
    console.log("[HIGHLIGHT] onSentenceChange called with idx:", idx);
    setSpeechProgress(idx);
  };

  const [youtubeOpen, setYoutubeOpen] = useState(false);
  const [avatarAnswer, setAvatarAnswer] = useState("");

  const curriculumData = useMergedCurriculum();
  const subjectData = findSubjectIn(curriculumData, subject);
  
  const [completedTopics, setCompletedTopics] = useState(new Set());
  const [activeTab, setActiveTab] = useState("note"); // "note" | "content"
  const [expandedLesson, setExpandedLesson] = useState(lesson);

  useEffect(() => {
    const studentId = localStorage.getItem("student_id");
    if (!studentId) return;
    getPastLessons(studentId).then(res => {
      const past = res?.data?.topics || [];
      const completedSet = new Set(
         past.filter(t => t.subject === subject).map(t => `${t.lesson}|${t.topic}`)
      );
      setCompletedTopics(completedSet);
    }).catch(console.error);
  }, [subject]);

  // Show only retrieved PDF content (strip LLM intro before "---")
  const displayContent = content.includes("\n---\n")
    ? content.split("\n---\n").slice(1).join("\n---\n").trim()
    : content;

  // Engagement state
  const [engScore, setEngScore] = useState(null);
  const [engEmotion, setEngEmotion] = useState("");
  const [engAlert, setEngAlert] = useState(false);
  const [engConnected, setEngConnected] = useState(false);
  const [engPhoneDetected, setEngPhoneDetected] = useState(false);
  const engTimelineRef = useRef([]);
  const sessionStartRef = useRef(new Date().toISOString());
  const alertCooldownRef = useRef(false);
  const minScoreRef = useRef(100);
  const maxScoreRef = useRef(0);
  const audioCtxRef = useRef(null);

  // Taking Notes mode — pauses engagement tracking, keeps score high
  const takingNotesRef = useRef(false);
  const [takingNotes, setTakingNotes] = useState(false);

  // Privacy notice
  const [showPrivacyNotice, setShowPrivacyNotice] = useState(true);

  // Detect if a line looks like a heading.
  // Works for both English and Sinhala — relies on structure, not character set.
  const isHeading = (line) => {
    const t = line.trim();
    if (!t || t.length > 160) return false;
    if (/^\d+[\.\)]\s/.test(t)) return false;   // numbered list items — not headings
    if (t.endsWith(":") || t.endsWith("：")) return true;  // ends with colon
    // English headings: short line with no lowercase words longer than 3 chars
    if (/[a-zA-Z]/.test(t) && t.length < 60 && !/[,;]/.test(t) && !/[a-z]{4,}/.test(t)) return true;
    // For Sinhala/non-Latin: only treat as heading if it ends with ":" or is extremely short (< 20 chars)
    // to avoid swallowing real Sinhala paragraph text
    if (!/[a-zA-Z]/.test(t) && t.length < 20) return true;
    return false;
  };

  const paraRefsMap = useRef({});

  // Extract only the highlightable plain paragraphs (no headings, no lists, no images).
  // This array is passed to Avatar → TTS route so both sides use identical indices.
  const contentParas = useMemo(() => {
    if (!displayContent) return [];
    const lines = displayContent.split("\n");
    const paras = [];
    let buf = [];
    const flush = () => {
      const j = buf.join(" ").trim();
      buf = [];
      if (!j) return;
      if (/^(\d+[\.\)]|•|●|-)\s/.test(j)) return; // skip lists
      if (/\[IMAGE:/i.test(j)) return;              // skip images
      paras.push(j);
    };
    lines.forEach((line) => {
      const l = line.trim();
      if (!l || /\[IMAGE:/i.test(l) || l === "---") { flush(); return; }
      if (isHeading(l)) { flush(); return; }
      buf.push(l);
    });
    flush();
    return paras;
  }, [displayContent]);

  // speechProgress = chunk index (each chunk covers 2 content paragraphs)
  // para i is highlighted when Math.floor(i/2) === speechProgress
  const highlightedParaIdx = speechProgress;

  // Auto-scroll to first paragraph of the highlighted pair
  useEffect(() => {
    if (highlightedParaIdx < 0) return;
    const el = paraRefsMap.current[highlightedParaIdx * 2];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightedParaIdx]);

  const renderContentWithImages = (text) => {
    const lines = text.split("\n");
    const elements = [];
    let paraLines = [];
    let keyIdx = 0;
    let sectionCount = 0;
    let plainParaCount = 0; // counts only highlightable <p> elements, matches contentParas indices

    const flushPara = () => {
      const joined = paraLines.join(" ").trim();
      if (!joined) { paraLines = []; return; }

      // Detect bullet / numbered list — render but don't count as highlightable
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
        const capturedIdx = plainParaCount++;
        const isHighlighted = highlightedParaIdx >= 0 && Math.floor(capturedIdx / 2) === highlightedParaIdx;
        elements.push(
          <p
            key={`p-${keyIdx++}`}
            ref={(el) => { paraRefsMap.current[capturedIdx] = el; }}
            style={{
              marginBottom: 20, lineHeight: 2,
              color: isHighlighted ? "#0f172a" : "#374151",
              fontSize: 15.5, textAlign: "justify",
              backgroundColor: isHighlighted ? `${accent}14` : "transparent",
              borderLeft: isHighlighted ? `4px solid ${accent}` : "none",
              paddingLeft: isHighlighted ? 14 : 0,
              borderRadius: isHighlighted ? 6 : 0,
              transition: "background-color 0.3s ease, border-left 0.3s ease",
            }}
          >
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
    return elements;
  };

  const SUBJECT_CFG = {
    Physics: { hue: "#2563eb", dark: "#1e3a8a" },
    Chemistry: { hue: "#0891b2", dark: "#164e63" },
    Biology: { hue: "#059669", dark: "#064e3b" },
    Maths: { hue: "#7c3aed", dark: "#3b0764" },
    "ආර්ථික විද්‍යාව": { hue: "#b45309", dark: "#78350f" },
    "බුද්ධ ධර්මය": { hue: "#c026d3", dark: "#701a75" },
    "ඉතිහාසය11": { hue: "#c2410c", dark: "#7c2d12" },
    "කෘෂි විද්‍යාව12": { hue: "#65a30d", dark: "#365314" },
    "ගණිතය11": { hue: "#6366f1", dark: "#3730a3" },
    "රසායන විද්‍යාව12": { hue: "#0891b2", dark: "#164e63" },
    "රසායන විද්‍යාව13": { hue: "#2563eb", dark: "#1e3a8a" },
  };
  const cfg = SUBJECT_CFG[subject] || { hue: "#2563eb", dark: "#1e3a8a" };
  const accent = cfg.hue;
  const NAVY = "#0f172a";

  const levelConfig = {
    Advanced: { bg: "#f5f3ff", color: "#7c3aed", border: "#c4b5fd" },
    Intermediate: { bg: "#fffbeb", color: "#d97706", border: "#fde68a" },
    Beginner: { bg: "#f0fdf4", color: "#16a34a", border: "#6ee7b7" },
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
  // The engagement engine has no access to the student's webcam itself (it's a
  // hosted service) — the browser captures frames here and POSTs each one for
  // scoring, instead of the old model of asking a local server process to open
  // the camera and stream results back over SSE.
  const engStreamRef = useRef(null);
  const engVideoRef = useRef(null);
  const engIntervalRef = useRef(null);
  const engSessionIdRef = useRef(null);

  useEffect(() => {
    if (!topic) return;
    sessionStartRef.current = new Date().toISOString();
    engSessionIdRef.current = crypto.randomUUID();

    // Local-dev convenience: ask the backend to spawn the engagement engine
    // if it isn't already running, instead of requiring a third terminal.
    // No-op in production (the backend has nothing to spawn there — it's
    // already running as its own deployed service) and fire-and-forget here
    // either way — captureAndSend()'s own try/catch below already handles
    // the engine not being reachable yet while it boots.
    fetch(`${BACKEND}/start-engagement-engine`, { method: "POST" }).catch(() => {});

    const FRAME_INTERVAL_MS = 700;
    const MAX_TIMELINE_POINTS = 90; // ~60s of history at one frame per 700ms

    const applyStats = (current) => {
      if (!current) return;
      const score = current.score ?? 0;
      const emotion = current.emotion ?? "";
      const phoneDetected = current.phone_detected ?? false;
      setEngScore(Math.round(score));
      setEngEmotion(emotion);
      setEngPhoneDetected(phoneDetected);
      setEngConnected(true);
      minScoreRef.current = Math.min(minScoreRef.current, score);
      maxScoreRef.current = Math.max(maxScoreRef.current, score);
      engTimelineRef.current.push({
        time: new Date().toLocaleTimeString("en-GB"),
        score: Math.round(score),
        emotion,
      });
      if (engTimelineRef.current.length > MAX_TIMELINE_POINTS) engTimelineRef.current.shift();

      // Low-engagement badge tracks the live score directly, so it clears
      // as soon as the score recovers instead of waiting on the beep cooldown.
      setEngAlert(score < 50);

      // Beep is still throttled so it doesn't fire on every frame while score stays low.
      if (score < 50 && !alertCooldownRef.current) {
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
        } catch (_) { }
        setTimeout(() => {
          alertCooldownRef.current = false;
        }, 30000); // 30s cooldown
      }
    };

    let cancelled = false;
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 480;
    const canvasCtx = canvas.getContext("2d");

    const captureAndSend = async () => {
      // When student is taking notes, skip frame capture and inject a high score
      if (takingNotesRef.current) {
        applyStats({
          score: 100,
          emotion: "Focused",
        });
        return;
      }
      const video = engVideoRef.current;
      if (!video || video.readyState < 2) return;
      canvasCtx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const frame_b64 = canvas.toDataURL("image/jpeg", 0.7).split(",")[1];
      try {
        const res = await fetch(`${ENGAGEMENT_SERVER}/api/frame`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: engSessionIdRef.current, frame_b64 }),
        });
        if (!res.ok) throw new Error("bad response");
        const data = await res.json();
        applyStats(data.current);
      } catch (_) {
        setEngConnected(false);
      }
    };

    navigator.mediaDevices?.getUserMedia?.({ video: { width: 640, height: 480 } })
      .then((stream) => {
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        engStreamRef.current = stream;
        const video = document.createElement("video");
        video.srcObject = stream;
        video.muted = true;
        video.playsInline = true;
        video.play().catch(() => { });
        engVideoRef.current = video;
        engIntervalRef.current = setInterval(captureAndSend, FRAME_INTERVAL_MS);
      })
      .catch(() => {
        // No camera, or the student denied permission — degrade gracefully
        // instead of leaving the pill stuck on "Connecting...".
        setEngConnected(false);
        setEngScore(0);
        setEngEmotion("camera-off");
      });

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
        duration_seconds: Math.round(timeline.length * (FRAME_INTERVAL_MS / 1000)),
        timeline: timeline.filter((_, i) => i % 5 === 0), // sample every 5
        started_at: sessionStartRef.current,
      };
      const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
      navigator.sendBeacon(`${BACKEND}/engagement-log`, blob);
    };

    window.addEventListener("beforeunload", saveSession);
    return () => {
      cancelled = true;
      if (engIntervalRef.current) clearInterval(engIntervalRef.current);
      // Release the webcam the moment the student leaves the lesson page
      // (tab close, navigation away, etc.) instead of leaving it running.
      engStreamRef.current?.getTracks().forEach((t) => t.stop());
      engStreamRef.current = null;
      engVideoRef.current = null;
      saveSession();
      window.removeEventListener("beforeunload", saveSession);
    };
  }, [topic]);

  // ── Content loading ──────────────────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { router.push("/login"); return; }
    if (!topic) return;
    const processContent = (lessonText) => {
      setContent(lessonText);

      // Extract plain paragraphs (same logic as contentParas useMemo)
      // so backend can generate one explanation per paragraph
      const disp = lessonText.includes("\n---\n")
        ? lessonText.split("\n---\n").slice(1).join("\n---\n").trim()
        : lessonText;
      const isHdg = (t) => {
        if (!t || t.length > 160) return false;
        if (/^\d+[\.\)]\s/.test(t)) return false;
        if (t.endsWith(":") || t.endsWith("：")) return true;
        if (/[a-zA-Z]/.test(t) && t.length < 60 && !/[,;]/.test(t) && !/[a-z]{4,}/.test(t)) return true;
        if (!/[a-zA-Z]/.test(t) && t.length < 20) return true;
        return false;
      };
      const lines = disp.split("\n");
      const paras = [];
      let buf = [];
      lines.forEach((line) => {
        const l = line.trim();
        if (!l || /\[IMAGE:/i.test(l) || l === "---") {
          const j = buf.join(" ").trim(); buf = [];
          if (j && !/^(\d+[\.\)]|•|●|-)\s/.test(j) && !/\[IMAGE:/i.test(j)) paras.push(j);
          return;
        }
        if (isHdg(l)) {
          const j = buf.join(" ").trim(); buf = [];
          if (j && !/^(\d+[\.\)]|•|●|-)\s/.test(j)) paras.push(j);
          return;
        }
        buf.push(l);
      });
      const j = buf.join(" ").trim();
      if (j && !/^(\d+[\.\)]|•|●|-)\s/.test(j)) paras.push(j);

      // The explain-content call hits an external fine-tuned model that's
      // occasionally slow/flaky rather than consistently down — one retry
      // before accepting the raw-content fallback avoids the avatar
      // silently reading unexplained text just because of a transient
      // hiccup. The backend now reports `explained: false` when it had to
      // fall back internally, so a 200 response isn't automatically trusted.
      const fetchExplanation = (attempt = 1) => {
        fetch(`${BACKEND}/explain-content/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: lessonText, paragraphs: paras }),
        })
          .then(r => r.json())
          .then(data => {
            if (data.explained === false && attempt === 1) {
              console.warn("[Avatar] explanation failed, retrying once...");
              fetchExplanation(2);
              return;
            }
            if (data.explained === false) {
              console.warn("[Avatar] explanation still unavailable after retry — avatar will read raw content.");
            }
            setAvatarSpeech(data.explanation || lessonText);
            setSpeechReady(true);
          })
          .catch(() => {
            if (attempt === 1) {
              console.warn("[Avatar] explain-content request failed, retrying once...");
              fetchExplanation(2);
              return;
            }
            console.warn("[Avatar] explain-content failed twice — avatar will read raw content.");
            setAvatarSpeech(lessonText);
            setSpeechReady(true);
          });
      };
      fetchExplanation();
    };

    if (isReview) {
      // Review mode: fetch the EXACT originally-delivered content — never
      // localStorage, never a fresh /get-lesson/ regeneration.
      const studentId = localStorage.getItem("student_id");
      if (!studentId || !subject || !lesson) return;
      fetch(
        `${BACKEND}/past-lessons/content/?student_id=${encodeURIComponent(studentId)}&subject=${encodeURIComponent(subject)}&lesson=${encodeURIComponent(lesson)}&topic=${encodeURIComponent(topic)}`
      )
        .then(r => r.json())
        .then(data => {
          if (data.content) processContent(data.content);
        })
        .catch(err => {
          console.error("[Lesson] review content fetch failed:", err);
        });
      return;
    }

    const savedContent = localStorage.getItem("lesson_content");
    if (savedContent) {
      localStorage.removeItem("lesson_content");
      processContent(savedContent);
    } else if (subject && lesson) {
      // Refresh case: the quiz flow hands content over via localStorage and
      // it's consumed (removed) on first load, so a hard refresh lands here
      // with nothing saved. Re-fetch the lesson from the backend instead of
      // sitting on the loading spinner forever.
      fetch(
        `${BACKEND}/get-lesson/?subject=${encodeURIComponent(subject)}&lesson=${encodeURIComponent(lesson)}&topic=${encodeURIComponent(topic)}&level=${encodeURIComponent(level)}`
      )
        .then(r => r.json())
        .then(data => {
          if (data.content) processContent(data.content);
        })
        .catch(err => {
          console.error("[Lesson] content re-fetch failed:", err);
        });
    }
  }, [topic, level, isReview]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", background: "linear-gradient(to right, #020617 0%, #0f172a 55%, #1e3a8a 85%, #1d4ed8 100%)" }}>
      <Navbar />

      <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>

        {/* ── Privacy Notice ── */}
        {showPrivacyNotice && (
          <div style={{
            position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 100,
            background: "linear-gradient(90deg, #0f172a, #1e293b)", padding: "12px 24px",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
            border: "1px solid #334155", borderRadius: 16,
            boxShadow: "0 10px 25px rgba(0,0,0,0.3)", width: "max-content", maxWidth: "90%",
            animation: "slideDownFade 0.4s cubic-bezier(0.16, 1, 0.3, 1)"
          }}>
            <style>{`
              @keyframes slideDownFade {
                from { transform: translate(-50%, -20px); opacity: 0; }
                to { transform: translate(-50%, 0); opacity: 1; }
              }
            `}</style>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.3)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <span style={{ fontSize: 16 }}>🔒</span>
              </div>
              <div>
                <p style={{ margin: 0, color: "#e2e8f0", fontSize: 12, fontWeight: 600 }}>
                  Privacy Notice — Camera Engagement Tracking
                </p>
                <p style={{ margin: "2px 0 0", color: "#94a3b8", fontSize: 11, lineHeight: 1.5 }}>
                  Your camera is used to monitor your engagement level during the lesson.
                  <strong style={{ color: "#93c5fd" }}> No video or images are recorded or stored.</strong> All
                  processing happens in real-time and data is discarded immediately after scoring. Your privacy is fully protected.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowPrivacyNotice(false)}
              style={{
                background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 8, padding: "6px 14px", color: "#94a3b8",
                fontSize: 11, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
                transition: "all 0.15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.14)"; e.currentTarget.style.color = "#e2e8f0"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "#94a3b8"; }}
            >
              ✕ Dismiss
            </button>
          </div>
        )}

        {/* ── 2-Column Layout ── */}
        <div style={{ display: "flex", flex: 1, gap: 24, overflow: "hidden", padding: "24px 48px", position: "relative" }}>
          <FloatingPattern color={accent} />

          {/* ── LEFT COLUMN (2/3) ── */}
          <div style={{ flex: 2, display: "flex", flexDirection: "column", gap: 20, overflowY: "auto", scrollbarWidth: "none", position: "relative", zIndex: 1, minWidth: 400 }}>
            
            {/* Avatar Player */}
            <div style={{ flexShrink: 0 }}>
              <AvatarSelector
                content={avatarSpeech || content}
                subject={subject}
                lesson={lesson}
                topic={topic}
                level={level}
                speechReady={speechReady}
                onSentenceChange={handleSentenceChange}
                paragraphCount={contentParas.length}
                answerContent={avatarAnswer || undefined}
                onAnswerSpoken={() => setAvatarAnswer("")}
                onPauseChange={(isPaused) => {
                  takingNotesRef.current = isPaused;
                  setTakingNotes(isPaused);
                }}
              />
            </div>

            {/* Lesson Details & Engagement */}
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Title and Level */}
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                  <span style={{
                    backgroundColor: lc.bg, color: lc.color,
                    border: `1px solid ${lc.border}`,
                    padding: "4px 12px", borderRadius: 100,
                    fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
                  }}>
                    {level}
                  </span>
                  <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: 600 }}>{lesson}</span>
                </div>
                <h1 style={{ fontSize: 28, fontWeight: 700, color: "#f1f5f9", margin: 0, lineHeight: 1.2 }}>
                  {topic}
                </h1>
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
                {/* YouTube button */}
                <button
                  onClick={() => setYoutubeOpen(true)}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    background: "rgba(255,0,0,0.1)", border: "1px solid rgba(255,0,0,0.2)",
                    borderRadius: 100, padding: "8px 16px",
                    color: "#fca5a5", fontSize: 13, fontWeight: 600,
                    cursor: "pointer", transition: "all 0.2s"
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,0,0,0.15)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,0,0,0.1)"; }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
                  </svg>
                  Search on Youtube
                </button>

                {/* Expanded Engagement Details */}
                {(() => {
                  const scoreColor = engScore === null ? "#94a3b8" : engScore >= 75 ? "#22c55e" : engScore >= 50 ? "#f59e0b" : "#ef4444";
                  
                  let advice = "Great focus, keep it up!";
                  if (takingNotes) advice = "Taking notes — tracking paused.";
                  else if (engPhoneDetected) advice = "Please remove mobile while lesson.";
                  else if (engAlert) advice = "Please pay attention.";
                  else if (engScore !== null && engScore < 75) advice = "Try to stay a bit more focused.";

                  return (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: engConnected ? "#22c55e" : "#94a3b8" }} />
                        <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: 600 }}>Engagement:</span>
                        <span style={{ color: scoreColor, fontWeight: 800, fontSize: 16 }}>
                          {engScore !== null ? `${engScore}%` : "—"}
                        </span>
                        {engEmotion && <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginLeft: 4 }}>({engEmotion})</span>}
                      </div>
                      {engConnected && (
                        <span style={{ color: (engAlert || engPhoneDetected) ? "#f87171" : "#93c5fd", fontSize: 12, fontWeight: 500 }}>
                          {advice}
                        </span>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* ── RIGHT COLUMN (1/3) ── */}
          <div style={{ flex: 1, minWidth: 320, display: "flex", flexDirection: "column", position: "relative", zIndex: 1 }}>
            
            {/* Tabs */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: 8, flexShrink: 0 }}>
              <button
                onClick={() => setActiveTab("note")}
                style={{
                  background: activeTab === "note" ? "rgba(255,255,255,0.1)" : "transparent",
                  color: activeTab === "note" ? "white" : "rgba(255,255,255,0.5)",
                  border: "none", padding: "8px 16px", borderRadius: 8,
                  fontSize: 14, fontWeight: 600, cursor: "pointer", transition: "all 0.2s"
                }}
              >
                Note
              </button>
              <button
                onClick={() => setActiveTab("content")}
                style={{
                  background: activeTab === "content" ? "rgba(255,255,255,0.1)" : "transparent",
                  color: activeTab === "content" ? "white" : "rgba(255,255,255,0.5)",
                  border: "none", padding: "8px 16px", borderRadius: 8,
                  fontSize: 14, fontWeight: 600, cursor: "pointer", transition: "all 0.2s"
                }}
              >
                Course Content
              </button>
              <button
                onClick={() => setActiveTab("assistant")}
                style={{
                  background: activeTab === "assistant" ? "rgba(255,255,255,0.1)" : "transparent",
                  color: activeTab === "assistant" ? "white" : "rgba(255,255,255,0.5)",
                  border: "none", padding: "8px 16px", borderRadius: 8,
                  fontSize: 14, fontWeight: 600, cursor: "pointer", transition: "all 0.2s"
                }}
              >
                AI Assistant
              </button>
            </div>

            {/* Tab Content */}
            <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "thin", paddingRight: 8 }}>
              
              {activeTab === "note" && (
                <div style={{
                  backgroundColor: "white", borderRadius: 20,
                  overflow: "hidden", border: `1.5px solid ${accent}40`,
                  boxShadow: `0 8px 40px rgba(0,0,0,0.09)`,
                }}>
                  <div style={{ padding: "24px 32px", background: "white" }}>
                    {content ? (
                      <div>{renderContentWithImages(displayContent)}</div>
                    ) : (
                      <div style={{ textAlign: "center", padding: "40px 0" }}>
                        <div style={{ width: 40, height: 40, border: `3px solid ${accent}20`, borderTop: `3px solid ${accent}`, borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 16px" }} />
                        <p style={{ color: NAVY, fontWeight: 600, fontSize: 14, margin: "0 0 4px" }}>Loading Note...</p>
                      </div>
                    )}
                  </div>
                  
                  {/* Note Footer CTA */}
                  {content && (
                    <div style={{
                      padding: "16px 24px", borderTop: "1px solid #f1f5f9",
                      background: `linear-gradient(135deg, ${accent}06 0%, #f8fafc 100%)`,
                      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                    }}>
                      <p style={{ margin: 0, fontSize: 12, color: "#64748b", fontWeight: 500 }}>
                        {isReview ? "Test yourself?" : "Finished reading?"}
                      </p>
                      <button
                        onClick={() => router.push(`/quiz?topic=${topic}&level=${level}&type=${isReview ? 'practice' : 'post'}&subject=${subject}&lesson=${lesson}`)}
                        style={{
                          padding: "8px 16px", background: `linear-gradient(135deg, ${cfg.dark}, ${accent})`,
                          color: "white", border: "none", borderRadius: 8,
                          fontSize: 12, fontWeight: 700, cursor: "pointer"
                        }}
                      >
                        {isReview ? "Practice Quiz" : "Take Quiz"}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "content" && (
                <div style={{
                  backgroundColor: "white", borderRadius: 20, padding: 24,
                  border: `1.5px solid ${accent}40`,
                }}>
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: NAVY }}>Course Progress</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: accent }}>
                        {completedTopics.size} / {(subjectData?.lessons || []).reduce((acc, l) => acc + (l.topics || []).length, 0)} Topics
                      </span>
                    </div>
                    <div style={{ height: 6, background: "#f1f5f9", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{
                        height: "100%", background: `linear-gradient(90deg, ${accent}, ${cfg.dark})`,
                        width: `${(() => {
                          const total = (subjectData?.lessons || []).reduce((acc, l) => acc + (l.topics || []).length, 0);
                          return total ? (completedTopics.size / total) * 100 : 0;
                        })()}%`,
                        borderRadius: 4, transition: "width 0.5s ease"
                      }} />
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {(subjectData?.lessons || []).map((l, idx) => {
                      const lessonTopics = l.topics || [];
                      const completedInLesson = lessonTopics.filter(t => completedTopics.has(`${l.name}|${t}`)).length;
                      const isExpanded = expandedLesson === l.name;
                      
                      return (
                        <div key={idx} style={{
                          border: `1px solid ${isExpanded ? accent : "#e2e8f0"}`,
                          borderRadius: 12, overflow: "hidden",
                          background: isExpanded ? `${accent}08` : "white",
                        }}>
                          <button
                            onClick={() => setExpandedLesson(isExpanded ? null : l.name)}
                            style={{
                              width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                              padding: "14px 16px", background: "transparent", border: "none", cursor: "pointer",
                              textAlign: "left"
                            }}
                          >
                            <div>
                              <div style={{ fontSize: 14, fontWeight: 700, color: NAVY }}>{l.name}</div>
                              <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
                                {completedInLesson} / {lessonTopics.length} Topics
                              </div>
                            </div>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
                              <path d="M6 9l6 6 6-6" stroke={NAVY} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                          
                          {isExpanded && (
                            <div style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
                              {lessonTopics.map((t, i) => {
                                const isCompleted = completedTopics.has(`${l.name}|${t}`);
                                const isCurrent = l.name === lesson && t === topic;
                                return (
                                  <div key={i} style={{
                                    display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                                    borderRadius: 8, background: isCurrent ? `${accent}15` : isCompleted ? "#f8fafc" : "transparent",
                                    border: `1px solid ${isCurrent ? accent : isCompleted ? "#e2e8f0" : "transparent"}`,
                                  }}>
                                    <div style={{
                                      width: 18, height: 18, borderRadius: 5,
                                      background: isCompleted ? accent : "white",
                                      border: `2px solid ${isCompleted ? accent : "#cbd5e1"}`,
                                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                                    }}>
                                      {isCompleted && (
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                                          <path d="M20 6L9 17l-5-5" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                      )}
                                    </div>
                                    <span style={{
                                      fontSize: 13, fontWeight: isCurrent ? 700 : 500,
                                      color: isCurrent ? accent : isCompleted ? "#64748b" : NAVY,
                                      textDecoration: isCompleted && !isCurrent ? "line-through" : "none"
                                    }}>
                                      {t}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {activeTab === "assistant" && (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "calc(100vh - 200px)" }}>
                  <ChatBot 
                    subject={subject} lesson={lesson} topic={topic} accent={accent} inline={true} 
                    onHearAvatar={setAvatarAnswer}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

      </main>


      {youtubeOpen && (
        <YouTubePanel
          subject={subject}
          lesson={lesson}
          topic={topic}
          accent={accent}
          onClose={() => setYoutubeOpen(false)}
        />
      )}
    </div>
  );
}

export default function LessonPage() {
  return (
    <Suspense fallback={null}>
      <LessonPageContent />
    </Suspense>
  );
}