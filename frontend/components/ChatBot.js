"use client";

import { useEffect, useRef, useState } from "react";

const BACKEND = "http://localhost:8000";

// All Sinhala strings as \u escapes so this file is pure ASCII
const SI_TITLE       = "AI සහායක";
const SI_EMPTY       = "ඔබගේ ප්‍රශ්නය ඇතුළත් කරන්න";
const SI_PLACEHOLDER = "ප්‍රශ්නයක් ඇතුළත් කරන්න...";
const SI_THINKING    = "පිළිතුර සකස් කරනවා...";
const SI_NO_ANSWER   = "පිළිතුර ලබා ගත නොහෙකි විය.";

export default function ChatBot({ subject = "", lesson = "", topic = "", accent = "#2563eb" }) {
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const chatBottomRef = useRef(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, chatLoading]);

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

  return (
    <div style={{ position: "fixed", bottom: 28, right: 28, zIndex: 1000 }}>
      {chatOpen && (
        <div style={{
          width: 360, marginBottom: 12,
          backgroundColor: "white", borderRadius: 18,
          boxShadow: "0 8px 40px rgba(0,0,0,0.15)",
          border: "1px solid #e2e8f0",
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}>
          <div style={{
            backgroundColor: accent, padding: "14px 18px",
            display: "flex", alignItems: "center", justifyContent: "space-between"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                backgroundColor: "rgba(255,255,255,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 16
              }}>{"🤖"}</div>
              <div>
                <p style={{ color: "white", fontWeight: 700, fontSize: 14, margin: 0 }}>{SI_TITLE}</p>
                <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, margin: 0 }}>
                  {[subject, lesson, topic].filter(Boolean).join(" - ")}
                </p>
              </div>
            </div>
            <button
              onClick={() => setChatOpen(false)}
              style={{ background: "none", border: "none", color: "white", fontSize: 20, cursor: "pointer", lineHeight: 1 }}
            >{"x"}</button>
          </div>

          <div style={{
            height: 320, overflowY: "auto", padding: "16px 14px",
            display: "flex", flexDirection: "column", gap: 10,
            backgroundColor: "#f8fafc",
          }}>
            {chatHistory.length === 0 && (
              <div style={{ textAlign: "center", color: "#94a3b8", fontSize: 13, marginTop: 60 }}>
                <p style={{ fontSize: 28, margin: "0 0 8px" }}>{"💬"}</p>
                <p style={{ margin: 0 }}>{SI_EMPTY}</p>
              </div>
            )}
            {chatHistory.map((msg, idx) => (
              <div key={idx} style={{
                display: "flex",
                justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
              }}>
                <div style={{
                  maxWidth: "80%", padding: "10px 14px", borderRadius: 14,
                  fontSize: 13, lineHeight: 1.7,
                  backgroundColor: msg.role === "user" ? accent : "white",
                  color: msg.role === "user" ? "white" : "#0f172a",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                  borderBottomRightRadius: msg.role === "user" ? 4 : 14,
                  borderBottomLeftRadius: msg.role === "bot" ? 4 : 14,
                }}>
                  {msg.text}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div style={{
                  backgroundColor: "white", padding: "10px 16px", borderRadius: 14,
                  borderBottomLeftRadius: 4, boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                  color: "#94a3b8", fontSize: 13,
                }}>
                  {SI_THINKING}
                </div>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          <div style={{
            padding: "12px 14px", borderTop: "1px solid #e2e8f0",
            display: "flex", gap: 8, backgroundColor: "white",
          }}>
            <input
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && sendMessage()}
              placeholder={SI_PLACEHOLDER}
              style={{
                flex: 1, padding: "9px 14px", borderRadius: 10,
                border: "1.5px solid #e2e8f0", outline: "none",
                fontSize: 13, color: "#0f172a", fontFamily: "inherit",
              }}
            />
            <button
              onClick={sendMessage}
              disabled={chatLoading || !chatInput.trim()}
              style={{
                backgroundColor: chatLoading || !chatInput.trim() ? "#e2e8f0" : accent,
                color: chatLoading || !chatInput.trim() ? "#94a3b8" : "white",
                border: "none", borderRadius: 10,
                padding: "9px 16px", cursor: chatLoading || !chatInput.trim() ? "not-allowed" : "pointer",
                fontWeight: 600, fontSize: 13, transition: "all 0.2s",
              }}
            >
              {"->"}
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setChatOpen(o => !o)}
        style={{
          width: 56, height: 56, borderRadius: "50%",
          backgroundColor: accent, color: "white",
          border: "none", cursor: "pointer",
          boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
          fontSize: 22, display: "flex", alignItems: "center", justifyContent: "center",
          transition: "transform 0.2s",
        }}
      >
        {chatOpen ? "x" : "💬"}
      </button>
    </div>
  );
}
