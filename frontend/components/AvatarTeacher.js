"use client";

import { useEffect, useRef, useState } from "react";

const AVTR_HOST = process.env.NEXT_PUBLIC_AVTR_HOST || "https://stifle-implement-feminist.ngrok-free.dev";
const NGROK_HDR = { "ngrok-skip-browser-warning": "1" };

const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5];

// Only these avatars (from the renderer's full character list) are shown
// to students, with "kate" preferred as the default when available.
const FEMALE_AVATARS = ["camila", "caroline", "clara", "elena", "kate", "maria", "may", "olivia"];
const DEFAULT_AVATAR = "kate";

export default function AvatarTeacher({ content, topic, speechReady = true, onSentenceChange, paragraphCount = 1, answerContent, onAnswerSpoken }) {
  const videoRef    = useRef(null);
  const pcRef       = useRef(null);
  const channelRef  = useRef(null);

  const [status, setStatus]                 = useState("idle");
  const [error,  setError]                  = useState("");
  const [avatarList, setAvatarList]         = useState([]);
  const [bgList, setBgList]                 = useState([]);
  const [selectedAvatar, setSelectedAvatar] = useState("");
  const [selectedBg, setSelectedBg]         = useState("");
  const [speed, setSpeed]                   = useState(1);
  const [paused, setPaused]                 = useState(false);

  const activeContent = answerContent || content;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearHighlight();
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
        }
      }
    };
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
      setError("");
      setStatus("connecting");
      setPaused(false);

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
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await waitForIceComplete(pc);

      const answerResp = await fetch(`${AVTR_HOST}/offer`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...NGROK_HDR },
        body: JSON.stringify({
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
        }),
      });
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
    if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
    if (videoRef.current) { videoRef.current.srcObject = null; }
    channelRef.current = null;
    setPaused(false);
    setStatus("idle");
  }

  const isLive = status === "live";
  const isBusy = status === "connecting";

  return (
    <div style={{ backgroundColor: "#0f172a", borderRadius: 16, overflow: "hidden", marginBottom: 24, border: "1px solid #1e293b" }}>
      <div style={{ position: "relative", background: "#000", minHeight: 340 }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          style={{ width: "100%", height: 340, objectFit: "cover", display: isLive ? "block" : "none" }}
        />

        {!isLive && (
          <div style={{ height: 340, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
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
            <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#22c55e", animation: "pulse 1.5s ease-in-out infinite" }} />
            <span style={{ color: "white", fontSize: 11, fontWeight: 600 }}>LIVE</span>
          </div>
        )}
      </div>

      <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #1e293b" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {!isLive && avatarList.length > 1 && (
            <select value={selectedAvatar} onChange={e => setSelectedAvatar(e.target.value)} style={{ backgroundColor: "#1e293b", color: "#94a3b8", border: "1px solid #334155", borderRadius: 8, padding: "5px 8px", fontSize: 12 }}>
              {avatarList.map((a, i) => <option key={i} value={a}>{a}</option>)}
            </select>
          )}
          {!isLive && bgList.length > 1 && (
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
              {paused ? "▶ Resume" : "⏸ Pause"}
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
