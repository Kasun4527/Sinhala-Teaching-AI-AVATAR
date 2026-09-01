"use client";

import { useEffect, useRef, useState } from "react";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

// All Sinhala strings as \u escapes so this file is pure ASCII
const SI_TITLE       = "AI සහායක";
const SI_EMPTY       = "ඔබගේ ප්‍රශ්නය ඇතුළත් කරන්න";
const SI_PLACEHOLDER = "ප්‍රශ්නයක් ඇතුළත් කරන්න...";
const SI_THINKING    = "පිළිතුර සකස් කරනවා...";
const SI_NO_ANSWER   = "පිළිතුර ලබා ගත නොහෙකි විය.";

export default function ChatBot({ subject = "", lesson = "", topic = "", accent = "#2563eb", inline = false, onHearAvatar }) {
  const [chatOpen, setChatOpen] = useState(inline ? true : false);
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const chatBottomRef = useRef(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, chatLoading]);

  const startListening = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return alert("Browser does not support speech recognition.");
    const rec = new SR();
    rec.lang = "si-LK";
    rec.onstart = () => setListening(true);
    rec.onresult = (e) => {
      if (e.results[0] && e.results[0][0]) {
        setChatInput(e.results[0][0].transcript);
      }
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    rec.start();
  };

  const sendMessage = async () => {
    const q = chatInput.trim();
    if (!q || chatLoading) return;
    setChatInput("");
    setChatHistory(prev => [...prev, { role: "user", text: q }]);
    setChatLoading(true);
    try {
      const res = await fetch(`${BACKEND}/ask-question`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q,
          subject,
          lesson,
          topic,
          student_id: localStorage.getItem("student_id"),
        }),
      });
      const data = await res.json();
      setChatHistory(prev => [...prev, { role: "bot", text: data.answer || SI_NO_ANSWER }]);
    } catch {
      setChatHistory(prev => [...prev, { role: "bot", text: SI_NO_ANSWER }]);
    } finally {
      setChatLoading(false);
    }
  };

  const inlineStyle = inline ? {
    width: "100%", height: "100%", display: "flex", flexDirection: "column",
    backgroundColor: "white", borderRadius: 20,
    border: `1.5px solid ${accent}40`,
    boxShadow: `0 8px 40px rgba(0,0,0,0.09)`,
    overflow: "hidden",
  } : {
    width: 360, marginBottom: 12,
    backgroundColor: "white", borderRadius: 18,
    boxShadow: "0 8px 40px rgba(0,0,0,0.15)",
    border: "1px solid #e2e8f0",
    display: "flex", flexDirection: "column", overflow: "hidden",
  };

  const containerStyle = inline ? { width: "100%", height: "100%" } : { position: "fixed", bottom: 28, right: 28, zIndex: 1000 };

  return (
    <div style={containerStyle}>
      {chatOpen && (
        <div style={inlineStyle}>
          {/* Header */}
          <div style={{
            background: inline ? "white" : accent, 
            padding: inline ? "20px 24px 16px" : "14px 18px",
            borderBottom: inline ? "1px solid #f1f5f9" : "none",
            display: "flex", alignItems: "center", justifyContent: "space-between"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: inline ? 12 : 10 }}>
              <div style={{
                width: inline ? 36 : 32, height: inline ? 36 : 32, borderRadius: inline ? 10 : "50%",
                backgroundColor: inline ? `${accent}15` : "rgba(255,255,255,0.2)",
                color: inline ? accent : "white",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: inline ? 18 : 16
              }}>🤖</div>
              <div>
                <p style={{ color: inline ? "#0f172a" : "white", fontWeight: 700, fontSize: inline ? 15 : 14, margin: 0 }}>{SI_TITLE}</p>
                <p style={{ color: inline ? "#64748b" : "rgba(255,255,255,0.7)", fontSize: inline ? 12 : 11, margin: 0, marginTop: inline ? 2 : 0 }}>
                  {[subject, lesson, topic].filter(Boolean).join(" - ")}
                </p>
              </div>
            </div>
            {!inline && (
              <button
                onClick={() => setChatOpen(false)}
                style={{ background: "none", border: "none", color: "white", fontSize: 20, cursor: "pointer", lineHeight: 1 }}
              >✕</button>
            )}
          </div>

          {/* Chat Body */}
          <div style={{
            flex: inline ? 1 : "none",
            height: inline ? "auto" : 320, overflowY: "auto", padding: inline ? "20px 24px" : "16px 14px",
            display: "flex", flexDirection: "column", gap: 14,
            backgroundColor: inline ? "#f8fafc" : "#f8fafc",
          }}>
            {chatHistory.length === 0 && (
              <div style={{ textAlign: "center", color: "#94a3b8", fontSize: 13, marginTop: 60 }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 16, background: "white",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 24, margin: "0 auto 12px", boxShadow: "0 4px 12px rgba(0,0,0,0.05)"
                }}>💬</div>
                <p style={{ margin: 0 }}>{SI_EMPTY}</p>
              </div>
            )}
            {chatHistory.map((msg, idx) => (
              <div key={idx} style={{
                display: "flex",
                justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
              }}>
                <div style={{
                  maxWidth: "85%", padding: "12px 16px", borderRadius: 16,
                  fontSize: 13, lineHeight: 1.6,
                  background: msg.role === "user" ? `linear-gradient(135deg, ${accent}, #4f46e5)` : "white",
                  color: msg.role === "user" ? "white" : "#1e293b",
                  boxShadow: msg.role === "user" ? `0 4px 12px ${accent}40` : "0 2px 8px rgba(0,0,0,0.05)",
                  borderBottomRightRadius: msg.role === "user" ? 4 : 16,
                  borderBottomLeftRadius: msg.role === "bot" ? 4 : 16,
                  border: msg.role === "bot" ? "1px solid #e2e8f0" : "none",
                }}>
                  <div style={{ marginBottom: (msg.role === "bot" && onHearAvatar) ? 10 : 0 }}>{msg.text}</div>
                  {msg.role === "bot" && onHearAvatar && (
                    <button
                      onClick={() => {
                        if (onHearAvatar) onHearAvatar(msg.text);
                      }}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        background: `linear-gradient(135deg, #1e293b, ${accent})`,
                        color: "white", border: "none", borderRadius: 8,
                        padding: "7px 16px", fontSize: 12, fontWeight: 700,
                        cursor: "pointer", boxShadow: `0 3px 10px ${accent}40`,
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <polygon points="2,1 11,6 2,11" fill="white" />
                      </svg>
                      Hear from Avatar
                    </button>
                  )}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div style={{
                  backgroundColor: "white", padding: "12px 16px", borderRadius: 16,
                  borderBottomLeftRadius: 4, boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                  color: "#94a3b8", fontSize: 13, border: "1px solid #e2e8f0"
                }}>
                  {SI_THINKING}
                </div>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Input Area */}
          <div style={{
            padding: inline ? "16px 24px" : "12px 14px", borderTop: "1px solid #e2e8f0",
            display: "flex", gap: 10, backgroundColor: "white", alignItems: "center"
          }}>
            <button
              onClick={startListening}
              style={{
                width: 40, height: 40, borderRadius: 12, border: "none",
                background: listening
                  ? "linear-gradient(135deg, #7f1d1d, #ef4444)"
                  : `linear-gradient(135deg, #f1f5f9, #e2e8f0)`,
                color: listening ? "white" : "#64748b", cursor: "pointer", flexShrink: 0,
                boxShadow: listening ? "0 4px 12px rgba(239,68,68,0.4)" : "none",
                display: "flex", alignItems: "center", justifyContent: "center",
                animation: listening ? "pulseChat 1s infinite" : "none",
                transition: "all 0.2s"
              }}
            >
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                <rect x="5" y="1" width="6" height="9" rx="3" stroke="currentColor" strokeWidth="1.5" />
                <path d="M2 8a6 6 0 0 0 12 0M8 14v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
            <input
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && sendMessage()}
              placeholder={SI_PLACEHOLDER}
              style={{
                flex: 1, padding: "10px 16px", borderRadius: 12,
                border: "1.5px solid #e2e8f0", outline: "none",
                fontSize: 13, color: "#0f172a", backgroundColor: "#f8fafc",
                transition: "border-color 0.2s"
              }}
              onFocus={(e) => e.target.style.borderColor = accent}
              onBlur={(e) => e.target.style.borderColor = "#e2e8f0"}
            />
            <button
              onClick={sendMessage}
              disabled={chatLoading || !chatInput.trim()}
              style={{
                background: chatLoading || !chatInput.trim() ? "#f1f5f9" : `linear-gradient(135deg, ${accent}, #4f46e5)`,
                color: chatLoading || !chatInput.trim() ? "#94a3b8" : "white",
                border: "none", borderRadius: 12, width: 40, height: 40,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: chatLoading || !chatInput.trim() ? "not-allowed" : "pointer",
                transition: "all 0.2s",
                boxShadow: chatLoading || !chatInput.trim() ? "none" : `0 4px 12px ${accent}40`,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M22 2L11 13M22 2L15 22L11 13M11 13L2 9L22 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
      )}
      {!inline && !chatOpen && (
        <button
          onClick={() => setChatOpen(true)}
          style={{
            width: 60, height: 60, borderRadius: "50%",
            background: `linear-gradient(135deg, ${accent}, #4f46e5)`, border: "none", color: "white",
            fontSize: 24, display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", boxShadow: `0 6px 20px ${accent}60`,
            transition: "transform 0.2s"
          }}
          onMouseEnter={e => e.currentTarget.style.transform = "scale(1.05)"}
          onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
        >
          💬
        </button>
      )}
      <style>{`@keyframes pulseChat { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.7;transform:scale(1.08)} }`}</style>
    </div>
  );
}
