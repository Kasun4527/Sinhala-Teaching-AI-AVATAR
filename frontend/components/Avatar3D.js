"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import dynamic from "next/dynamic";

// ── R3F imports (client-only) ──────────────────────────────────────────────
// Loaded dynamically so Next.js SSR never tries to import Three.js on the server.
const Avatar3DCanvas = dynamic(() => import("./Avatar3DCanvas"), { ssr: false });

/**
 * Drop-in replacement for AvatarTeacher that renders the full-body 3D avatar.
 * Accepts the same key props: content, topic, speechReady, answerContent, onAnswerSpoken.
 */
export default function Avatar3D({ content, topic, speechReady = true, answerContent, onAnswerSpoken, onSentenceChange }) {
  const audioRef    = useRef(null);
  const timelineRef = useRef([]);
  const avatarRef   = useRef(null);
  const segmentsRef = useRef([]);   // [{text, start, end}, ...]
  const lastSegRef  = useRef(-1);   // last segment index fired

  const [speaking, setSpeaking]   = useState(false);
  const [status,   setStatus]     = useState("");
  const [error,    setError]      = useState("");

  const activeContent = answerContent || content;

  // When answerContent arrives restart speech
  useEffect(() => {
    if (!answerContent) return;
    handleStop();
    setTimeout(() => handleSpeak(answerContent), 300);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answerContent]);

  const handleSpeak = useCallback(async (text) => {
    const speechText = (text || activeContent || "")
      .replace(/\[IMAGE:[^\]]+\]/gi, "")
      .trim()
      .slice(0, 3000);

    if (!speechText || speaking) return;
    setError("");
    setStatus("Generating speech…");

    try {
      const res = await fetch("/api/generate-tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: speechText }),
      });
      if (!res.ok) {
        const msg = await res.json().catch(() => ({}));
        throw new Error(msg.detail || `TTS failed (${res.status})`);
      }
      const { audio, timeline, segments } = await res.json();
      timelineRef.current = timeline || [];
      lastSegRef.current  = -1;

      const bytes = Uint8Array.from(atob(audio), (c) => c.charCodeAt(0));
      const blob  = new Blob([bytes], { type: "audio/wav" });
      const url   = URL.createObjectURL(blob);

      const audioEl = audioRef.current;
      audioEl.src = url;

      // Use requestAnimationFrame at ~60fps to push currentTime/duration (0→1)
      // directly as progress. Linear time → paragraph is more reliable than
      // trying to map Whisper sentence indices to display paragraphs.
      let rafId = null;
      let lastProgress = -1;
      const trackProgress = () => {
        if (onSentenceChange && audioEl.duration > 0) {
          const progress = audioEl.currentTime / audioEl.duration;
          // Only fire when progress changes by at least 0.5% to avoid jitter
          if (Math.abs(progress - lastProgress) >= 0.005) {
            lastProgress = progress;
            onSentenceChange(progress);
          }
        }
        rafId = requestAnimationFrame(trackProgress);
      };

      audioEl.onplay = () => {
        setSpeaking(true);
        setStatus("Speaking…");
        lastProgress = -1;
        rafId = requestAnimationFrame(trackProgress);
      };
      const stopRaf = () => { if (rafId) { cancelAnimationFrame(rafId); rafId = null; } };

      audioEl.onended = () => {
        stopRaf();
        setSpeaking(false);
        setStatus("");
        lastSegRef.current = -1;
        if (onSentenceChange) onSentenceChange(-1);
        if (answerContent && onAnswerSpoken) onAnswerSpoken();
      };
      audioEl.onpause = () => stopRaf();
      audioEl.onerror = () => { stopRaf(); setSpeaking(false); setStatus(""); };

      setStatus("Starting…");
      await audioEl.play();
    } catch (err) {
      console.error("Avatar3D speak:", err);
      setError(err.message || "Speech failed");
      setStatus("");
      setSpeaking(false);
    }
  }, [activeContent, speaking, answerContent, onAnswerSpoken]);

  const handleStop = useCallback(() => {
    const el = audioRef.current;
    if (el) { el.onpause = null; el.pause(); el.src = ""; }
    avatarRef.current?.stopImmediately();
    setSpeaking(false);
    setStatus("");
    lastSegRef.current = -1;
    if (onSentenceChange) onSentenceChange(-1);
  }, [onSentenceChange]);

  const canSpeak = speechReady && !!activeContent && !speaking;

  return (
    <div style={{ backgroundColor: "#0f172a", borderRadius: 16, overflow: "hidden", marginBottom: 24, border: "1px solid #1e293b" }}>
      {/* 3D Canvas */}
      <div style={{ position: "relative", background: "#0f172a", height: 380 }}>
        <Avatar3DCanvas
          avatarRef={avatarRef}
          audioRef={audioRef}
          timelineRef={timelineRef}
          speaking={speaking}
        />

        {/* LIVE badge */}
        {speaking && (
          <div style={{
            position: "absolute", top: 12, left: 12,
            display: "flex", alignItems: "center", gap: 6,
            backgroundColor: "rgba(0,0,0,0.6)", padding: "4px 10px", borderRadius: 20,
          }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#22c55e", animation: "pulse3d 1.5s ease-in-out infinite" }} />
            <span style={{ color: "white", fontSize: 11, fontWeight: 600 }}>LIVE</span>
          </div>
        )}

        {/* Idle placeholder overlay */}
        {!speaking && status === "" && (
          <div style={{
            position: "absolute", bottom: 12, left: 0, right: 0,
            display: "flex", justifyContent: "center",
          }}>
            <span style={{ color: "rgba(148,163,184,0.6)", fontSize: 12 }}>
              Click ▶ Teacher Explain to start
            </span>
          </div>
        )}
      </div>

      {/* Hidden audio element */}
      <audio ref={audioRef} style={{ display: "none" }} />

      {/* Controls */}
      <div style={{
        padding: "12px 16px", display: "flex", alignItems: "center",
        justifyContent: "space-between", borderTop: "1px solid #1e293b",
      }}>
        <span style={{ color: "#64748b", fontSize: 12 }}>{topic}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {status && <span style={{ color: "#94a3b8", fontSize: 12 }}>{status}</span>}
          {speaking ? (
            <button onClick={handleStop} style={{
              backgroundColor: "#ef4444", color: "white", border: "none",
              borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}>■ Stop</button>
          ) : (
            <button
              onClick={() => handleSpeak()}
              disabled={!canSpeak}
              style={{
                backgroundColor: canSpeak ? "#3b82f6" : "#334155",
                color: "white", border: "none", borderRadius: 8,
                padding: "8px 16px", fontSize: 13, fontWeight: 600,
                cursor: canSpeak ? "pointer" : "not-allowed", opacity: canSpeak ? 1 : 0.7,
              }}
            >
              {!speechReady ? "Preparing…" : "▶ Teacher Explain"}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div style={{ padding: "8px 16px", backgroundColor: "#450a0a", color: "#fca5a5", fontSize: 12 }}>
          {error}
        </div>
      )}

      <style>{`
        @keyframes pulse3d { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
      `}</style>
    </div>
  );
}
