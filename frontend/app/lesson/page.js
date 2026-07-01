"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import AvatarTeacher from "@/components/AvatarTeacher";

export default function LessonPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const subject = searchParams.get("subject");
  const lesson = searchParams.get("lesson");
  const topic = searchParams.get("topic");
  const level = searchParams.get("level") || "Beginner";

  const [content, setContent] = useState("");
  const [avatarSpeech, setAvatarSpeech] = useState("");
  const [speechReady, setSpeechReady] = useState(false);
  const BACKEND = "http://localhost:8000";

  // Parse content — [IMAGE: filename] tag position හිදීම image render
  const renderContentWithImages = (text) => {
    const lines = text.split("\n");
    const elements = [];
    let paraLines = [];
    let keyIdx = 0;

    const flushPara = () => {
      const joined = paraLines.join("\n").trim();
      if (joined) {
        elements.push(
          <p key={`p-${keyIdx++}`} style={{ marginBottom: 16, lineHeight: 1.9, color: "#334155", fontSize: 15 }}>
            {joined}
          </p>
        );
      }
      paraLines = [];
    };

    lines.forEach((line) => {
      // Support both [IMAGE: file.png] and [IMAGE_1.png] formats
      const imageMatch = line.match(/\[IMAGE:\s*([^\]]+)\]/i) || line.match(/^\[([^\]]*\.(?:png|jpg|jpeg|gif|webp))\]$/i);
      if (imageMatch) {
        flushPara();
        const filename = imageMatch[1].trim();
        elements.push(
          <div key={`img-${keyIdx++}`} style={{
            margin: "28px 0", textAlign: "center",
            border: "1px solid #e2e8f0", borderRadius: 12,
            padding: 20, backgroundColor: "#f8fafc",
          }}>
            <img
              src={`${BACKEND}/images/${filename}`}
              alt={filename}
              style={{ maxWidth: "100%", borderRadius: 8, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}
              onError={(e) => { e.target.style.display = "none"; }}
            />
            <p style={{ color: "#94a3b8", fontSize: 12, marginTop: 8 }}>
              {filename.replace(/\.[^.]+$/, "").replace(/_/g, " ")}
            </p>
          </div>
        );
      } else {
        paraLines.push(line);
      }
    });

    flushPara();
    return elements;
  };

  const subjectColors = {
    Physics: "#2563eb", Chemistry: "#16a34a",
    Biology: "#059669", Maths: "#9333ea",
  };
  const accent = subjectColors[subject] || "#2563eb";

  const levelConfig = {
    Advanced:     { bg: "#f5f3ff", color: "#7c3aed" },
    Intermediate: { bg: "#fffbeb", color: "#d97706" },
    Beginner:     { bg: "#f0fdf4", color: "#16a34a" },
  };
  const lc = levelConfig[level] || levelConfig["Beginner"];

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { router.push("/login"); return; }
    if (!topic) return;
    const savedContent = localStorage.getItem("lesson_content");
    if (savedContent) {
      setContent(savedContent);
      localStorage.removeItem("lesson_content");

      fetch(`${BACKEND}/explain-content/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: savedContent }),
      })
        .then(r => r.json())
        .then(data => {
          setAvatarSpeech(data.explanation || savedContent);
          setSpeechReady(true);
        })
        .catch(() => {
          setAvatarSpeech(savedContent);
          setSpeechReady(true);
        });
    }
  }, [topic, level]);

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar />

      <main style={{ flex: 1, padding: "48px", backgroundColor: "#f8fafc", minWidth: 0 }}>

        {/* Header */}
        <div style={{
          display: "flex", alignItems: "flex-start",
          justifyContent: "space-between", marginBottom: 32
        }}>
          <div>
            <p style={{
              color: accent, fontSize: 11, fontWeight: 600,
              letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 8
            }}>
              {subject} — {lesson}
            </p>
            <h1 style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 32, fontWeight: 700, color: "#0f172a", marginBottom: 8
            }}>
              {topic}
            </h1>
          </div>

          <span style={{
            backgroundColor: lc.bg, color: lc.color,
            padding: "6px 16px", borderRadius: 20,
            fontSize: 12, fontWeight: 600, flexShrink: 0
          }}>
            {level} Level
          </span>
        </div>

        {/* Avatar Teacher */}
        {content && (
          <AvatarTeacher content={avatarSpeech || content} topic={topic} speechReady={speechReady} />
        )}

        {/* Content Card */}
        <div style={{
          backgroundColor: "white", borderRadius: 16,
          padding: "36px 40px", marginBottom: 24,
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
          border: "1px solid #f1f5f9"
        }}>
          {content ? (
            <div>
              {renderContentWithImages(content)}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div style={{
                width: 40, height: 40, borderRadius: "50%",
                border: "3px solid #e2e8f0",
                borderTop: `3px solid ${accent}`,
                animation: "spin 0.8s linear infinite",
                margin: "0 auto 16px"
              }} />
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              <p style={{ color: "#94a3b8", fontSize: 14 }}>Loading lesson content...</p>
            </div>
          )}
        </div>

        {/* Finish Button */}
        {content && (
          <button
            onClick={() => router.push(`/quiz?topic=${topic}&level=${level}&type=post&subject=${subject}&lesson=${lesson}`)}
            style={{
              width: "100%", padding: "14px",
              backgroundColor: accent, color: "white",
              border: "none", borderRadius: 12,
              fontSize: 15, fontWeight: 600, cursor: "pointer"
            }}
          >
            Finish Lesson → Take Quiz
          </button>
        )}

      </main>
    </div>
  );
}