"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useMemo, Suspense } from "react";
import Sidebar from "@/components/Sidebar";
import AvatarSelector from "@/components/AvatarSelector";
import ChatBot from "@/components/ChatBot";
import YouTubePanel from "@/components/YouTubePanel";

const ENGAGEMENT_SERVER = process.env.NEXT_PUBLIC_ENGAGEMENT_URL || "http://localhost:5000";
const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

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
      speed: 0.18 + Math.random() * 0.32,
      opacity: 0.85 + Math.random() * 0.35,
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

  // Q&A state
  const [qaOpen, setQaOpen] = useState(false);
  const [youtubeOpen, setYoutubeOpen] = useState(false);
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

    const FRAME_INTERVAL_MS = 700;
    const MAX_TIMELINE_POINTS = 90; // ~60s of history at one frame per 700ms

    const applyStats = (current) => {
      if (!current) return;
      const score = current.score ?? 0;
      const state = current.state ?? "";
      const emotion = current.emotion ?? "";
      const phoneDetected = current.phone_detected ?? false;
      setEngScore(Math.round(score));
      setEngState(state);
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
        } catch (_) {}
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
          state: "Taking Notes 📝", score: 100,
          emotion: "Focused", emo_conf: 1.0, ear: 0.3, mar: 0.0,
          drowsy: false, yawning: false, head_direction: "Center",
          phone_detected: false, looking_away: false, person_present: true,
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
        video.play().catch(() => {});
        engVideoRef.current = video;
        engIntervalRef.current = setInterval(captureAndSend, FRAME_INTERVAL_MS);
      })
      .catch(() => {
        // No camera, or the student denied permission — degrade gracefully
        // instead of leaving the pill stuck on "Connecting...".
        setEngConnected(false);
        setEngState("Camera unavailable");
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
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", fontFamily: "'Source Sans 3', sans-serif" }}>
      <Sidebar subject={subject} />

      <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden", height: "100vh", background: "#f8fafc" }}>

        {/* ── Privacy Notice ── */}
        {showPrivacyNotice && (
          <div style={{
            background: "linear-gradient(90deg, #0f172a, #1e293b)", padding: "12px 52px",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
            borderBottom: "1px solid #334155", flexShrink: 0,
          }}>
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

        {/* ── HERO ── */}
        <div style={{
          position: "relative", overflow: "hidden", flexShrink: 0,
          background: `linear-gradient(145deg, ${NAVY} 0%, ${cfg.dark} 55%, ${accent} 100%)`,
          padding: "36px 52px 32px",
        }}>
          {/* Blueprint grid — matches dashboard */}
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none",
            backgroundImage: "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
            backgroundSize: "48px 48px" }} />
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none",
            backgroundImage: "linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)",
            backgroundSize: "12px 12px" }} />
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

                {/* YouTube video button */}
                <button
                  onClick={() => setYoutubeOpen(true)}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.14)",
                    borderRadius: 100, padding: "5px 14px",
                    color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  📺 Watch a Video
                </button>

                {/* Engagement inline pill */}
                {(() => {
                  const scoreColor = engScore === null ? "#94a3b8"
                    : engScore >= 75 ? "#22c55e"
                    : engScore >= 50 ? "#f59e0b"
                    : "#ef4444";
                  return (
                    <div style={{
                      display: "flex", alignItems: "center", gap: 8,
                      background: takingNotes ? "rgba(59,130,246,0.15)"
                        : (engAlert || engPhoneDetected) ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.08)",
                      border: `1px solid ${takingNotes ? "rgba(59,130,246,0.4)"
                        : (engAlert || engPhoneDetected) ? "rgba(239,68,68,0.4)" : "rgba(255,255,255,0.14)"}`,
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
                      {engPhoneDetected && (
                        <span style={{ color: "#f87171", fontSize: 11, fontWeight: 700, animation: "pulse 1s infinite" }}>
                          📱 Phone Detected
                        </span>
                      )}
                      {engAlert && !takingNotes && (
                        <span style={{ color: "#f87171", fontSize: 11, fontWeight: 700, animation: "pulse 1s infinite" }}>
                          ⚠ Low
                        </span>
                      )}
                      {takingNotes && (
                        <span style={{ color: "#60a5fa", fontSize: 11, fontWeight: 700 }}>
                          📝 Notes
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
          <FloatingPattern color={accent} />

          {/* Avatar column */}
          <div style={{ width: 400, flexShrink: 0, overflowY: "auto", scrollbarWidth: "none", position: "relative", zIndex: 1 }}>
            <AvatarSelector
              content={avatarSpeech || content}
              topic={topic}
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

          {/* Content column */}
          <div style={{ flex: 1, minWidth: 0, overflowY: "auto", scrollbarWidth: "thin", position: "relative", zIndex: 1 }}>

            {/* Content card */}
            <div style={{
              backgroundColor: "white", borderRadius: 22,
              marginBottom: 20, overflow: "hidden",
              border: `1.5px solid ${accent}40`,
              boxShadow: `0 8px 40px rgba(0,0,0,0.09)`,
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
              {content && !isReview && (
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

              {content && isReview && (
                <div style={{
                  padding: "16px 36px 20px",
                  borderTop: "1px solid #f1f5f9",
                  background: `linear-gradient(135deg, ${accent}06 0%, #f8fafc 100%)`,
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: `linear-gradient(135deg, ${cfg.dark}, ${accent})` }} />
                    <p style={{ margin: 0, fontSize: 13, color: "#64748b", fontWeight: 500 }}>
                      Reviewing past content — want to test yourself?
                    </p>
                  </div>
                  <button
                    onClick={() => router.push(`/quiz?topic=${topic}&level=${level}&type=practice&subject=${subject}&lesson=${lesson}`)}
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
                    Take a Practice Quiz
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