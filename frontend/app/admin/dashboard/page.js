"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";

const API = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

const ACCENT = "#3b82f6";
const SURFACE = "#0f172a";
const CARD = "#1e293b";
const BORDER = "#334155";
const MUTED = "#64748b";
const TEXT = "#f1f5f9";
const TEXT2 = "#94a3b8";

const subjectMeta = {
  Physics:   { color: "#3b82f6", glow: "rgba(59,130,246,0.15)",  icon: "⚛️" },
  Chemistry: { color: "#10b981", glow: "rgba(16,185,129,0.15)",  icon: "🧪" },
  Biology:   { color: "#06b6d4", glow: "rgba(6,182,212,0.15)",   icon: "🧬" },
  Maths:     { color: "#a855f7", glow: "rgba(168,85,247,0.15)",  icon: "📐" },
};

const levelBadge = {
  Advanced:     { bg: "rgba(168,85,247,0.15)", color: "#c084fc" },
  Intermediate: { bg: "rgba(251,191,36,0.15)", color: "#fbbf24" },
  Beginner:     { bg: "rgba(16,185,129,0.15)", color: "#34d399" },
};

function StatCard({ label, value, color = ACCENT, sub }) {
  return (
    <div style={{
      flex: 1, background: CARD, borderRadius: 14,
      padding: "20px 24px", border: `1px solid ${BORDER}`,
    }}>
      <p style={{ color: TEXT2, fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 8px" }}>{label}</p>
      <p style={{ fontSize: 34, fontWeight: 800, color, margin: 0, lineHeight: 1 }}>{value ?? "—"}</p>
      {sub && <p style={{ color: MUTED, fontSize: 12, margin: "6px 0 0" }}>{sub}</p>}
    </div>
  );
}

function ProgressBar({ pct, color = ACCENT }) {
  return (
    <div style={{ background: "#0f172a", borderRadius: 99, height: 6, overflow: "hidden" }}>
      <div style={{
        height: "100%", borderRadius: 99,
        background: `linear-gradient(90deg, ${color}, ${color}99)`,
        width: `${Math.min(pct, 100)}%`,
        transition: "width 0.6s cubic-bezier(.4,0,.2,1)",
        boxShadow: `0 0 8px ${color}60`,
      }} />
    </div>
  );
}

export default function AdminDashboard() {
  const router = useRouter();
  const [adminName, setAdminName] = useState("");
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [lessonProgress, setLessonProgress] = useState(null);
  const [topicDetails, setTopicDetails] = useState([]);
  const [expandedTopic, setExpandedTopic] = useState(null);
  const [engagementData, setEngagementData] = useState({});
  const [qaData, setQaData] = useState({});
  const [youtubeData, setYoutubeData] = useState({});
  const [improvement, setImprovement] = useState(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [teacherCode, setTeacherCode] = useState("");
  const [codeCopied, setCodeCopied] = useState(false);
  const [safetyAlerts, setSafetyAlerts] = useState([]);
  const [showAlerts, setShowAlerts] = useState(false);

  // Parent modal
  const [parentModal, setParentModal] = useState(false);
  const [parentInfo, setParentInfo] = useState(null);
  const [parentMsg, setParentMsg] = useState("");
  const [parentMsgStatus, setParentMsgStatus] = useState("");

  // Feedback modal
  const [feedbackModal, setFeedbackModal] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState("");

  useEffect(() => {
    const role = localStorage.getItem("role");
    const name = localStorage.getItem("name");
    if (role !== "admin") { router.push("/"); return; }
    setAdminName(name || "Admin");
    setTeacherCode(localStorage.getItem("teacher_code") || localStorage.getItem("student_id") || "");
    fetchStudents();
    fetchSafetyAlerts();
  }, []);

  const fetchSafetyAlerts = async () => {
    try {
      const teacherId = localStorage.getItem("student_id");
      const res = await axios.get(`${API}/admin/safety-alerts`, { params: { teacher_id: teacherId, limit: 50 } });
      setSafetyAlerts(res.data.alerts || []);
    } catch (err) {
      console.error("Failed to load safety alerts", err);
    }
  };

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const teacherId = localStorage.getItem("student_id"); // this admin's own user id
      const res = await axios.get(`${API}/admin/students`, { params: { teacher_id: teacherId } });
      setStudents(res.data.students);
    } catch (err) {
      console.error("Failed to load students", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchParentInfo = async (studentId) => {
    try {
      const res = await axios.get(`${API}/admin/student-parent`, { params: { student_id: studentId } });
      setParentInfo(res.data);
      setParentModal(true);
      setParentMsg("");
      setParentMsgStatus("");
    } catch (err) {
      console.error("Failed to load parent info", err);
      setParentInfo({ has_parent: false });
      setParentModal(true);
    }
  };

  const sendParentMessage = async () => {
    if (!parentMsg.trim()) return;
    setParentMsgStatus("sending");
    try {
      const teacherId = localStorage.getItem("student_id");
      await axios.post(`${API}/admin/send-parent-message`, {
        teacher_id: teacherId,
        student_id: selectedStudent.student_id,
        message: parentMsg.trim(),
      });
      setParentMsgStatus("sent");
      setParentMsg("");
    } catch (err) {
      setParentMsgStatus("error");
    }
  };

  const sendStudentFeedback = async () => {
    if (!feedbackMsg.trim()) return;
    setFeedbackStatus("sending");
    try {
      const teacherId = localStorage.getItem("student_id");
      await axios.post(`${API}/admin/send-student-feedback`, {
        teacher_id: teacherId,
        student_id: selectedStudent.student_id,
        subject: selectedSubject || "",
        lesson: expandedTopic?.lesson || "",
        message: feedbackMsg.trim(),
      });
      setFeedbackStatus("sent");
      setFeedbackMsg("");
    } catch (err) {
      setFeedbackStatus("error");
    }
  };

  const handleSelectStudent = async (student) => {
    setSelectedStudent(student);
    setSelectedSubject(null);
    setLessonProgress(null);
    setTopicDetails([]);
    setExpandedTopic(null);
    setImprovement(null);
    try {
      const [subjectsRes, improvementRes] = await Promise.all([
        axios.get(`${API}/admin/student-subjects`, {
          params: { student_id: student.student_id }
        }),
        axios.get(`${API}/progress-improvement`, {
          params: { student_id: student.student_id }
        }),
      ]);
      setSubjects(subjectsRes.data.subjects);
      setImprovement(improvementRes.data);
    } catch (err) {
      console.error("Failed to load subjects", err);
    }
  };

  const handleSelectSubject = async (subject) => {
    setSelectedSubject(subject);
    setTopicDetails([]);
    setLessonProgress(null);
    setExpandedTopic(null);
    try {
      const [progressRes, topicsRes, improvementRes] = await Promise.all([
        axios.get(`${API}/admin/lesson-progress`, {
          params: { student_id: selectedStudent.student_id, subject }
        }),
        axios.get(`${API}/admin/topic-details`, {
          params: { student_id: selectedStudent.student_id, subject }
        }),
        axios.get(`${API}/progress-improvement`, {
          params: { student_id: selectedStudent.student_id, subject }
        }),
      ]);
      setLessonProgress(progressRes.data);
      setTopicDetails(topicsRes.data.topics);
      setImprovement(improvementRes.data);
    } catch (err) {
      console.error("Failed to load subject details", err);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    router.push("/");
  };

  const filteredStudents = students.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.email.toLowerCase().includes(search.toLowerCase())
  );

  const sm = selectedSubject ? (subjectMeta[selectedSubject] || { color: ACCENT, glow: "rgba(59,130,246,0.15)", icon: "📚" }) : null;

  return (
    <div style={{ display: "flex", minHeight: "100vh", width: "100vw", background: SURFACE, }}>

      {/* ── Sidebar ── */}
      <aside style={{
        width: 220, minWidth: 220, minHeight: "100vh", flexShrink: 0,
        background: "#080e1a",
        borderRight: `1px solid ${BORDER}`,
        display: "flex", flexDirection: "column", justifyContent: "space-between",
      }}>
        <div>
          {/* Logo */}
          <div style={{ padding: "28px 20px 24px", borderBottom: `1px solid ${BORDER}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <img src="/logo.png" alt="SUBHASHA" style={{ height: 36, width: "auto", objectFit: "contain", flexShrink: 0 }} />
              <div>
                <p className="text-logo-sm" style={{ color: TEXT, margin: 0 }}>SUBHASHA Platform</p>
                <p className="text-caption" style={{ color: MUTED, margin: 0 }}>TEACHER PANEL</p>
              </div>
            </div>
          </div>

          {/* Nav */}
          <div style={{ padding: "20px 12px 8px" }}>
            <p style={{ color: "#334155", fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8, paddingLeft: 10 }}>
              Navigation
            </p>
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 14px", borderRadius: 10,
              background: `rgba(59,130,246,0.12)`,
              border: `1px solid rgba(59,130,246,0.25)`,
            }}>
              <span style={{ fontSize: 15 }}>📊</span>
              <span style={{ color: TEXT, fontSize: 13, fontWeight: 600 }}>Dashboard</span>
            </div>
            <div
              onClick={() => router.push("/admin/pdf-upload")}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.04)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 14px", borderRadius: 10, marginTop: 4, cursor: "pointer",
                transition: "background 0.15s",
              }}
            >
              <span style={{ fontSize: 15 }}>📄</span>
              <span style={{ color: TEXT2, fontSize: 13, fontWeight: 600 }}>Add Content</span>
            </div>
          </div>

          <div style={{ margin: "12px 16px", borderTop: `1px solid ${BORDER}` }} />

          {/* Quick stats */}
          <div style={{ padding: "0 12px" }}>
            <p style={{ color: "#334155", fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8, paddingLeft: 10 }}>
              Overview
            </p>
            {[
              { icon: "👥", label: "Students", value: students.length },
              { icon: "📚", label: "Active Now", value: selectedStudent ? 1 : 0 },
            ].map(({ icon, label, value }) => (
              <div key={label} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 12px", borderRadius: 10, marginBottom: 4,
                background: "rgba(255,255,255,0.02)", border: `1px solid ${BORDER}`,
              }}>
                <div style={{
                  width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                  background: "rgba(59,130,246,0.1)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <span style={{ fontSize: 13 }}>{icon}</span>
                </div>
                <div>
                  <p style={{ color: TEXT2, fontSize: 10, margin: 0 }}>{label}</p>
                  <p style={{ color: TEXT, fontSize: 15, fontWeight: 700, margin: 0 }}>{value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom */}
        <div>
          <div style={{ margin: "0 16px 12px", borderTop: `1px solid ${BORDER}` }} />
          <div style={{
            margin: "0 12px 8px", padding: "12px 14px",
            background: "rgba(255,255,255,0.02)", borderRadius: 12, border: `1px solid ${BORDER}`,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                background: `linear-gradient(135deg, #1e3a5f, #1e293b)`,
                border: `1px solid #2d3f55`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <span style={{ color: "#60a5fa", fontWeight: 700, fontSize: 14 }}>
                  {adminName.charAt(0).toUpperCase()}
                </span>
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ color: TEXT, fontSize: 12, fontWeight: 600, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {adminName}
                </p>
                <p style={{ color: MUTED, fontSize: 10, margin: 0 }}>Teacher</p>
              </div>
            </div>
          </div>
          <div
            onClick={handleLogout}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(239,68,68,0.08)"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              margin: "0 12px 24px", padding: "10px 14px",
              borderRadius: 10, cursor: "pointer", transition: "background 0.15s",
            }}
          >
            <span style={{ fontSize: 14 }}>🚪</span>
            <span style={{ color: "#ef4444", fontSize: 12, fontWeight: 600 }}>Sign Out</span>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main style={{ flex: 1, minWidth: 0, overflowY: "auto", padding: "40px 44px" }}>

        {/* Header */}
        <div style={{ marginBottom: 36, display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div>
            <p className="text-label" style={{ color: MUTED, marginBottom: 6 }}>
              Teacher Panel
            </p>
            <h1 className="text-section-title" style={{ color: TEXT, margin: 0 }}>
              Student Analytics
            </h1>
          </div>
          <div style={{ color: TEXT2, fontSize: 12 }}>
            {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </div>
        </div>

        {/* Teacher code — students enter this at signup to link to you */}
        <div style={{
          background: CARD, borderRadius: 14, border: `1px solid ${BORDER}`,
          padding: "16px 22px", marginBottom: 24,
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap",
        }}>
          <div>
            <p style={{ color: TEXT2, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 6px" }}>
              Your Teacher Code
            </p>
            <p style={{ color: MUTED, fontSize: 12, margin: 0 }}>
              Share this with your students — they enter it at signup to see your content and appear in your dashboard.
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <code style={{
              background: "#0f172a", border: `1px solid ${BORDER}`, borderRadius: 8,
              padding: "8px 14px", color: ACCENT, fontSize: 13, fontWeight: 700, letterSpacing: "0.02em",
            }}>
              {teacherCode}
            </code>
            <button
              onClick={() => { navigator.clipboard.writeText(teacherCode); setCodeCopied(true); setTimeout(() => setCodeCopied(false), 1500); }}
              style={{
                padding: "8px 14px", borderRadius: 8, border: "none",
                background: codeCopied ? "#10b981" : ACCENT, color: "white",
                fontWeight: 600, fontSize: 12, cursor: "pointer",
              }}
            >
              {codeCopied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>

        {/* ── Safety Alerts ── */}
        <div style={{
          background: CARD, borderRadius: 14, border: `1px solid ${safetyAlerts.length > 0 ? "#ef4444" : BORDER}`,
          padding: "16px 22px", marginBottom: 24,
        }}>
          <div
            onClick={() => setShowAlerts(!showAlerts)}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              cursor: "pointer", userSelect: "none",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 18 }}>🛡️</span>
              <div>
                <p style={{ color: TEXT, fontSize: 14, fontWeight: 700, margin: 0 }}>
                  Safety Alerts
                </p>
                <p style={{ color: MUTED, fontSize: 11, margin: 0 }}>
                  Content guardrail violations detected by the LLM safety system
                </p>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {safetyAlerts.length > 0 && (
                <span style={{
                  background: "#ef4444", color: "white", fontSize: 11, fontWeight: 700,
                  padding: "3px 10px", borderRadius: 99, minWidth: 20, textAlign: "center",
                }}>
                  {safetyAlerts.length}
                </span>
              )}
              <span style={{ color: MUTED, fontSize: 16, transition: "transform 0.2s", transform: showAlerts ? "rotate(180deg)" : "rotate(0)" }}>
                ▼
              </span>
            </div>
          </div>

          {showAlerts && (
            <div style={{ marginTop: 16, maxHeight: 400, overflowY: "auto" }}>
              {safetyAlerts.length === 0 ? (
                <p style={{ color: MUTED, fontSize: 12, textAlign: "center", padding: 20 }}>
                  ✅ No safety incidents recorded. All systems operating normally.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {safetyAlerts.map((alert, i) => (
                    <div key={i} style={{
                      padding: "14px 16px", borderRadius: 10,
                      background: "#0f172a", border: `1px solid ${alert.flag_type === "input_blocked" ? "#f97316" : "#ef4444"}`,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6,
                            background: alert.flag_type === "input_blocked" ? "rgba(249,115,22,0.15)" : "rgba(239,68,68,0.15)",
                            color: alert.flag_type === "input_blocked" ? "#fb923c" : "#f87171",
                            textTransform: "uppercase", letterSpacing: "0.05em",
                          }}>
                            {alert.flag_type === "input_blocked" ? "Input Blocked" : "Output Flagged"}
                          </span>
                          <span style={{ color: MUTED, fontSize: 10 }}>
                            {alert.agent || "unknown agent"}
                          </span>
                        </div>
                        <span style={{ color: MUTED, fontSize: 10 }}>
                          {alert.created_at ? new Date(alert.created_at).toLocaleString() : "—"}
                        </span>
                      </div>
                      <p style={{ color: TEXT2, fontSize: 12, margin: "0 0 4px", fontWeight: 600 }}>
                        {alert.reason}
                      </p>
                      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                        {alert.student_id && (
                          <span style={{ color: MUTED, fontSize: 11 }}>
                            👤 Student: <span style={{ color: TEXT2 }}>{alert.student_id}</span>
                          </span>
                        )}
                        {alert.subject && (
                          <span style={{ color: MUTED, fontSize: 11 }}>
                            📘 {alert.subject} → {alert.topic || alert.lesson || "—"}
                          </span>
                        )}
                      </div>
                      {alert.content_snippet && (
                        <p style={{
                          color: MUTED, fontSize: 11, margin: "8px 0 0",
                          padding: "8px 10px", background: "rgba(255,255,255,0.02)",
                          borderRadius: 6, border: `1px solid ${BORDER}`,
                           wordBreak: "break-all",
                          maxHeight: 60, overflow: "hidden",
                        }}>
                          {alert.content_snippet}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Top stat row */}
        <div style={{ display: "flex", gap: 16, marginBottom: 32 }}>
          <StatCard label="Total Students" value={students.length} color={ACCENT} sub="Registered in system" />
          <StatCard label="Selected Student" value={selectedStudent?.name || "—"} color="#10b981" sub={selectedStudent?.email || "None selected"} />
          <StatCard label="Active Subject" value={selectedSubject || "—"} color="#a855f7" sub={selectedSubject ? `${topicDetails.length} topics` : "Not selected"} />
          <StatCard
            label="Completion"
            value={lessonProgress ? `${lessonProgress.percentage}%` : "—"}
            color={lessonProgress?.percentage >= 75 ? "#10b981" : lessonProgress?.percentage >= 40 ? "#fbbf24" : "#ef4444"}
            sub={lessonProgress ? `${lessonProgress.completed_lessons} / ${lessonProgress.total_lessons} lessons` : "No data"}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 24 }}>

          {/* ── Students List ── */}
          <div style={{
            background: CARD, borderRadius: 16, border: `1px solid ${BORDER}`,
            overflow: "hidden", height: "fit-content",
          }}>
            <div style={{ padding: "20px 20px 14px", borderBottom: `1px solid ${BORDER}` }}>
              <p style={{ color: TEXT2, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 12px" }}>
                Students ({students.length})
              </p>
              {/* Search */}
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: MUTED }}>🔍</span>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search students..."
                  style={{
                    width: "100%", padding: "8px 10px 8px 30px",
                    background: "#0f172a", border: `1px solid ${BORDER}`,
                    borderRadius: 8, color: TEXT, fontSize: 12,
                    outline: "none", boxSizing: "border-box",
                  }}
                />
              </div>
            </div>

            <div style={{ padding: "8px 10px", maxHeight: 460, overflowY: "auto" }}>
              {loading && (
                <p style={{ color: TEXT2, fontSize: 12, textAlign: "center", padding: 20 }}>Loading…</p>
              )}
              {filteredStudents.map((s) => {
                const isSelected = selectedStudent?.student_id === s.student_id;
                return (
                  <div
                    key={s.student_id}
                    onClick={() => handleSelectStudent(s)}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "11px 12px", borderRadius: 10, cursor: "pointer",
                      background: isSelected ? `rgba(59,130,246,0.12)` : "transparent",
                      border: `1px solid ${isSelected ? "rgba(59,130,246,0.35)" : "transparent"}`,
                      transition: "all 0.15s", marginBottom: 2,
                    }}
                  >
                    <div style={{
                      width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
                      background: isSelected ? `linear-gradient(135deg, ${ACCENT}, #1d4ed8)` : "#1e293b",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      boxShadow: isSelected ? `0 0 12px rgba(59,130,246,0.4)` : "none",
                    }}>
                      <span style={{ color: isSelected ? "white" : TEXT2, fontWeight: 700, fontSize: 13 }}>
                        {s.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ color: isSelected ? TEXT : "#cbd5e1", fontWeight: 600, fontSize: 13, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {s.name}
                      </p>
                      <p style={{ color: MUTED, fontSize: 11, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {s.email}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Right Panel ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>

            {/* Empty state */}
            {!selectedStudent && (
              <div style={{
                background: CARD, borderRadius: 16, border: `1px solid ${BORDER}`,
                padding: "80px 40px", textAlign: "center",
              }}>
                <div style={{
                  width: 64, height: 64, borderRadius: "50%", margin: "0 auto 20px",
                  background: "rgba(59,130,246,0.1)", border: `1px solid rgba(59,130,246,0.2)`,
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28,
                }}>
                  👤
                </div>
                <p style={{ color: TEXT, fontSize: 16, fontWeight: 600, margin: "0 0 8px" }}>No student selected</p>
                <p style={{ color: TEXT2, fontSize: 13, margin: 0 }}>Select a student from the list to view their learning analytics</p>
              </div>
            )}

            {/* Student header + subjects */}
            {selectedStudent && (
              <div style={{ background: CARD, borderRadius: 16, border: `1px solid ${BORDER}`, overflow: "hidden" }}>
                {/* Student hero */}
                <div style={{
                  padding: "24px 28px",
                  background: `linear-gradient(135deg, rgba(59,130,246,0.08) 0%, transparent 100%)`,
                  borderBottom: `1px solid ${BORDER}`,
                  display: "flex", alignItems: "center", gap: 18,
                }}>
                  <div style={{
                    width: 52, height: 52, borderRadius: 14, flexShrink: 0,
                    background: `linear-gradient(135deg, ${ACCENT}, #1d4ed8)`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 22, fontWeight: 800, color: "white",
                    boxShadow: `0 0 20px rgba(59,130,246,0.35)`,
                  }}>
                    {selectedStudent.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p style={{ color: TEXT2, fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 4px" }}>Student</p>
                    <h2 style={{ color: TEXT, fontSize: 22, fontWeight: 800, margin: "0 0 2px" }}>{selectedStudent.name}</h2>
                    <p style={{ color: MUTED, fontSize: 12, margin: 0 }}>{selectedStudent.email}</p>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
                    <button
                      onClick={() => fetchParentInfo(selectedStudent.student_id)}
                      style={{
                        padding: "8px 14px", borderRadius: 10, border: `1px solid ${BORDER}`,
                        background: "rgba(255,255,255,0.04)", color: TEXT2, cursor: "pointer",
                        fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 6,
                        transition: "all 0.15s",
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.08)"}
                      onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.04)"}
                    >
                      👨‍👩‍👧 View Parent
                    </button>
                    <button
                      onClick={() => { setFeedbackModal(true); setFeedbackMsg(""); setFeedbackStatus(""); }}
                      style={{
                        padding: "8px 14px", borderRadius: 10, border: "none",
                        background: ACCENT, color: "white", cursor: "pointer",
                        fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 6,
                        transition: "all 0.15s",
                      }}
                    >
                      📝 Send Feedback
                    </button>
                  </div>
                </div>

                {/* Subjects */}
                <div style={{ padding: "20px 28px" }}>
                  <p style={{ color: TEXT2, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 14px" }}>
                    Enrolled Subjects
                  </p>
                  {subjects.length === 0 ? (
                    <p style={{ color: MUTED, fontSize: 13 }}>No activity found for this student.</p>
                  ) : (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                      {subjects.map((sub) => {
                        const meta = subjectMeta[sub] || { color: ACCENT, glow: "rgba(59,130,246,0.15)", icon: "📚" };
                        const isSelected = selectedSubject === sub;
                        return (
                          <div
                            key={sub}
                            onClick={() => handleSelectSubject(sub)}
                            onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = meta.glow; }}
                            onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                            style={{
                              display: "flex", alignItems: "center", gap: 8,
                              padding: "9px 18px", borderRadius: 10, cursor: "pointer",
                              background: isSelected ? meta.glow : "rgba(255,255,255,0.04)",
                              border: `1.5px solid ${isSelected ? meta.color : BORDER}`,
                              transition: "all 0.15s",
                              boxShadow: isSelected ? `0 0 12px ${meta.color}30` : "none",
                            }}
                          >
                            <span style={{ fontSize: 14 }}>{meta.icon}</span>
                            <span style={{ color: isSelected ? meta.color : TEXT2, fontSize: 13, fontWeight: 600 }}>{sub}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Improvement Trend (pre-quiz → post-quiz) */}
            {improvement && (
              <div style={{ background: CARD, borderRadius: 16, border: `1px solid ${BORDER}`, overflow: "hidden" }}>
                <div style={{ padding: "20px 28px 18px", borderBottom: `1px solid ${BORDER}` }}>
                  <p style={{ color: TEXT2, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 4px" }}>
                    Improvement Trend
                  </p>
                  <p style={{ color: TEXT, fontSize: 13, margin: 0 }}>
                    Pre-quiz &rarr; post-quiz score change {selectedSubject ? `in ${selectedSubject}` : "across all subjects"}
                  </p>
                </div>
                <div style={{ padding: "24px 28px" }}>
                  {improvement.count === 0 ? (
                    <p style={{ color: MUTED, fontSize: 13, margin: 0 }}>
                      No completed pre + post quiz pairs yet for this {selectedSubject ? "subject" : "student"}.
                    </p>
                  ) : (
                    <>
                      <div style={{ display: "flex", gap: 20, marginBottom: 22 }}>
                        <div style={{ flex: 1, background: "#0f172a", borderRadius: 12, padding: "16px 20px", border: `1px solid ${BORDER}`, textAlign: "center" }}>
                          <p style={{
                            color: improvement.average_improvement > 0 ? "#34d399" : improvement.average_improvement < 0 ? "#f87171" : TEXT2,
                            fontSize: 30, fontWeight: 800, margin: 0,
                          }}>
                            {improvement.average_improvement > 0 ? "+" : ""}{improvement.average_improvement}
                          </p>
                          <p style={{ color: TEXT2, fontSize: 11, margin: "4px 0 0" }}>Avg. Improvement</p>
                        </div>
                        <div style={{ flex: 1, background: "#0f172a", borderRadius: 12, padding: "16px 20px", border: `1px solid ${BORDER}`, textAlign: "center" }}>
                          <p style={{ color: TEXT2, fontSize: 30, fontWeight: 800, margin: 0 }}>{improvement.count}</p>
                          <p style={{ color: TEXT2, fontSize: 11, margin: "4px 0 0" }}>Topics Compared</p>
                        </div>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {improvement.topics.map((t, i) => {
                          const delta = t.improvement;
                          const dColor = delta > 0 ? "#34d399" : delta < 0 ? "#f87171" : MUTED;
                          const dBg = delta > 0 ? "rgba(52,211,153,0.1)" : delta < 0 ? "rgba(248,113,113,0.1)" : "rgba(255,255,255,0.04)";
                          return (
                            <div key={i} style={{
                              display: "flex", alignItems: "center", justifyContent: "space-between",
                              padding: "10px 14px", borderRadius: 10, background: "#0f172a", border: `1px solid ${BORDER}`,
                            }}>
                              <div style={{ minWidth: 0 }}>
                                <p style={{ color: TEXT, fontSize: 13, fontWeight: 600, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {t.topic}
                                </p>
                                <p style={{ color: MUTED, fontSize: 11, margin: "2px 0 0" }}>
                                  {t.subject} &middot; {t.lesson} &middot; {t.initial_quiz_marks} &rarr; {t.final_quiz_marks}
                                </p>
                              </div>
                              <span style={{
                                background: dBg, color: dColor, fontWeight: 700, fontSize: 12,
                                padding: "4px 12px", borderRadius: 20, flexShrink: 0, marginLeft: 12,
                              }}>
                                {delta > 0 ? "+" : ""}{delta}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Lesson Progress */}
            {lessonProgress && sm && (
              <div style={{ background: CARD, borderRadius: 16, border: `1px solid ${BORDER}`, overflow: "hidden" }}>
                <div style={{
                  padding: "20px 28px 18px",
                  background: `linear-gradient(135deg, ${sm.glow} 0%, transparent 100%)`,
                  borderBottom: `1px solid ${BORDER}`,
                }}>
                  <p style={{ color: TEXT2, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 4px" }}>
                    Lesson Progress
                  </p>
                  <p style={{ color: sm.color, fontSize: 16, fontWeight: 700, margin: 0 }}>{selectedSubject}</p>
                </div>
                <div style={{ padding: "24px 28px" }}>
                  <div style={{ display: "flex", gap: 20, marginBottom: 24 }}>
                    {[
                      { label: "Completed", value: lessonProgress.completed_lessons, color: sm.color },
                      { label: "Total Lessons", value: lessonProgress.total_lessons, color: TEXT2 },
                      { label: "Completion", value: `${lessonProgress.percentage}%`, color: lessonProgress.percentage >= 75 ? "#10b981" : lessonProgress.percentage >= 40 ? "#fbbf24" : "#ef4444" },
                    ].map((s, i) => (
                      <div key={i} style={{
                        flex: 1, background: "#0f172a", borderRadius: 12, padding: "16px 20px",
                        border: `1px solid ${BORDER}`, textAlign: "center",
                      }}>
                        <p style={{ color: s.color, fontSize: 30, fontWeight: 800, margin: 0 }}>{s.value}</p>
                        <p style={{ color: TEXT2, fontSize: 11, margin: "4px 0 0" }}>{s.label}</p>
                      </div>
                    ))}
                  </div>
                  <ProgressBar pct={lessonProgress.percentage} color={sm.color} />
                </div>
              </div>
            )}

            {/* Topic Details */}
            {topicDetails.length > 0 && (
              <div style={{ background: CARD, borderRadius: 16, border: `1px solid ${BORDER}`, overflow: "hidden" }}>
                <div style={{ padding: "20px 28px", borderBottom: `1px solid ${BORDER}` }}>
                  <p style={{ color: TEXT2, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", margin: 0 }}>
                    Topic Details · {topicDetails.length} topics
                  </p>
                </div>
                <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
                  {topicDetails.map((t, i) => {
                    const isExpanded = expandedTopic === i;
                    const lc = levelBadge[t.level] || levelBadge["Beginner"];
                    return (
                      <div key={i} style={{
                        borderRadius: 12, overflow: "hidden",
                        border: `1px solid ${isExpanded ? (sm?.color || ACCENT) : BORDER}`,
                        transition: "border-color 0.2s",
                        boxShadow: isExpanded ? `0 0 16px ${sm?.color || ACCENT}20` : "none",
                      }}>
                        {/* Topic row */}
                        <div
                          onClick={async () => {
                            const next = isExpanded ? null : i;
                            setExpandedTopic(next);
                            if (next !== null) {
                              try {
                                const params = { student_id: selectedStudent.student_id, subject: selectedSubject, topic: t.topic };
                                const [engRes, qaRes, ytRes] = await Promise.all([
                                  !engagementData[i] ? axios.get(`${API}/engagement-history`, { params }) : null,
                                  !qaData[i] ? axios.get(`${API}/admin/student-qa`, { params }) : null,
                                  !youtubeData[i] ? axios.get(`${API}/admin/youtube-history`, { params }) : null,
                                ]);
                                if (engRes) setEngagementData(prev => ({ ...prev, [i]: engRes.data.sessions }));
                                if (qaRes) setQaData(prev => ({ ...prev, [i]: qaRes.data.qa }));
                                if (ytRes) setYoutubeData(prev => ({ ...prev, [i]: ytRes.data.sessions }));
                              } catch (_) {}
                            }
                          }}
                          onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
                          onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = isExpanded ? "rgba(255,255,255,0.04)" : "#131c2e"; }}
                          style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            padding: "16px 20px", cursor: "pointer",
                            background: isExpanded ? "rgba(255,255,255,0.04)" : "#131c2e",
                            transition: "background 0.15s",
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <p style={{ color: TEXT, fontWeight: 600, fontSize: 14, margin: 0 }}>{t.topic}</p>
                            <p style={{ color: MUTED, fontSize: 12, margin: "3px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.lesson}</p>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, marginLeft: 12 }}>
                            {t.level && (
                              <span style={{ background: lc.bg, color: lc.color, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                                {t.level}
                              </span>
                            )}
                            <span style={{
                              background: t.topic_unlocked ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
                              color: t.topic_unlocked ? "#34d399" : "#f87171",
                              padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                            }}>
                              {t.topic_unlocked ? "✓ Unlocked" : "✗ Locked"}
                            </span>
                            <span style={{ color: TEXT2, fontSize: 12, marginLeft: 4 }}>{isExpanded ? "▲" : "▼"}</span>
                          </div>
                        </div>

                        {/* Expanded content */}
                        {isExpanded && (
                          <div style={{ padding: "20px 20px 24px", borderTop: `1px solid ${BORDER}`, background: "#0c1526" }}>

                            {/* Quiz scores */}
                            <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
                              {[
                                { label: "Initial Quiz", value: t.initial_quiz_marks, color: "#fbbf24", bg: "rgba(251,191,36,0.08)" },
                                { label: "Final Quiz",   value: t.final_quiz_marks,   color: ACCENT,    bg: "rgba(59,130,246,0.08)" },
                              ].map((q, qi) => (
                                <div key={qi} style={{
                                  flex: 1, background: q.bg, borderRadius: 12,
                                  padding: "16px 20px", border: `1px solid ${q.color}20`,
                                }}>
                                  <p style={{ color: TEXT2, fontSize: 11, margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.08em" }}>{q.label}</p>
                                  <p style={{ color: q.color, fontSize: 30, fontWeight: 800, margin: 0, lineHeight: 1 }}>
                                    {q.value ?? "—"}<span style={{ fontSize: 13, color: MUTED, fontWeight: 400 }}>/10</span>
                                  </p>
                                  {q.value != null && (
                                    <div style={{ marginTop: 10 }}>
                                      <ProgressBar pct={(q.value / 10) * 100} color={q.color} />
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>

                            {/* Delivered content */}
                            {t.delivered_content && (
                              <div style={{ marginBottom: 20 }}>
                                <p style={{ color: TEXT2, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 10px" }}>
                                  Delivered Lesson Content
                                </p>
                                <div style={{
                                  background: CARD, border: `1px solid ${BORDER}`,
                                  borderRadius: 10, padding: "14px 18px",
                                  fontSize: 13, color: "#94a3b8",
                                  maxHeight: 180, overflowY: "auto",
                                  whiteSpace: "pre-wrap", lineHeight: 1.75,
                                }}>
                                  {t.delivered_content}
                                </div>
                              </div>
                            )}

                            {/* Engagement sessions */}
                            {(engagementData[i] || []).length > 0 && (
                              <div style={{ marginBottom: 20 }}>
                                <p style={{ color: TEXT2, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 12px" }}>
                                  Engagement Sessions
                                </p>
                                {(engagementData[i] || []).map((session, si) => {
                                  const scoreColor = session.avg_score >= 75 ? "#34d399" : session.avg_score >= 50 ? "#fbbf24" : "#f87171";
                                  return (
                                    <div key={si} style={{
                                      background: CARD, border: `1px solid ${BORDER}`,
                                      borderRadius: 12, padding: "16px 18px", marginBottom: 10,
                                    }}>
                                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                                        <p style={{ color: MUTED, fontSize: 12, margin: 0 }}>
                                          {new Date(session.started_at).toLocaleString()} · {Math.round(session.duration_seconds / 60)}m
                                        </p>
                                        <div style={{ display: "flex", gap: 8 }}>
                                          {[
                                            { label: "Avg", value: session.avg_score, color: scoreColor },
                                            { label: "Min", value: session.min_score, color: "#f87171" },
                                            { label: "Max", value: session.max_score, color: "#34d399" },
                                          ].map((s, k) => (
                                            <span key={k} style={{
                                              background: "rgba(255,255,255,0.04)", borderRadius: 8,
                                              padding: "4px 10px", fontSize: 11, color: s.color, fontWeight: 700,
                                              border: `1px solid rgba(255,255,255,0.06)`,
                                            }}>
                                              {s.label}: {s.value}%
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                      <div style={{ display: "flex", alignItems: "flex-end", gap: 1, height: 44 }}>
                                        {(session.timeline || []).map((pt, pi) => {
                                          const h = Math.max(3, (pt.score / 100) * 44);
                                          const c = pt.score >= 75 ? "#34d399" : pt.score >= 50 ? "#fbbf24" : "#f87171";
                                          return (
                                            <div key={pi} title={`${pt.time}: ${pt.score}%`} style={{
                                              flex: 1, height: h, background: c,
                                              borderRadius: "2px 2px 0 0", opacity: 0.75,
                                            }} />
                                          );
                                        })}
                                      </div>
                                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                                        <span style={{ fontSize: 9, color: MUTED }}>Start</span>
                                        <span style={{ fontSize: 9, color: MUTED }}>End</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* YouTube watch history */}
                            {(youtubeData[i] || []).length > 0 && (
                              <div style={{ marginBottom: 20 }}>
                                <p style={{ color: TEXT2, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 12px" }}>
                                  YouTube Watch History
                                </p>
                                {(youtubeData[i] || []).map((session, yi) => (
                                  <div key={yi} style={{
                                    background: CARD, border: `1px solid ${BORDER}`,
                                    borderRadius: 12, padding: "14px 18px", marginBottom: 10,
                                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                                  }}>
                                    <div style={{ minWidth: 0 }}>
                                      <a
                                        href={session.video_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{ color: ACCENT, fontWeight: 600, fontSize: 13, textDecoration: "none" }}
                                      >
                                        📺 {session.video_title}
                                      </a>
                                      <p style={{ color: MUTED, fontSize: 11, margin: "4px 0 0" }}>
                                        {new Date(session.started_at).toLocaleString()}
                                      </p>
                                    </div>
                                    <span style={{
                                      background: "rgba(255,255,255,0.04)", borderRadius: 8,
                                      padding: "4px 10px", fontSize: 11, color: TEXT, fontWeight: 700,
                                      border: `1px solid rgba(255,255,255,0.06)`, flexShrink: 0,
                                    }}>
                                      {Math.floor(session.watched_seconds / 60)}:{String(session.watched_seconds % 60).padStart(2, "0")}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Q&A */}
                            {(qaData[i] || []).length > 0 && (
                              <div>
                                <p style={{ color: TEXT2, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 12px" }}>
                                  Student Q&amp;A
                                </p>
                                {(qaData[i] || []).map((qa, qi) => (
                                  <div key={qi} style={{
                                    background: CARD, border: `1px solid ${BORDER}`,
                                    borderRadius: 12, padding: "14px 18px", marginBottom: 10,
                                  }}>
                                    <p style={{ color: MUTED, fontSize: 10, margin: "0 0 10px" }}>
                                      {new Date(qa.asked_at).toLocaleString()}
                                    </p>
                                    <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
                                      <span style={{ color: ACCENT, fontWeight: 700, fontSize: 12, flexShrink: 0 }}>Q</span>
                                      <p style={{ color: TEXT, fontSize: 13, fontWeight: 600, margin: 0 }}>{qa.question}</p>
                                    </div>
                                    <div style={{ display: "flex", gap: 10 }}>
                                      <span style={{ color: "#34d399", fontWeight: 700, fontSize: 12, flexShrink: 0 }}>A</span>
                                      <p style={{ color: "#94a3b8", fontSize: 13, margin: 0, lineHeight: 1.7 }}>{qa.answer}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ── Parent Details Modal ── */}
      {parentModal && (
        <div
          onClick={() => setParentModal(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: CARD, borderRadius: 20, border: `1px solid ${BORDER}`,
              padding: "32px 36px", width: 460, maxWidth: "90vw",
              boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 20 }}>👨‍👩‍👧</span>
                <h3 style={{ color: TEXT, fontSize: 18, fontWeight: 700, margin: 0 }}>Parent Details</h3>
              </div>
              <button
                onClick={() => setParentModal(false)}
                style={{ background: "none", border: "none", color: MUTED, fontSize: 20, cursor: "pointer" }}
              >✕</button>
            </div>

            {parentInfo?.has_parent ? (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                  {[
                    { label: "Name", value: parentInfo.parent_name },
                    { label: "Contact", value: parentInfo.parent_contact || "Not provided" },
                    { label: "Email", value: parentInfo.parent_email },
                  ].map(({ label, value }) => (
                    <div key={label} style={{
                      padding: "12px 14px", borderRadius: 10, background: "#0f172a", border: `1px solid ${BORDER}`,
                    }}>
                      <p style={{ color: TEXT2, fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 4px" }}>{label}</p>
                      <p style={{ color: TEXT, fontSize: 13, fontWeight: 600, margin: 0 }}>{value || "—"}</p>
                    </div>
                  ))}
                </div>

                <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 20 }}>
                  <p style={{ color: TEXT2, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 10px" }}>Send Message to Parent</p>
                  <textarea
                    value={parentMsg}
                    onChange={e => setParentMsg(e.target.value)}
                    placeholder="Type your message here..."
                    rows={3}
                    style={{
                      width: "100%", padding: "10px 14px", borderRadius: 10, fontSize: 13,
                      background: "#0f172a", border: `1px solid ${BORDER}`, color: TEXT,
                      outline: "none", resize: "vertical", boxSizing: "border-box",
                    }}
                  />
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10 }}>
                    <button
                      onClick={sendParentMessage}
                      disabled={!parentMsg.trim() || parentMsgStatus === "sending"}
                      style={{
                        padding: "8px 20px", borderRadius: 10, border: "none",
                        background: parentMsg.trim() && parentMsgStatus !== "sending" ? ACCENT : "#334155",
                        color: "white", fontWeight: 600, fontSize: 12, cursor: parentMsg.trim() ? "pointer" : "not-allowed",
                      }}
                    >
                      {parentMsgStatus === "sending" ? "Sending..." : "Send Message"}
                    </button>
                    {parentMsgStatus === "sent" && <span style={{ color: "#34d399", fontSize: 12, fontWeight: 600 }}>✓ Message sent!</span>}
                    {parentMsgStatus === "error" && <span style={{ color: "#f87171", fontSize: 12, fontWeight: 600 }}>Failed to send</span>}
                  </div>
                </div>
              </>
            ) : (
              <div style={{ textAlign: "center", padding: "30px 0" }}>
                <div style={{
                  width: 52, height: 52, borderRadius: "50%", margin: "0 auto 14px",
                  background: "rgba(100,116,139,0.15)", display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 22,
                }}>👤</div>
                <p style={{ color: TEXT, fontSize: 14, fontWeight: 600, margin: "0 0 4px" }}>No parent linked</p>
                <p style={{ color: MUTED, fontSize: 12, margin: 0 }}>This student's parent has not linked their account yet via the mobile app.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Send Feedback Modal ── */}
      {feedbackModal && selectedStudent && (
        <div
          onClick={() => setFeedbackModal(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: CARD, borderRadius: 20, border: `1px solid ${BORDER}`,
              padding: "32px 36px", width: 480, maxWidth: "90vw",
              boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 20 }}>📝</span>
                <h3 style={{ color: TEXT, fontSize: 18, fontWeight: 700, margin: 0 }}>Send Feedback</h3>
              </div>
              <button
                onClick={() => setFeedbackModal(false)}
                style={{ background: "none", border: "none", color: MUTED, fontSize: 20, cursor: "pointer" }}
              >✕</button>
            </div>

            <p style={{ color: TEXT2, fontSize: 12, margin: "0 0 16px" }}>
              Sending feedback to <strong style={{ color: TEXT }}>{selectedStudent.name}</strong>
              {selectedSubject ? <> for <strong style={{ color: TEXT }}>{selectedSubject}</strong></> : ""}
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div style={{ padding: "10px 14px", borderRadius: 10, background: "#0f172a", border: `1px solid ${BORDER}` }}>
                <p style={{ color: TEXT2, fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 4px" }}>Subject</p>
                <p style={{ color: TEXT, fontSize: 13, fontWeight: 600, margin: 0 }}>{selectedSubject || "General"}</p>
              </div>
              <div style={{ padding: "10px 14px", borderRadius: 10, background: "#0f172a", border: `1px solid ${BORDER}` }}>
                <p style={{ color: TEXT2, fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 4px" }}>Lesson/Topic</p>
                <p style={{ color: TEXT, fontSize: 13, fontWeight: 600, margin: 0 }}>{expandedTopic?.lesson || expandedTopic?.topic || "—"}</p>
              </div>
            </div>

            <textarea
              value={feedbackMsg}
              onChange={e => setFeedbackMsg(e.target.value)}
              placeholder="Write your feedback for the student..."
              rows={4}
              style={{
                width: "100%", padding: "12px 14px", borderRadius: 10, fontSize: 13,
                background: "#0f172a", border: `1px solid ${BORDER}`, color: TEXT,
                outline: "none", resize: "vertical", boxSizing: "border-box",
              }}
            />

            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14 }}>
              <button
                onClick={sendStudentFeedback}
                disabled={!feedbackMsg.trim() || feedbackStatus === "sending"}
                style={{
                  padding: "10px 24px", borderRadius: 10, border: "none",
                  background: feedbackMsg.trim() && feedbackStatus !== "sending" ? ACCENT : "#334155",
                  color: "white", fontWeight: 600, fontSize: 13, cursor: feedbackMsg.trim() ? "pointer" : "not-allowed",
                }}
              >
                {feedbackStatus === "sending" ? "Sending..." : "Send Feedback"}
              </button>
              {feedbackStatus === "sent" && <span style={{ color: "#34d399", fontSize: 12, fontWeight: 600 }}>✓ Feedback sent! Student will see it in their notifications.</span>}
              {feedbackStatus === "error" && <span style={{ color: "#f87171", fontSize: 12, fontWeight: 600 }}>Failed to send</span>}
            </div>
          </div>
        </div>
      )}

      <style>{`
        * { box-sizing: border-box; }
        input::placeholder { color: #475569; }
        textarea::placeholder { color: #475569; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #334155; border-radius: 99px; }
        ::-webkit-scrollbar-thumb:hover { background: #475569; }
      `}</style>
    </div>
  );
}
