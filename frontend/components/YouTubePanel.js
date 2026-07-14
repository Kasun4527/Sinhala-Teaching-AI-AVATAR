"use client";

import { useEffect, useRef, useState } from "react";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

// Per-video watch cap. Lower this temporarily (e.g. 10) to test the
// auto-stop path quickly, then revert to 300 before shipping.
const CAP_SECONDS = 300;

// Shared across all mounts of this component so the IFrame API script is
// only ever injected once, even if the modal is opened/closed repeatedly.
let ytApiPromise = null;
function loadYouTubeIframeAPI() {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (ytApiPromise) return ytApiPromise;

  ytApiPromise = new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof previous === "function") previous();
      resolve(window.YT);
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    document.body.appendChild(script);
  });
  return ytApiPromise;
}

function formatTime(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export default function YouTubePanel({ subject = "", lesson = "", topic = "", accent = "#2563eb", onClose }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [elapsed, setElapsed] = useState(0);

  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const intervalRef = useRef(null);
  const selectedVideoRef = useRef(null);
  const startedAtRef = useRef(null);

  useEffect(() => {
    selectedVideoRef.current = selectedVideo;
  }, [selectedVideo]);

  const clearWatchInterval = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const logCurrentSession = async (forcedSeconds) => {
    const video = selectedVideoRef.current;
    const player = playerRef.current;
    if (!video || !player) return;

    let watched = forcedSeconds;
    if (watched === undefined) {
      try {
        watched = Math.floor(player.getCurrentTime());
      } catch {
        watched = 0;
      }
    }
    if (!watched || watched <= 0) return;

    try {
      await fetch(`${BACKEND}/youtube-log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: localStorage.getItem("student_id"),
          subject,
          lesson,
          topic,
          video_id: video.video_id,
          video_title: video.title,
          video_url: `https://www.youtube.com/watch?v=${video.video_id}`,
          watched_seconds: watched,
          started_at: startedAtRef.current || new Date().toISOString(),
        }),
      });
    } catch {
      // best-effort logging — don't block the UI on a failed log
    }
  };

  const handleStateChange = (event) => {
    const YT = window.YT;
    if (!YT) return;

    if (event.data === YT.PlayerState.PLAYING) {
      clearWatchInterval();
      intervalRef.current = setInterval(() => {
        const player = playerRef.current;
        if (!player || typeof player.getCurrentTime !== "function") return;
        const current = player.getCurrentTime();
        setElapsed(current);
        if (current >= CAP_SECONDS) {
          clearWatchInterval();
          player.stopVideo();
          logCurrentSession(CAP_SECONDS);
        }
      }, 1000);
    } else {
      clearWatchInterval();
      if (event.data === YT.PlayerState.ENDED) {
        logCurrentSession();
      }
    }
  };

  const playVideo = async (video) => {
    await logCurrentSession(); // flush whatever was playing before switching
    clearWatchInterval();
    setElapsed(0);
    setSelectedVideo(video);
    startedAtRef.current = new Date().toISOString();

    const YT = await loadYouTubeIframeAPI();
    if (!YT) return;

    if (playerRef.current && typeof playerRef.current.loadVideoById === "function") {
      playerRef.current.loadVideoById(video.video_id);
    } else {
      playerRef.current = new YT.Player(containerRef.current, {
        videoId: video.video_id,
        width: "100%",
        height: "360",
        playerVars: { autoplay: 1 },
        events: { onStateChange: handleStateChange },
      });
    }
  };

  const handleSearch = async () => {
    const q = query.trim();
    if (!q || loading) return;
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND}/youtube/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.results || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = async () => {
    clearWatchInterval();
    await logCurrentSession();
    if (playerRef.current && typeof playerRef.current.destroy === "function") {
      playerRef.current.destroy();
    }
    playerRef.current = null;
    onClose && onClose();
  };

  useEffect(() => {
    return () => {
      clearWatchInterval();
      logCurrentSession();
      if (playerRef.current && typeof playerRef.current.destroy === "function") {
        playerRef.current.destroy();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 2000,
        backgroundColor: "rgba(0,0,0,0.6)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div style={{
        width: "100%", maxWidth: 760,
        backgroundColor: "white", borderRadius: 20,
        overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        display: "flex", flexDirection: "column", maxHeight: "88vh",
      }}>
        {/* Header */}
        <div style={{
          backgroundColor: accent, padding: "16px 22px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>📺</span>
            <span style={{ color: "white", fontWeight: 700, fontSize: 16 }}>Watch a Video</span>
          </div>
          <button
            onClick={handleClose}
            style={{
              background: "rgba(255,255,255,0.2)", border: "none", borderRadius: 8,
              color: "white", width: 30, height: 30, cursor: "pointer", fontSize: 16,
            }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 22, overflowY: "auto" }}>
          {/* Search row */}
          <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
              placeholder="Search YouTube..."
              style={{
                flex: 1, padding: "10px 14px", borderRadius: 10,
                border: "1.5px solid #e2e8f0", fontSize: 14, outline: "none",
              }}
            />
            <button
              onClick={handleSearch}
              disabled={loading}
              style={{
                padding: "10px 20px", borderRadius: 10, border: "none",
                backgroundColor: accent, color: "white", fontWeight: 600,
                cursor: loading ? "default" : "pointer", opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? "Searching..." : "Search"}
            </button>
          </div>

          {/* Player */}
          {selectedVideo && (
            <div style={{ marginBottom: 18 }}>
              <div ref={containerRef} style={{ width: "100%", borderRadius: 12, overflow: "hidden", backgroundColor: "#000" }} />
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                marginTop: 8, fontSize: 13, color: "#64748b",
              }}>
                <span style={{ fontWeight: 600, color: "#1e293b" }}>{selectedVideo.title}</span>
                <span>{formatTime(elapsed)} / {formatTime(CAP_SECONDS)} limit</span>
              </div>
            </div>
          )}

          {/* Results grid */}
          {results.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 14 }}>
              {results.map((r) => (
                <div
                  key={r.video_id}
                  onClick={() => playVideo(r)}
                  style={{ cursor: "pointer", borderRadius: 10, overflow: "hidden", border: "1px solid #e2e8f0" }}
                >
                  <img src={r.thumbnail_url} alt={r.title} style={{ width: "100%", display: "block" }} />
                  <div style={{ padding: "8px 10px" }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: "#1e293b", lineHeight: 1.3 }}>
                      {r.title}
                    </div>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>{r.channel_title}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
