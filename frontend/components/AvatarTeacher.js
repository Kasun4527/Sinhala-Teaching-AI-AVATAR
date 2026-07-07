"use client";

import { useEffect, useRef, useState } from "react";

const AVTR_HOST = "https://stifle-implement-feminist.ngrok-free.dev";
const NGROK_HDR = { "ngrok-skip-browser-warning": "1" };
const WPM = 130; // average speaking pace

function splitSentences(text) {
  if (!text) return [];
  return text
    .replace(/\[IMAGE:[^\]]+\]/gi, "")
    .split(/(?<=[.!?।])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 4);
}

export default function AvatarTeacher({ content, topic, speechReady = true, onSentenceChange, answerContent, onAnswerSpoken }) {
  const videoRef  = useRef(null);
  const pcRef     = useRef(null);
  const timerRef  = useRef(null);

  const [status, setStatus]                 = useState("idle");
  const [error, setError]                   = useState("");
  const [avatarList, setAvatarList]         = useState([]);
  const [bgList, setBgList]                 = useState([]);
  const [selectedAvatar, setSelectedAvatar] = useState("");
  const [selectedBg, setSelectedBg]         = useState("");
  const [activeSentence, setActiveSentence] = useState(-1);

  const activeContent = answerContent || content;
  const sentences = splitSentences(activeContent);

  // When answerContent arrives, stop current session and start new one
  useEffect(() => {
    if (!answerContent) return;
    stopSession();
    setTimeout(() => startSession(), 400);
  }, [answerContent]);

  useEffect(() => {
    fetch(`${AVTR_HOST}/avatars`, { headers: NGROK_HDR })
      .then(r => r.json())
      .then(data => {
        const avatars = Array.isArray(data.avatars) ? data.avatars : [];
        const bgs     = Array.isArray(data.backgrounds) ? data.backgrounds : [];
        setAvatarList(avatars);
        setBgList(bgs);
        if (avatars.length > 0) setSelectedAvatar(avatars[0]);
        if (bgs.length > 0)     setSelectedBg(bgs[0]);
      })
      .catch(() => {});
  }, []);

  // Notify parent of speech progress (0..1)
  useEffect(() => {
    if (onSentenceChange && activeSentence >= 0 && sentences.length > 0) {
      const progress = activeSentence / sentences.length;
      onSentenceChange(progress);
    }
  }, [activeSentence]);

  async function waitForIceComplete(pc, ms = 8000) {
    if (pc.iceGatheringState === "complete") return;
    return new Promise(resolve => {
      const timer = setTimeout(resolve, ms);
      pc.addEventListener("icegatheringstatechange", () => {
        if (pc.iceGatheringState === "complete") { clearTimeout(timer); resolve(); }
      });
    });
  }

  function startSentenceTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
    let idx = 0;
    setActiveSentence(0);

    timerRef.current = setInterval(() => {
      if (idx >= sentences.length - 1) {
        clearInterval(timerRef.current);
        return;
      }
      const wordCount = (sentences[idx]?.split(/\s+/).length || 5);
      const durationMs = (wordCount / WPM) * 60 * 1000;

      setTimeout(() => {
        idx++;
        setActiveSentence(idx);
      }, durationMs);
    }, 100);

    // Better approach: schedule each sentence transition upfront
    clearInterval(timerRef.current);
    let elapsed = 0;
    sentences.forEach((s, i) => {
      const wordCount = s.split(/\s+/).length || 5;
      const durationMs = (wordCount / WPM) * 60 * 1000;
      setTimeout(() => setActiveSentence(i), elapsed);
      elapsed += durationMs;
    });
  }

  async function startSession() {
    try {
      setError("");
      setStatus("connecting");

      const iceResp = await fetch(`${AVTR_HOST}/ice-servers`, { headers: NGROK_HDR });
      if (!iceResp.ok) throw new Error("Failed to get ICE servers");
      const iceCfg = await iceResp.json();

      const pc = new RTCPeerConnection({
        iceServers: iceCfg.iceServers || [],
        iceTransportPolicy: iceCfg.iceTransportPolicy || "all",
      });
      pcRef.current = pc;

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

      const speechText = activeContent
        .replace(/\[IMAGE:[^\]]+\]/gi, "")
        .trim()
        .slice(0, 5000);

      const body = {
        sdp:           pc.localDescription.sdp,
        type:          "offer",
        avatar_id:     selectedAvatar,
        background_id: selectedBg,
        engine: {
          type:    "custom",
          content: speechText,
          topic:   topic || "",
        },
      };

      const answerResp = await fetch(`${AVTR_HOST}/offer`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...NGROK_HDR },
        body: JSON.stringify(body),
      });
      if (!answerResp.ok) {
        const txt = await answerResp.text().catch(() => "");
        throw new Error(`Offer rejected (${answerResp.status}): ${txt}`);
      }
      const answer = await answerResp.json();
      await pc.setRemoteDescription(answer);

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
          setStatus("idle");
          setActiveSentence(-1);
        }
      };

      setStatus("live");
      // Small delay to let avatar start speaking before highlighting
      setTimeout(() => startSentenceTimer(), 1200);

    } catch (err) {
      console.error("AvatarTeacher:", err);
      setError(err.message || "Connection failed");
      setStatus("error");
    }
  }

  function stopSession() {
    if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
    if (videoRef.current) videoRef.current.srcObject = null;
    if (timerRef.current) clearInterval(timerRef.current);
    setStatus("idle");
    setActiveSentence(-1);
  }

  const isLive = status === "live";
  const isBusy = status === "connecting";

  return (
    <div style={{
      backgroundColor: "#0f172a", borderRadius: 16,
      overflow: "hidden", marginBottom: 24,
      border: "1px solid #1e293b",
    }}>
      {/* Video area */}
      <div style={{ position: "relative", background: "#000", minHeight: 340 }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          controls
          style={{
            width: "100%", height: 340, objectFit: "cover",
            display: isLive ? "block" : "none",
          }}
        />

        {!isLive && (
          <div style={{
            height: 340, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 12,
          }}>
            <div style={{ fontSize: 56 }}>👩‍🏫</div>
            <p style={{ color: "#64748b", fontSize: 13 }}>
              {isBusy ? "Connecting to avatar teacher..." : "Click below to start teacher explanation"}
            </p>
            {isBusy && (
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                border: "3px solid #1e293b",
                borderTop: "3px solid #3b82f6",
                animation: "spin 0.8s linear infinite",
              }} />
            )}
          </div>
        )}

        {isLive && (
          <div style={{
            position: "absolute", top: 12, left: 12,
            display: "flex", alignItems: "center", gap: 6,
            backgroundColor: "rgba(0,0,0,0.6)",
            padding: "4px 10px", borderRadius: 20,
          }}>
            <div style={{
              width: 8, height: 8, borderRadius: "50%",
              backgroundColor: "#22c55e",
              animation: "pulse 1.5s ease-in-out infinite",
            }} />
            <span style={{ color: "white", fontSize: 11, fontWeight: 600 }}>LIVE</span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={{
        padding: "12px 16px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        borderTop: "1px solid #1e293b",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {!isLive && avatarList.length > 1 && (
            <select
              value={selectedAvatar}
              onChange={e => setSelectedAvatar(e.target.value)}
              style={{
                backgroundColor: "#1e293b", color: "#94a3b8",
                border: "1px solid #334155", borderRadius: 8,
                padding: "5px 8px", fontSize: 12,
              }}
            >
              {avatarList.map((a, i) => <option key={i} value={a}>{a}</option>)}
            </select>
          )}
          {!isLive && bgList.length > 1 && (
            <select
              value={selectedBg}
              onChange={e => setSelectedBg(e.target.value)}
              style={{
                backgroundColor: "#1e293b", color: "#94a3b8",
                border: "1px solid #334155", borderRadius: 8,
                padding: "5px 8px", fontSize: 12,
              }}
            >
              {bgList.map((b, i) => <option key={i} value={b}>{b}</option>)}
            </select>
          )}
          <span style={{ color: "#64748b", fontSize: 12 }}>{topic}</span>
        </div>

        <div>
          {isLive ? (
            <button onClick={stopSession} style={{
              backgroundColor: "#ef4444", color: "white",
              border: "none", borderRadius: 8,
              padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}>
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
        <div style={{
          padding: "8px 16px", backgroundColor: "#450a0a",
          color: "#fca5a5", fontSize: 12,
        }}>
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
