"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { curriculum } from "@/data/curriculum";

const API = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

const ACCENT = "#3b82f6";
const SURFACE = "#0f172a";
const CARD = "#1e293b";
const BORDER = "#334155";
const MUTED = "#64748b";
const TEXT = "#f1f5f9";
const TEXT2 = "#94a3b8";

function StepBadge({ n, label, active, done }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{
        width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 12, fontWeight: 700,
        background: done ? "#10b981" : active ? ACCENT : "#1e293b",
        color: done || active ? "white" : TEXT2,
        border: `1px solid ${done ? "#10b981" : active ? ACCENT : BORDER}`,
      }}>
        {done ? "✓" : n}
      </div>
      <span style={{ color: active ? TEXT : TEXT2, fontSize: 13, fontWeight: active ? 700 : 500 }}>{label}</span>
    </div>
  );
}

export default function PdfUploadPage() {
  const router = useRouter();
  const [adminName, setAdminName] = useState("");

  const [stage, setStage] = useState("idle"); // idle -> extracting -> reviewing_images -> building_text -> reviewing_topics -> finalizing -> completed -> failed
  const [file, setFile] = useState(null);
  const [subject, setSubject] = useState("");
  const [lesson, setLesson] = useState("");
  const [grade, setGrade] = useState("");
  const [jobId, setJobId] = useState(null);
  const [statusMsg, setStatusMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const [extractedImages, setExtractedImages] = useState([]);
  const [selectedImages, setSelectedImages] = useState(new Set());

  const [topics, setTopics] = useState([]);
  const [result, setResult] = useState(null);

  const pollRef = useRef(null);

  useEffect(() => {
    const role = localStorage.getItem("role");
    const name = localStorage.getItem("name");
    if (role !== "admin") { router.push("/"); return; }
    setAdminName(name || "Admin");
  }, []);

  // ── Polling ──
  useEffect(() => {
    if (!jobId) return;
    if (!["extracting", "building_text", "finalizing"].includes(stage)) return;

    pollRef.current = setInterval(async () => {
      try {
        const res = await axios.get(`${API}/admin/pdf/jobs/${jobId}`);
        const job = res.data;
        setStatusMsg(job.message || "");

        if (job.status === "extracted") {
          clearInterval(pollRef.current);
          setExtractedImages(job.extracted_images || []);
          setSelectedImages(new Set(job.extracted_images || []));
          setStage("reviewing_images");
        } else if (job.status === "text_ready") {
          clearInterval(pollRef.current);
          setTopics(job.topics || []);
          setStage("reviewing_topics");
        } else if (job.status === "completed") {
          clearInterval(pollRef.current);
          setResult({ saved_txt_files: job.saved_txt_files, saved_images: job.saved_images });
          setStage("completed");
        } else if (job.status === "failed") {
          clearInterval(pollRef.current);
          setErrorMsg(job.error || "Something went wrong.");
          setStage("failed");
        }
      } catch (err) {
        // transient network hiccup — keep polling
      }
    }, 1500);

    return () => clearInterval(pollRef.current);
  }, [jobId, stage]);

  const resetAll = () => {
    setStage("idle");
    setFile(null);
    setJobId(null);
    setStatusMsg("");
    setErrorMsg("");
    setExtractedImages([]);
    setSelectedImages(new Set());
    setTopics([]);
    setResult(null);
  };

  const handleUpload = async () => {
    if (!file) return;
    setErrorMsg("");
    const form = new FormData();
    form.append("file", file);
    try {
      setStage("extracting");
      setStatusMsg("Uploading PDF...");
      const res = await axios.post(`${API}/admin/pdf/extract`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setJobId(res.data.job_id);
    } catch (err) {
      setErrorMsg(err?.response?.data?.detail || "Upload failed.");
      setStage("failed");
    }
  };

  const toggleImage = (name) => {
    setSelectedImages(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  const handleBuildText = async () => {
    if (!grade || !subject.trim() || !lesson.trim()) {
      setErrorMsg("Please select a grade and enter both subject and lesson before continuing.");
      return;
    }
    setErrorMsg("");
    try {
      setStage("building_text");
      setStatusMsg("Building topic text...");
      await axios.post(`${API}/admin/pdf/build-text`, {
        job_id: jobId,
        selected_images: Array.from(selectedImages),
        subject,
        lesson,
      });
    } catch (err) {
      setErrorMsg(err?.response?.data?.detail || "Failed to start text generation.");
      setStage("reviewing_images");
    }
  };

  const updateTopicContent = (idx, value) => {
    setTopics(prev => prev.map((t, i) => (i === idx ? { ...t, content: value } : t)));
  };

  const handleFinalize = async () => {
    setErrorMsg("");
    try {
      setStage("finalizing");
      setStatusMsg("Saving files and ingesting into the vector DB...");
      await axios.post(`${API}/admin/pdf/finalize`, {
        job_id: jobId,
        topics: topics.map(t => ({ title: t.title, content: t.content })),
        subject,
        lesson,
        grade,
        teacher_id: localStorage.getItem("student_id") || "",
      });
    } catch (err) {
      setErrorMsg(err?.response?.data?.detail || "Failed to start finalization.");
      setStage("reviewing_topics");
    }
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", width: "100vw", background: SURFACE, }}>
      <main style={{ flex: 1, minWidth: 0, overflowY: "auto", padding: "40px 44px" }}>

        <div style={{ marginBottom: 28, display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div>
            <p className="text-label" style={{ color: MUTED, marginBottom: 6 }}>
              Teacher Panel
            </p>
            <h1 className="text-section-title" style={{ color: TEXT, margin: 0 }}>
              Add Content (PDF → Vector DB)
            </h1>
          </div>
          <button
            onClick={() => router.push("/admin/dashboard")}
            style={{ background: "transparent", color: TEXT2, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer" }}
          >
            ← Back to Dashboard
          </button>
        </div>

        {/* Step indicator */}
        <div style={{
          display: "flex", gap: 28, marginBottom: 28, padding: "16px 20px",
          background: CARD, borderRadius: 14, border: `1px solid ${BORDER}`, flexWrap: "wrap",
        }}>
          <StepBadge n={1} label="Upload PDF" active={stage === "idle" || stage === "extracting"} done={["reviewing_images", "building_text", "reviewing_topics", "finalizing", "completed"].includes(stage)} />
          <StepBadge n={2} label="Select Images" active={stage === "reviewing_images"} done={["building_text", "reviewing_topics", "finalizing", "completed"].includes(stage)} />
          <StepBadge n={3} label="Review Topics" active={stage === "building_text" || stage === "reviewing_topics"} done={["finalizing", "completed"].includes(stage)} />
          <StepBadge n={4} label="Save & Ingest" active={stage === "finalizing"} done={stage === "completed"} />
        </div>

        {errorMsg && (
          <div style={{ background: "#450a0a", color: "#fca5a5", padding: "12px 18px", borderRadius: 10, marginBottom: 20, fontSize: 13 }}>
            {errorMsg}
          </div>
        )}

        {/* ── Stage: idle (upload form) ── */}
        {stage === "idle" && (
          <div style={{ background: CARD, borderRadius: 16, border: `1px solid ${BORDER}`, padding: 28, maxWidth: 560 }}>
            <p style={{ color: TEXT2, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 16px" }}>
              Upload Textbook PDF
            </p>
            <input
              type="file"
              accept="application/pdf"
              onChange={e => setFile(e.target.files?.[0] || null)}
              style={{ color: TEXT2, fontSize: 13, marginBottom: 20, display: "block" }}
            />
            <button
              onClick={handleUpload}
              disabled={!file}
              style={{
                background: !file ? "#334155" : ACCENT, color: "white", border: "none",
                borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 600,
                cursor: !file ? "not-allowed" : "pointer",
              }}
            >
              Upload &amp; Extract
            </button>
            <p style={{ color: MUTED, fontSize: 12, marginTop: 14 }}>
              Text and images will be extracted in reading order. You'll choose which images to keep,
              and review the generated topic text before anything is saved.
            </p>
          </div>
        )}

        {/* ── Stage: extracting / building_text / finalizing (progress) ── */}
        {["extracting", "building_text", "finalizing"].includes(stage) && (
          <div style={{ background: CARD, borderRadius: 16, border: `1px solid ${BORDER}`, padding: 40, textAlign: "center", maxWidth: 560 }}>
            <div style={{ width: 36, height: 36, margin: "0 auto 16px", borderRadius: "50%", border: `3px solid ${BORDER}`, borderTop: `3px solid ${ACCENT}`, animation: "spin 0.8s linear infinite" }} />
            <p style={{ color: TEXT, fontSize: 14, fontWeight: 600 }}>{statusMsg || "Working..."}</p>
          </div>
        )}

        {/* ── Stage: reviewing_images ── */}
        {stage === "reviewing_images" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 900 }}>
            <div style={{ background: CARD, borderRadius: 16, border: `1px solid ${BORDER}`, padding: 24 }}>
              <p style={{ color: TEXT2, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 16px" }}>
                Grade, Subject &amp; Lesson
              </p>
              <div style={{ display: "flex", gap: 12 }}>
                <select
                  value={grade} onChange={e => setGrade(e.target.value)}
                  style={{ flex: 1, padding: "9px 12px", background: "#0f172a", border: `1px solid ${BORDER}`, borderRadius: 8, color: grade ? TEXT : "#475569", fontSize: 13 }}
                >
                  <option value="">Select grade...</option>
                  {curriculum.map((g) => (
                    <option key={g.grade} value={g.grade}>{g.grade}</option>
                  ))}
                </select>
                <input
                  value={subject} onChange={e => setSubject(e.target.value)}
                  placeholder="e.g. Science11"
                  style={{ flex: 1, padding: "9px 12px", background: "#0f172a", border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT, fontSize: 13 }}
                />
                <input
                  value={lesson} onChange={e => setLesson(e.target.value)}
                  placeholder="e.g. Plant Tissue"
                  style={{ flex: 1, padding: "9px 12px", background: "#0f172a", border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT, fontSize: 13 }}
                />
              </div>
            </div>

            <div style={{ background: CARD, borderRadius: 16, border: `1px solid ${BORDER}`, padding: 24 }}>
              <p style={{ color: TEXT2, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 16px" }}>
                Select Images to Keep ({selectedImages.size} / {extractedImages.length})
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 14 }}>
                {extractedImages.map((name) => (
                  <div
                    key={name}
                    onClick={() => toggleImage(name)}
                    style={{
                      cursor: "pointer", borderRadius: 10, overflow: "hidden",
                      border: `2px solid ${selectedImages.has(name) ? ACCENT : BORDER}`,
                      opacity: selectedImages.has(name) ? 1 : 0.45,
                    }}
                  >
                    <img
                      src={`${API}/admin/pdf/jobs/${jobId}/image/${name}`}
                      alt={name}
                      style={{ width: "100%", height: 100, objectFit: "cover", display: "block" }}
                    />
                    <div style={{ padding: "6px 8px", fontSize: 10, color: TEXT2, background: "#0f172a" }}>
                      {selectedImages.has(name) ? "✓ kept" : "excluded"}
                    </div>
                  </div>
                ))}
                {extractedImages.length === 0 && (
                  <p style={{ color: MUTED, fontSize: 13 }}>No images were found in this PDF.</p>
                )}
              </div>
              <button
                onClick={handleBuildText}
                style={{ marginTop: 20, background: ACCENT, color: "white", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                Continue → Generate Topic Text
              </button>
            </div>
          </div>
        )}

        {/* ── Stage: reviewing_topics ── */}
        {stage === "reviewing_topics" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 900 }}>
            {topics.map((topic, idx) => (
              <div key={idx} style={{ background: CARD, borderRadius: 16, border: `1px solid ${BORDER}`, padding: 20 }}>
                <p style={{ color: TEXT, fontWeight: 700, fontSize: 14, margin: "0 0 10px" }}>{topic.title}</p>
                <textarea
                  value={topic.content}
                  onChange={e => updateTopicContent(idx, e.target.value)}
                  rows={10}
                  style={{
                    width: "100%", padding: 12, background: "#0f172a", border: `1px solid ${BORDER}`,
                    borderRadius: 8, color: TEXT, fontSize: 13, lineHeight: 1.7, 
                    resize: "vertical", boxSizing: "border-box",
                  }}
                />
              </div>
            ))}
            {topics.length === 0 && (
              <p style={{ color: MUTED, fontSize: 13 }}>No topics were detected in the selected content.</p>
            )}
            <button
              onClick={handleFinalize}
              disabled={topics.length === 0}
              style={{
                alignSelf: "flex-start", background: topics.length === 0 ? "#334155" : "#10b981",
                color: "white", border: "none", borderRadius: 8, padding: "10px 20px",
                fontSize: 13, fontWeight: 600, cursor: topics.length === 0 ? "not-allowed" : "pointer",
              }}
            >
              Save &amp; Ingest into Vector DB
            </button>
          </div>
        )}

        {/* ── Stage: completed ── */}
        {stage === "completed" && result && (
          <div style={{ background: CARD, borderRadius: 16, border: `1px solid #10b981`, padding: 28, maxWidth: 560 }}>
            <p style={{ color: "#34d399", fontSize: 16, fontWeight: 700, margin: "0 0 14px" }}>✓ Ingested Successfully</p>
            <p style={{ color: TEXT2, fontSize: 13, margin: "0 0 6px" }}>
              Saved {result.saved_txt_files?.length || 0} topic file(s) to documents_unicode/:
            </p>
            <ul style={{ color: TEXT, fontSize: 12, margin: "0 0 14px", paddingLeft: 18 }}>
              {(result.saved_txt_files || []).map(f => <li key={f}>{f}</li>)}
            </ul>
            <p style={{ color: TEXT2, fontSize: 13, margin: "0 0 20px" }}>
              Saved {result.saved_images?.length || 0} image(s) to images/.
            </p>
            <button
              onClick={resetAll}
              style={{ background: ACCENT, color: "white", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
            >
              Upload Another PDF
            </button>
          </div>
        )}

        {/* ── Stage: failed ── */}
        {stage === "failed" && (
          <div style={{ background: CARD, borderRadius: 16, border: `1px solid #ef4444`, padding: 28, maxWidth: 560 }}>
            <p style={{ color: "#f87171", fontSize: 16, fontWeight: 700, margin: "0 0 14px" }}>✗ Failed</p>
            <p style={{ color: TEXT2, fontSize: 13, margin: "0 0 20px" }}>{errorMsg}</p>
            <button
              onClick={resetAll}
              style={{ background: ACCENT, color: "white", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
            >
              Start Over
            </button>
          </div>
        )}
      </main>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
