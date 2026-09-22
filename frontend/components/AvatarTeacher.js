"use client";

import { useEffect, useRef, useState } from "react";

const AVTR_HOST = process.env.NEXT_PUBLIC_AVTR_HOST || "https://stifle-implement-feminist.ngrok-free.dev";
const BACKEND   = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
const NGROK_HDR = { "ngrok-skip-browser-warning": "1" };

// Preferred MediaRecorder mime types for recording the AVTR-1 stream,
// in order of preference — the browser is asked for the first one it
// actually supports.
const RECORDER_MIME_CANDIDATES = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
];

function pickRecorderMimeType() {
  if (typeof MediaRecorder === "undefined") return "";
  for (const type of RECORDER_MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return "";
}

const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5];

// Only these avatars (from the renderer's full character list) are shown
// to students, with "kate" preferred as the default when available.
const FEMALE_AVATARS = ["camila", "caroline", "clara", "elena", "kate", "maria", "may", "olivia"];
const DEFAULT_AVATAR = "kate";

export default function AvatarTeacher({ content, subject, lesson, topic, level, speechReady = true, onSentenceChange, paragraphCount = 1, answerContent, onAnswerSpoken, onPauseChange }) {
  const videoRef    = useRef(null);
  const pcRef       = useRef(null);
  const channelRef  = useRef(null);

  // AVTR-1 video cache — recording of the live WebRTC stream, uploaded once
  // per (subject, lesson, topic, level) and replayed for every later
  // student who reaches the same combination instead of a fresh live
  // session. Only applies to the primary lesson narration, never Q&A
  // answer playback (answerContent), which is one-off per student.
  const recorderRef       = useRef(null);
  const recordedChunksRef = useRef([]);
  const recordingMetaRef  = useRef(null);

  const [status, setStatus]                 = useState("idle");
  const [error,  setError]                  = useState("");
  const [avatarList, setAvatarList]         = useState([]);
  const [bgList, setBgList]                 = useState([]);
  const [selectedAvatar, setSelectedAvatar] = useState("");
  const [selectedBg, setSelectedBg]         = useState("");
  const [speed, setSpeed]                   = useState(1);
  const [paused, setPaused]                 = useState(false);
  const [isCachedPlayback, setIsCachedPlayback] = useState(false);

  const activeContent = answerContent || content;
  const cacheKeyReady = !!(subject && lesson && topic && level);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearHighlight();
      stopRecording({ discard: true });
      if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
      if (videoRef.current) { videoRef.current.srcObject = null; }
    };
  }, []);

  // When answerContent arrives, restart
  useEffect(() => {
    if (!answerContent) return;
    stopSession();
    setTimeout(() => startSession(), 1500);
  }, [answerContent]);

  useEffect(() => {
    fetch(`${AVTR_HOST}/avatars`, { headers: NGROK_HDR })
      .then(r => r.json())
      .then(data => {
        const allAvatars = Array.isArray(data.avatars) ? data.avatars : [];
        const avatars = allAvatars.filter(a => FEMALE_AVATARS.includes(a));
        const bgs     = Array.isArray(data.backgrounds) ? data.backgrounds : [];
        setAvatarList(avatars);
        setBgList(bgs);
        if (avatars.length > 0) {
          setSelectedAvatar(avatars.includes(DEFAULT_AVATAR) ? DEFAULT_AVATAR : avatars[0]);
        }
        if (bgs.length > 0)     setSelectedBg(bgs[0]);
      })
      .catch(() => {});
  }, []);

  function clearHighlight() {
    if (onSentenceChange) onSentenceChange(-1);
  }

  // Real playback timing from the avatar server — no estimation. The
  // browser (as WebRTC offerer) must create this channel itself, BEFORE
  // createOffer(), so the SDP negotiates an SCTP transport for it — the
  // server then sends on this same channel via aiortc's "datachannel"
  // event rather than trying to create its own after negotiation.
  function handleAvatarEvent(pc, paragraphCountForSession) {
    const channel = pc.createDataChannel("events");
    channelRef.current = channel;
    channel.onopen  = () => console.log("[AVTR-1] events channel OPEN, readyState:", channel.readyState);
    channel.onclose = () => console.log("[AVTR-1] events channel CLOSED");
    channel.onerror = (e) => console.error("[AVTR-1] events channel ERROR:", e);
    channel.onmessage = (msg) => {
      console.log("[AVTR-1] events channel message:", msg.data);
      let data;
      try {
        data = JSON.parse(msg.data);
      } catch {
        return;
      }
      if (data.type === "avatar.speech.playback.segment_started") {
        if (onSentenceChange) onSentenceChange(data.para_index);
      } else if (data.type === "avatar.speech.playback.segment_completed") {
        if (data.para_index === paragraphCountForSession - 1) {
          clearHighlight();
          if (answerContent && onAnswerSpoken) onAnswerSpoken();
          // Narration finished — this is the natural point to stop
          // recording and upload it as the AVTR-1 cache for this topic.
          stopRecording();
        }
      }
    };
  }

  // Starts recording the live avatar stream so it can be cached for future
  // students. Never called for Q&A answer playback (answerContent) or when
  // the cache key is incomplete — see cacheKeyReady.
  function startRecording(stream) {
    if (answerContent || !cacheKeyReady) return;
    const mimeType = pickRecorderMimeType();
    if (!mimeType) return; // MediaRecorder unsupported — live session still works, just isn't cached
    try {
      const recorder = new MediaRecorder(stream, { mimeType });
      recordedChunksRef.current = [];
      recordingMetaRef.current = { subject, lesson, topic, level };
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      recorder.onstop = () => uploadRecording(mimeType);
      recorder.start();
      recorderRef.current = recorder;
    } catch (err) {
      console.error("[AVTR-1] recording failed to start:", err);
    }
  }

  // Stops the in-progress recording. discard=true is used when a session
  // ends early (user clicks Stop, error, unmount) — an incomplete
  // recording is never uploaded as "the" cached video for a topic.
  function stopRecording({ discard = false } = {}) {
    const recorder = recorderRef.current;
    if (!recorder) return;
    recorderRef.current = null;
    if (discard) {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      recordedChunksRef.current = [];
      recordingMetaRef.current = null;
    }
    try { recorder.stop(); } catch { /* already stopped */ }
  }

  async function uploadRecording(mimeType) {
    const meta = recordingMetaRef.current;
    const chunks = recordedChunksRef.current;
    recordedChunksRef.current = [];
    recordingMetaRef.current = null;
    if (!meta || !chunks.length) return;
    try {
      const blob = new Blob(chunks, { type: mimeType || "video/webm" });
      const form = new FormData();
      form.append("subject", meta.subject);
      form.append("lesson", meta.lesson);
      form.append("topic", meta.topic);
      form.append("level", meta.level);
      form.append("file", blob, "session.webm");
      await fetch(`${BACKEND}/avtr-cache/upload`, { method: "POST", body: form });
      console.log("[AVTR-1] cached video uploaded:", meta);
    } catch (err) {
      console.error("[AVTR-1] cache upload failed:", err);
    }
  }

  function splitParagraphs(text) {
    const clean = text.replace(/\[IMAGE:[^\]]+\]/gi, "").trim();
    const byBlank = clean.split(/\n\s*\n/).map(s => s.replace(/\n/g, " ").trim()).filter(s => s.length > 10);
    if (byBlank.length > 1) return byBlank;
    const byLine = clean.split(/\n/).map(s => s.trim()).filter(s => s.length > 10);
    if (byLine.length > 1) return byLine;
    const chunks = [];
    let cur = "";
    for (const sent of clean.split(/(?<=[.!?।෴])\s+/)) {
      cur += (cur ? " " : "") + sent;
      if (cur.length >= 300) { chunks.push(cur.trim()); cur = ""; }
    }
    if (cur.trim()) chunks.push(cur.trim());
    return chunks.length ? chunks : [clean];
  }

  function sendCommand(command) {
    const channel = channelRef.current;
    if (channel && channel.readyState === "open") {
      channel.send(JSON.stringify(command));
    }
  }

  function changeSpeed(rate) {
    setSpeed(rate);
    // Only meaningful once a session is live — if not, this just sets the
    // rate that will be sent in the initial /offer payload next start.
    sendCommand({ command: "set_speed", rate });
  }

  function togglePause() {
    const next = !paused;
    setPaused(next);
    sendCommand({ command: next ? "pause" : "resume" });
    if (onPauseChange) onPauseChange(next);
  }

  async function waitForIceComplete(pc, ms = 8000) {
    if (pc.iceGatheringState === "complete") return;
    return new Promise(resolve => {
      const timer = setTimeout(resolve, ms);
      pc.addEventListener("icegatheringstatechange", () => {
        if (pc.iceGatheringState === "complete") { clearTimeout(timer); resolve(); }
      });
    });
  }

  async function startSession() {
    try {
      // Close any previous session first — the avatar server only allows
      // one session at a time, and nothing else guarantees the old
      // connection was closed before this (e.g. moving to a new topic
      // doesn't unmount/remount this component, and there's no effect that
      // auto-restarts on topic/content change). Without this, starting a
      // new session while the old one is still technically alive gets
      // rejected with "409 Another session is active".
      stopSession();

      setError("");
      setStatus("connecting");
      setPaused(false);
      setIsCachedPlayback(false);

      // AVTR-1 video cache — a combination that's already been recorded is
      // played back from a plain <video src>, skipping the live WebRTC
      // session (and the server's one-session-at-a-time slot) entirely.
      // Only checked for primary lesson narration; Q&A answer playback
      // (answerContent) is always a fresh live session.
      if (!answerContent && cacheKeyReady) {
        try {
          const params = new URLSearchParams({ subject, lesson, topic, level });
          const cacheResp = await fetch(`${BACKEND}/avtr-cache/check?${params.toString()}`);
          if (cacheResp.ok) {
            const cacheData = await cacheResp.json();
            if (cacheData.cached && cacheData.video_url && videoRef.current) {
              videoRef.current.srcObject = null;
              videoRef.current.src = `${BACKEND}${cacheData.video_url}`;
              setIsCachedPlayback(true);
              setStatus("live");
              return;
            }
          }
        } catch {
          // Cache lookup is best-effort — fall through to a live session.
        }
      }

      // stopSession()'s pc.close() only starts the WebRTC teardown on our
      // side — the server only notices via ICE consent-freshness checks,
      // which can take far longer than we're willing to wait here. Ask it
      // to end the previous session explicitly and wait for confirmation,
      // so the slot is guaranteed free before we send the new offer below
      // instead of racing WebRTC's own (much slower) disconnect detection.
      try {
        await fetch(`${AVTR_HOST}/end-session`, { method: "POST", headers: NGROK_HDR });
      } catch {
        // best-effort — if this fails, the 409 retry below is still there as a fallback
      }

      const speechText = activeContent
        .replace(/\[IMAGE:[^\]]+\]/gi, "")
        .trim()
        .slice(0, 8000);

      const paragraphs = splitParagraphs(speechText);

      const iceResp = await fetch(`${AVTR_HOST}/ice-servers`, { headers: NGROK_HDR });
      if (!iceResp.ok) throw new Error("Failed to get ICE servers");
      const iceCfg = await iceResp.json();

      const pc = new RTCPeerConnection({
        iceServers: iceCfg.iceServers || [],
        iceTransportPolicy: iceCfg.iceTransportPolicy || "all",
      });
      pcRef.current = pc;
      handleAvatarEvent(pc, paragraphs.length);

      pc.addTransceiver("video", { direction: "recvonly" });
      pc.addTransceiver("audio", { direction: "recvonly" });

      pc.ontrack = (e) => {
        if (e.streams && e.streams[0] && videoRef.current) {
          videoRef.current.srcObject = e.streams[0];
          // Cache this session for future students, if it qualifies (see
          // startRecording — no-op for Q&A answers or an incomplete key).
          if (!recorderRef.current) startRecording(e.streams[0]);
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await waitForIceComplete(pc);

      const offerBody = JSON.stringify({
        sdp:           pc.localDescription.sdp,
        type:          "offer",
        avatar_id:     selectedAvatar,
        background_id: selectedBg,
        engine: {
          type:    "custom",
          content: speechText,
          topic:   topic || "",
          speed,
        },
      });

      // stopSession()'s pc.close() above only *starts* the previous
      // session's WebRTC teardown — the avatar server needs a brief moment
      // to actually detect the closed connection and free its
      // one-session-at-a-time slot. Retry a few times on 409 instead of
      // failing immediately, since that race is normal and short-lived.
      let answerResp;
      const maxOfferAttempts = 5;
      for (let attempt = 1; attempt <= maxOfferAttempts; attempt++) {
        answerResp = await fetch(`${AVTR_HOST}/offer`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...NGROK_HDR },
          body: offerBody,
        });
        if (answerResp.status !== 409 || attempt === maxOfferAttempts) break;
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      if (!answerResp.ok) {
        const txt = await answerResp.text().catch(() => "");
        throw new Error(`Offer rejected (${answerResp.status}): ${txt}`);
      }
      const answer = await answerResp.json();
      await pc.setRemoteDescription(answer);

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
          clearHighlight();
          setStatus("idle");
        }
      };

      setStatus("live");
      console.log("[AVTR-1] paragraphs:", paragraphs.length, paragraphs.map(p => p.slice(0, 40)));

    } catch (err) {
      console.error("AvatarTeacher:", err);
      setError(err.message || "Connection failed");
      setStatus("error");
    }
  }

  function stopSession() {
    clearHighlight();
    // Stopping mid-session means an incomplete recording — never upload it
    // as "the" cached video for this topic.
    stopRecording({ discard: true });
    if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.removeAttribute("src");
    }
    channelRef.current = null;
    setPaused(false);
    setIsCachedPlayback(false);
    setStatus("idle");
  }

  const isLive = status === "live";
  const isBusy = status === "connecting";

  return (
    <div style={{ backgroundColor: "#0f172a", borderRadius: 16, overflow: "hidden", marginBottom: 24, border: "1px solid #1e293b" }}>
      <div style={{ position: "relative", background: "#000", aspectRatio: "16/9", display: "flex", flexDirection: "column", justifyContent: "center", overflow: "hidden" }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          controls={isCachedPlayback}
          onEnded={() => {
            if (isCachedPlayback) { clearHighlight(); setStatus("idle"); }
          }}
          style={{ width: "100%", height: "100%", objectFit: "contain", display: isLive ? "block" : "none" }}
        />

        {!isLive && (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
            <div style={{ fontSize: 56 }}>👩‍🏫</div>
            <p style={{ color: "#64748b", fontSize: 13 }}>
              {isBusy ? "Connecting to avatar teacher..." : "Click below to start teacher explanation"}
            </p>
            {isBusy && (
              <div style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid #1e293b", borderTop: "3px solid #3b82f6", animation: "spin 0.8s linear infinite" }} />
            )}
          </div>
        )}

        {isLive && (
          <div style={{ position: "absolute", top: 12, left: 12, display: "flex", alignItems: "center", gap: 6, backgroundColor: "rgba(0,0,0,0.6)", padding: "4px 10px", borderRadius: 20 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: isCachedPlayback ? "#3b82f6" : "#22c55e", animation: isCachedPlayback ? "none" : "pulse 1.5s ease-in-out infinite" }} />
            <span style={{ color: "white", fontSize: 11, fontWeight: 600 }}>{isCachedPlayback ? "RECORDED" : "LIVE"}</span>
          </div>
        )}
      </div>

      <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #1e293b" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {!isLive && avatarList.length > 0 && (
            <select value={selectedAvatar} onChange={e => setSelectedAvatar(e.target.value)} style={{ backgroundColor: "#1e293b", color: "#94a3b8", border: "1px solid #334155", borderRadius: 8, padding: "5px 8px", fontSize: 12 }}>
              {avatarList.map((a, i) => <option key={i} value={a}>{a}</option>)}
            </select>
          )}
          {!isLive && bgList.length > 0 && (
            <select value={selectedBg} onChange={e => setSelectedBg(e.target.value)} style={{ backgroundColor: "#1e293b", color: "#94a3b8", border: "1px solid #334155", borderRadius: 8, padding: "5px 8px", fontSize: 12 }}>
              {bgList.map((b, i) => <option key={i} value={b}>{b}</option>)}
            </select>
          )}

          {/* Speed selector — always visible so it can be set before starting too */}
          <div style={{ display: "flex", gap: 0, background: "#1e293b", borderRadius: 8, padding: 3 }}>
            {SPEED_OPTIONS.map((opt) => (
              <button
                key={opt}
                onClick={() => changeSpeed(opt)}
                style={{
                  padding: "4px 9px", borderRadius: 6, border: "none",
                  background: speed === opt ? "#3b82f6" : "transparent",
                  color: speed === opt ? "white" : "#94a3b8",
                  fontWeight: 600, fontSize: 11, cursor: "pointer",
                }}
              >
                {opt}x
              </button>
            ))}
          </div>

          {isLive && (
            <button
              onClick={togglePause}
              style={{
                backgroundColor: "#1e293b", color: "#e2e8f0", border: "1px solid #334155",
                borderRadius: 8, padding: "5px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer",
              }}
            >
              {paused ? "▶ Continue" : "📝 Taking Notes"}
            </button>
          )}

          <span style={{ color: "#64748b", fontSize: 12 }}>{topic}</span>
        </div>

        <div>
          {isLive ? (
            <button onClick={stopSession} style={{ backgroundColor: "#ef4444", color: "white", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              ■ Stop
            </button>
          ) : (
            <button
              onClick={startSession}
              disabled={isBusy || !content || !selectedAvatar || !selectedBg || !speechReady}
              style={{
                backgroundColor: (isBusy || !speechReady) ? "#334155" : "#3b82f6",
                color: "white", border: "none", borderRadius: 8,
                padding: "8px 16px", fontSize: 13, fontWeight: 600,
                cursor: (isBusy || !speechReady) ? "not-allowed" : "pointer",
                opacity: (isBusy || !speechReady) ? 0.7 : 1,
              }}
            >
              {isBusy ? "Connecting..." : !speechReady ? "Preparing..." : "▶ Teacher Explain"}
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
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
      `}</style>
    </div>
  );
}
