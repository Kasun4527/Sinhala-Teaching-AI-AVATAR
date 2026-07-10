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
      const { audio, timeline, audioChunks } = await res.json();
      timelineRef.current = timeline || [];

      console.log("[Avatar3D] audioChunks received:", audioChunks?.length, "onSentenceChange:", !!onSentenceChange);

      // Load full audio into the avatar canvas for lip-sync animation
      const fullBytes = Uint8Array.from(atob(audio), c => c.charCodeAt(0));
      const fullBlob  = new Blob([fullBytes], { type: "audio/wav" });
      const fullUrl   = URL.createObjectURL(fullBlob);

      // Pre-decode each paragraph chunk into an object URL
      const chunkUrls = (audioChunks || []).map(b64 => {
        const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
        return URL.createObjectURL(new Blob([bytes], { type: "audio/wav" }));
      });

      if (chunkUrls.length === 0) chunkUrls.push(fullUrl);
      console.log("[Avatar3D] chunkUrls:", chunkUrls.length);

      const audioEl = audioRef.current;
      audioEl.src   = fullUrl;
      audioEl.muted = true;

      setSpeaking(true);
      setStatus("Speaking…");

      audioEl.play().catch(() => {});

      // Play paragraph chunks one by one; highlight each paragraph before playing it
      const chunkPlayer = new Audio();
      let chunkIdx = 0;
      let stopped = false;

      const playNextChunk = () => {
        if (stopped || chunkIdx >= chunkUrls.length) {
          stopped = true;
          chunkPlayer.onended = null;
          chunkPlayer.onerror = null;
          chunkPlayer.src = "";
          if (audioEl) {
            audioEl.pause();
            audioEl.src   = "";
            audioEl.muted = false;
          }
          chunkUrls.forEach(u => URL.revokeObjectURL(u));
          if (fullUrl !== chunkUrls[0]) URL.revokeObjectURL(fullUrl);
          setSpeaking(false);
          setStatus("");
          console.log("[Avatar3D] all chunks done, clearing highlight");
          if (onSentenceChange) onSentenceChange(-1);
          if (answerContent && onAnswerSpoken) onAnswerSpoken();
          return;
        }
        console.log("[Avatar3D] playing chunk", chunkIdx, "→ highlight para", chunkIdx);
        if (onSentenceChange) onSentenceChange(chunkIdx);
        chunkPlayer.src = chunkUrls[chunkIdx];
        chunkPlayer.play().catch(e => console.error("[Avatar3D] chunk play error", e));
        chunkIdx++;
      };

      chunkPlayer.onended = playNextChunk;
      chunkPlayer.onerror = (e) => { console.error("[Avatar3D] chunkPlayer error", e); playNextChunk(); };

      // Store stopper so handleStop can abort
      audioEl._stopChunks = () => {
        stopped = true;
        chunkPlayer.pause();
        chunkPlayer.src = "";
        chunkUrls.forEach(u => URL.revokeObjectURL(u));
        if (fullUrl !== chunkUrls[0]) URL.revokeObjectURL(fullUrl);
      };

      playNextChunk();

    } catch (err) {
      console.error("Avatar3D speak:", err);
      setError(err.message || "Speech failed");
      setStatus("");
      setSpeaking(false);
    }
  }, [activeContent, speaking, answerContent, onAnswerSpoken, onSentenceChange]);

  const handleStop = useCallback(() => {
    const el = audioRef.current;
    if (el) {
      el._stopChunks?.();  // abort sequential chunk playback
      el._stopChunks = null;
      el.onpause = null;
      el.pause();
      el.src    = "";
      el.muted  = false;
    }
    avatarRef.current?.stopImmediately();
    setSpeaking(false);
    setStatus("");
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
