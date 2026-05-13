"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import { getLesson } from "@/services/api";

export default function LessonPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const subject = searchParams.get("subject");
  const lesson = searchParams.get("lesson");
  const topic = searchParams.get("topic");
  const level = searchParams.get("level") || "Beginner";

  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
    if (!topic || !subject || !lesson) {
      setLoading(false);
      setError("Missing lesson details.");
      return;
    }

    const savedContent = localStorage.getItem("lesson_content");
    const savedTopic = localStorage.getItem("lesson_content_topic");
    if (savedContent && savedTopic === topic) {
      setContent(savedContent);
      localStorage.removeItem("lesson_content");
      localStorage.removeItem("lesson_content_topic");
      setLoading(false);
      return;
    }

    let active = true;

    const fetchContent = async () => {
      try {
        setLoading(true);
        setError("");
        const res = await getLesson(subject, lesson, topic, level);
        if (!active) return;
        setContent(res?.data?.content || "");
      } catch (err) {
        if (!active) return;
        setError(err?.response?.data?.detail || err?.message || "Failed to load lesson content.");
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchContent();

    return () => {
      active = false;
    };
  }, [subject, lesson, topic, level, router]);

  if (loading) {
    return (
      <div style={{ display: "flex", minHeight: "100vh" }}>
        <Sidebar />
        <main style={{ flex: 1, backgroundColor: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{
            backgroundColor: "white", borderRadius: 16,
            padding: "48px 56px", textAlign: "center",
            boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
            maxWidth: 520,
            width: "100%",
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: "50%",
              border: "3px solid #e2e8f0",
              borderTop: `3px solid ${accent}`,
              animation: "spin 0.8s linear infinite",
              margin: "0 auto 20px"
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <p style={{ color: "#0f172a", fontWeight: 600, fontSize: 16, marginBottom: 6 }}>
              Loading lesson content...
            </p>
            <p style={{ color: "#94a3b8", fontSize: 13 }}>
              Preparing <strong>{topic}</strong>
            </p>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: "flex", minHeight: "100vh" }}>
        <Sidebar />
        <main style={{ flex: 1, padding: 48, backgroundColor: "#f8fafc" }}>
          <div style={{ maxWidth: 720, backgroundColor: "white", borderRadius: 16, padding: 24, border: "1px solid #fee2e2" }}>
            <p style={{ color: "#b91c1c", fontWeight: 700, marginBottom: 8 }}>
              {error}
            </p>
            <p style={{ color: "#64748b", fontSize: 14 }}>
              Try opening the topic again or go back to the topic slider.
            </p>
          </div>
        </main>
      </div>
    );
  }

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
            <p style={{ color: "#64748b", fontSize: 14 }}>
              Read the lesson overview, then finish with the quiz when you are ready.
            </p>
          </div>

          <span style={{
            backgroundColor: lc.bg, color: lc.color,
            padding: "6px 16px", borderRadius: 20,
            fontSize: 12, fontWeight: 600, flexShrink: 0
          }}>
            {level} Level
          </span>
        </div>

        {/* Content Card */}
        <div style={{
          backgroundColor: "white", borderRadius: 16,
          padding: "36px 40px", marginBottom: 24,
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
          border: "1px solid #f1f5f9"
        }}>
          {content ? (
            <div style={{
              whiteSpace: "pre-line", color: "#334155",
              fontSize: 15, lineHeight: 1.9
            }}>
              {content}
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