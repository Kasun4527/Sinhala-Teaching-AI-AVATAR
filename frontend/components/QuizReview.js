"use client";

import React from "react";

export default function QuizReview({ data, cfg }) {
  if (!data || !data.questions || !data.answers) {
    return null;
  }

  const { questions, answers } = data;
  const accent = cfg?.hue || "#2563eb";
  const dark = cfg?.dark || "#1e3a8a";

  return (
    <div style={{ marginTop: 40, width: "100%", maxWidth: 800 }}>
      <div style={{ marginBottom: 24, paddingBottom: 16, borderBottom: "2px solid #e2e8f0" }}>
        <h2 style={{
          margin: 0,
          
          fontSize: 22,
          fontWeight: 700,
          color: "#0f172a",
          letterSpacing: "0.02em"
        }}>
          Detailed Quiz Review
        </h2>
        <p style={{ margin: "4px 0 0", fontSize: 14, color: "#64748b" }}>
          Review your answers below to understand your mistakes and learn the correct concepts.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {questions.map((q, index) => {
          const studentAnswer = answers[index];
          const isCorrect = studentAnswer === q.answer;
          
          return (
            <div key={index} style={{
              background: "white",
              borderRadius: 16,
              border: `1.5px solid ${isCorrect ? "#bbf7d0" : "#fecaca"}`,
              padding: "24px 28px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
              position: "relative",
              overflow: "hidden"
            }}>
              {/* Left border accent */}
              <div style={{
                position: "absolute", left: 0, top: 0, bottom: 0, width: 6,
                background: isCorrect ? "#22c55e" : "#ef4444"
              }} />

              {/* Question Header */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                  background: isCorrect ? "#dcfce7" : "#fee2e2",
                  color: isCorrect ? "#16a34a" : "#dc2626",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, fontWeight: 700
                }}>
                  {index + 1}
                </div>
                <h3 style={{
                  margin: "2px 0 0",
                  fontSize: 16, fontWeight: 600, color: "#334155",
                  lineHeight: 1.5, flex: 1
                }}>
                  {q.question}
                </h3>
              </div>

              {/* Options */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingLeft: 40 }}>
                {q.options && q.options.map((opt, optIdx) => {
                  const isStudentChoice = opt === studentAnswer;
                  const isActualAnswer = opt === q.answer;
                  
                  let optionBg = "#f8fafc";
                  let optionBorder = "#e2e8f0";
                  let optionColor = "#475569";
                  let icon = null;

                  if (isActualAnswer) {
                    optionBg = "#f0fdf4";
                    optionBorder = "#86efac";
                    optionColor = "#15803d";
                    icon = (
                      <span style={{ color: "#16a34a", fontSize: 16, display: "flex", alignItems: "center" }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      </span>
                    );
                  } else if (isStudentChoice && !isCorrect) {
                    optionBg = "#fef2f2";
                    optionBorder = "#fca5a5";
                    optionColor = "#b91c1c";
                    icon = (
                      <span style={{ color: "#dc2626", fontSize: 16, display: "flex", alignItems: "center" }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18"></line>
                          <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                      </span>
                    );
                  }

                  return (
                    <div key={optIdx} style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "12px 16px", borderRadius: 10,
                      background: optionBg, border: `1px solid ${optionBorder}`,
                      transition: "all 0.2s"
                    }}>
                      <div style={{
                        width: 24, height: 24, borderRadius: "50%",
                        background: isActualAnswer ? "#22c55e" : (isStudentChoice && !isCorrect ? "#ef4444" : "white"),
                        border: `1px solid ${isActualAnswer ? "#22c55e" : (isStudentChoice && !isCorrect ? "#ef4444" : "#cbd5e1")}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: "white", fontSize: 12, fontWeight: 700
                      }}>
                        {String.fromCharCode(65 + optIdx)}
                      </div>
                      <span style={{ flex: 1, fontSize: 15, fontWeight: (isActualAnswer || isStudentChoice) ? 600 : 500, color: optionColor }}>
                        {opt}
                      </span>
                      {icon}
                    </div>
                  );
                })}
              </div>
              
              {/* If student missed, show a small help text */}
              {!isCorrect && (
                <div style={{ marginTop: 16, paddingLeft: 40 }}>
                  <div style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "6px 12px", background: "#fffbeb", border: "1px solid #fde68a",
                    borderRadius: 8, fontSize: 13, color: "#92400e", fontWeight: 600
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="12" y1="16" x2="12" y2="12"></line>
                      <line x1="12" y1="8" x2="12.01" y2="8"></line>
                    </svg>
                    You missed this one. The correct answer is highlighted in green.
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
