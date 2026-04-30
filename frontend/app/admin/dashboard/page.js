"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";

const API = "http://localhost:8000";

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
  const [loading, setLoading] = useState(false);
  const [hoveredStudent, setHoveredStudent] = useState(null);

  useEffect(() => {
    const role = localStorage.getItem("role");
    const name = localStorage.getItem("name");
    if (role !== "admin") { router.push("/"); return; }
    setAdminName(name || "Admin");
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/admin/students`);
      setStudents(res.data.students);
    } catch (err) {
      console.error("Failed to load students", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectStudent = async (student) => {
    setSelectedStudent(student);
    setSelectedSubject(null);
    setLessonProgress(null);
    setTopicDetails([]);
    setExpandedTopic(null);
    try {
      const res = await axios.get(`${API}/admin/student-subjects`, {
        params: { student_id: student.student_id }
      });
      setSubjects(res.data.subjects);
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
      const [progressRes, topicsRes] = await Promise.all([
        axios.get(`${API}/admin/lesson-progress`, {
          params: { student_id: selectedStudent.student_id, subject }
        }),
        axios.get(`${API}/admin/topic-details`, {
          params: { student_id: selectedStudent.student_id, subject }
        })
      ]);
      setLessonProgress(progressRes.data);
      setTopicDetails(topicsRes.data.topics);
    } catch (err) {
      console.error("Failed to load subject details", err);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    router.push("/");
  };

  const subjectColors = {
    Physics:   { accent: "#2563eb", bg: "#eff6ff" },
    Chemistry: { accent: "#16a34a", bg: "#f0fdf4" },
    Biology:   { accent: "#059669", bg: "#ecfdf5" },
    Maths:     { accent: "#9333ea", bg: "#faf5ff" },
  };

  const levelConfig = {
    Advanced:     { bg: "#f5f3ff", color: "#7c3aed" },
    Intermediate: { bg: "#fffbeb", color: "#d97706" },
    Beginner:     { bg: "#f0fdf4", color: "#16a34a" },
  };

  return (
    <div style={{
      display: "flex", minHeight: "100vh",
      width: "100vw", margin: 0, padding: 0
    }}>

      {/* ── Sidebar ── */}
      <div style={{
        backgroundColor: "#0a0f1e",
        width: "210px", minWidth: "210px",
        minHeight: "100vh",
        display: "flex", flexDirection: "column",
        justifyContent: "space-between",
        padding: 0, margin: 0, flexShrink: 0,
        borderRight: "1px solid #1e293b",
      }}>

        {/* Top */}
        <div>
          {/* Logo */}
          <div style={{ padding: "24px 20px 20px", borderBottom: "1px solid #1e293b" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
                width: 34, height: 34, borderRadius: 10,
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 4px 12px rgba(37,99,235,0.4)", flexShrink: 0
              }}>
                <span style={{ color: "white", fontWeight: 800, fontSize: 11 }}>IDS</span>
              </div>
              <div>
                <p style={{ color: "white", fontWeight: 700, fontSize: 13, margin: 0 }}>
                  IDS Platform
                </p>
                <p style={{ color: "#334155", fontSize: 10, margin: 0, letterSpacing: 0.5 }}>
                  ADMIN PANEL
                </p>
              </div>
            </div>
          </div>

          {/* Nav */}
          <div style={{ padding: "16px 12px 8px" }}>
            <p style={{
              color: "#334155", fontSize: 9, fontWeight: 700,
              letterSpacing: "0.12em", textTransform: "uppercase",
              marginBottom: 8, paddingLeft: 8
            }}>
              Main Menu
            </p>
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 12px", borderRadius: 10,
              backgroundColor: "rgba(37,99,235,0.15)",
              borderLeft: "3px solid #2563eb",
            }}>
              <span style={{ color: "#2563eb", fontSize: 16, width: 20, textAlign: "center" }}>⊞</span>
              <p style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 600, margin: 0 }}>
                Dashboard
              </p>
            </div>
          </div>

          {/* Divider */}
          <div style={{ margin: "8px 12px", borderTop: "1px solid #1e293b" }} />

          {/* Stats */}
          <div style={{ padding: "8px 12px" }}>
            <p style={{
              color: "#334155", fontSize: 9, fontWeight: 700,
              letterSpacing: "0.12em", textTransform: "uppercase",
              marginBottom: 8, paddingLeft: 8
            }}>
              Overview
            </p>
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "9px 12px", borderRadius: 10,
              backgroundColor: "rgba(255,255,255,0.03)",
              border: "1px solid #1e293b",
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                backgroundColor: "rgba(37,99,235,0.15)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <span style={{ fontSize: 13 }}>👥</span>
              </div>
              <div>
                <p style={{ color: "#94a3b8", fontSize: 10, margin: 0 }}>Total Students</p>
                <p style={{ color: "white", fontSize: 14, fontWeight: 700, margin: 0 }}>
                  {students.length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div>
          <div style={{ margin: "0 12px 12px", borderTop: "1px solid #1e293b" }} />

          {/* Admin User Card */}
          <div style={{
            margin: "0 12px 8px", padding: "12px 14px",
            backgroundColor: "rgba(255,255,255,0.03)",
            borderRadius: 12, border: "1px solid #1e293b",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 10,
                background: "linear-gradient(135deg, #1e3a5f, #1e293b)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, border: "1px solid #2d3f55"
              }}>
                <span style={{ color: "#60a5fa", fontWeight: 700, fontSize: 14 }}>
                  {adminName.charAt(0).toUpperCase()}
                </span>
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{
                  color: "#e2e8f0", fontSize: 12, fontWeight: 600,
                  margin: 0, whiteSpace: "nowrap",
                  overflow: "hidden", textOverflow: "ellipsis"
                }}>
                  {adminName}
                </p>
                <p style={{ color: "#334155", fontSize: 10, margin: 0 }}>Administrator</p>
              </div>
            </div>
          </div>

          {/* Logout */}
          <div
            onClick={handleLogout}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              margin: "0 12px 20px", padding: "10px 14px",
              borderRadius: 10, cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(239,68,68,0.1)"}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
          >
            <span style={{ color: "#ef4444", fontSize: 14 }}>→</span>
            <span style={{ color: "#ef4444", fontSize: 12, fontWeight: 500 }}>Sign Out</span>
          </div>
        </div>
      </div>

      {/* ── Main Content ── */}
      <main style={{
        flex: 1, backgroundColor: "#f8fafc",
        padding: "40px 48px", minWidth: 0, overflowY: "auto"
      }}>

        {/* Header */}
        <div style={{ marginBottom: 36 }}>
          <p style={{
            color: "#94a3b8", fontSize: 11, fontWeight: 600,
            letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 8
          }}>
            Admin Panel
          </p>
          <h1 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 36, fontWeight: 700, color: "#0f172a"
          }}>
            Student Analytics
          </h1>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 24 }}>

          {/* ── Students Panel ── */}
          <div style={{
            backgroundColor: "white", borderRadius: 16,
            padding: "24px 16px",
            boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
            border: "1px solid #f1f5f9",
            height: "fit-content"
          }}>
            <p style={{
              color: "#94a3b8", fontSize: 11, fontWeight: 600,
              letterSpacing: "0.1em", textTransform: "uppercase",
              marginBottom: 16, paddingLeft: 8
            }}>
              Registered Students ({students.length})
            </p>

            {loading && (
              <p style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", padding: 20 }}>
                Loading...
              </p>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {students.map((s) => {
                const isSelected = selectedStudent?.student_id === s.student_id;
                return (
                  <div
                    key={s.student_id}
                    onClick={() => handleSelectStudent(s)}
                    onMouseEnter={() => setHoveredStudent(s.student_id)}
                    onMouseLeave={() => setHoveredStudent(null)}
                    style={{
                      padding: "12px 14px", borderRadius: 10, cursor: "pointer",
                      backgroundColor: isSelected ? "#eff6ff"
                        : hoveredStudent === s.student_id ? "#f8fafc" : "transparent",
                      border: `1.5px solid ${isSelected ? "#2563eb" : "transparent"}`,
                      transition: "all 0.15s"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: "50%",
                        backgroundColor: isSelected ? "#2563eb" : "#f1f5f9",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0
                      }}>
                        <span style={{
                          color: isSelected ? "white" : "#64748b",
                          fontWeight: 700, fontSize: 12
                        }}>
                          {s.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <p style={{
                          color: "#0f172a", fontWeight: 600, fontSize: 13,
                          margin: 0, whiteSpace: "nowrap",
                          overflow: "hidden", textOverflow: "ellipsis"
                        }}>
                          {s.name}
                        </p>
                        <p style={{
                          color: "#94a3b8", fontSize: 11, margin: 0,
                          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"
                        }}>
                          {s.email}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Right Panel ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* No student selected */}
            {!selectedStudent && (
              <div style={{
                backgroundColor: "white", borderRadius: 16,
                padding: "60px 40px", textAlign: "center",
                boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                border: "1px solid #f1f5f9"
              }}>
                <p style={{ fontSize: 40, marginBottom: 12 }}>👈</p>
                <p style={{ color: "#64748b", fontSize: 15, fontWeight: 500 }}>
                  Select a student to view their progress
                </p>
              </div>
            )}

            {/* Subjects */}
            {selectedStudent && (
              <div style={{
                backgroundColor: "white", borderRadius: 16, padding: "24px 28px",
                boxShadow: "0 1px 4px rgba(0,0,0,0.06)", border: "1px solid #f1f5f9"
              }}>
                <p style={{
                  color: "#94a3b8", fontSize: 11, fontWeight: 600,
                  letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4
                }}>
                  Student
                </p>
                <h2 style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: 22, fontWeight: 700, color: "#0f172a", marginBottom: 16
                }}>
                  {selectedStudent.name}
                </h2>

                {subjects.length === 0 ? (
                  <p style={{ color: "#94a3b8", fontSize: 13 }}>
                    No activity found for this student.
                  </p>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                    {subjects.map((sub) => {
                      const sc = subjectColors[sub] || { accent: "#2563eb", bg: "#eff6ff" };
                      const isSelected = selectedSubject === sub;
                      return (
                        <div
                          key={sub}
                          onClick={() => handleSelectSubject(sub)}
                          style={{
                            padding: "8px 18px", borderRadius: 20, cursor: "pointer",
                            backgroundColor: isSelected ? sc.accent : sc.bg,
                            color: isSelected ? "white" : sc.accent,
                            fontSize: 13, fontWeight: 600,
                            border: `1.5px solid ${isSelected ? sc.accent : "transparent"}`,
                            transition: "all 0.15s"
                          }}
                        >
                          {sub}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Lesson Progress */}
            {lessonProgress && (
              <div style={{
                backgroundColor: "white", borderRadius: 16, padding: "24px 28px",
                boxShadow: "0 1px 4px rgba(0,0,0,0.06)", border: "1px solid #f1f5f9"
              }}>
                <p style={{
                  color: "#94a3b8", fontSize: 11, fontWeight: 600,
                  letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16
                }}>
                  Lesson Progress — {selectedSubject}
                </p>

                <div style={{ display: "flex", alignItems: "center", gap: 40, marginBottom: 20 }}>
                  {[
                    { label: "Completed", value: lessonProgress.completed_lessons, color: "#2563eb" },
                    { label: "Total", value: lessonProgress.total_lessons, color: "#94a3b8" },
                    { label: "Progress", value: `${lessonProgress.percentage}%`, color: "#059669" },
                  ].map((stat, i) => (
                    <div key={i} style={{ textAlign: "center" }}>
                      <p style={{
                        fontFamily: "'Playfair Display', serif",
                        fontSize: 32, fontWeight: 700, color: stat.color, margin: 0
                      }}>
                        {stat.value}
                      </p>
                      <p style={{ color: "#94a3b8", fontSize: 12, margin: 0 }}>{stat.label}</p>
                    </div>
                  ))}
                </div>

                <div style={{ backgroundColor: "#f1f5f9", borderRadius: 99, height: 6 }}>
                  <div style={{
                    height: 6, borderRadius: 99, backgroundColor: "#2563eb",
                    width: `${lessonProgress.percentage}%`,
                    transition: "width 0.5s ease"
                  }} />
                </div>
              </div>
            )}

            {/* Topic Details */}
            {topicDetails.length > 0 && (
              <div style={{
                backgroundColor: "white", borderRadius: 16, padding: "24px 28px",
                boxShadow: "0 1px 4px rgba(0,0,0,0.06)", border: "1px solid #f1f5f9"
              }}>
                <p style={{
                  color: "#94a3b8", fontSize: 11, fontWeight: 600,
                  letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16
                }}>
                  Topic Details
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {topicDetails.map((t, i) => {
                    const isExpanded = expandedTopic === i;
                    const lc = levelConfig[t.level] || levelConfig["Beginner"];

                    return (
                      <div key={i} style={{
                        border: `1.5px solid ${isExpanded ? "#2563eb" : "#e2e8f0"}`,
                        borderRadius: 12, overflow: "hidden",
                        transition: "border 0.15s"
                      }}>

                        {/* Topic Header */}
                        <div
                          onClick={() => setExpandedTopic(isExpanded ? null : i)}
                          style={{
                            display: "flex", alignItems: "center",
                            justifyContent: "space-between",
                            padding: "16px 20px", cursor: "pointer",
                            backgroundColor: isExpanded ? "#f8fafc" : "white",
                            transition: "background 0.15s"
                          }}
                        >
                          <div>
                            <p style={{ color: "#0f172a", fontWeight: 600, fontSize: 14, margin: 0 }}>
                              {t.topic}
                            </p>
                            <p style={{ color: "#94a3b8", fontSize: 12, margin: 0, marginTop: 2 }}>
                              {t.lesson}
                            </p>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            {t.level && (
                              <span style={{
                                backgroundColor: lc.bg, color: lc.color,
                                padding: "3px 10px", borderRadius: 20,
                                fontSize: 11, fontWeight: 600
                              }}>
                                {t.level}
                              </span>
                            )}
                            <span style={{
                              backgroundColor: t.topic_unlocked ? "#f0fdf4" : "#fef2f2",
                              color: t.topic_unlocked ? "#16a34a" : "#dc2626",
                              padding: "3px 10px", borderRadius: 20,
                              fontSize: 11, fontWeight: 600
                            }}>
                              {t.topic_unlocked ? "✓ Unlocked" : "✗ Locked"}
                            </span>
                            <span style={{ color: "#94a3b8", fontSize: 14 }}>
                              {isExpanded ? "▲" : "▼"}
                            </span>
                          </div>
                        </div>

                        {/* Expanded */}
                        {isExpanded && (
                          <div style={{
                            padding: "20px 20px 24px",
                            borderTop: "1px solid #f1f5f9",
                            backgroundColor: "#fafafa"
                          }}>
                            {/* Quiz Scores */}
                            <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
                              {[
                                { label: "Initial Quiz", value: t.initial_quiz_marks, color: "#d97706", bg: "#fffbeb" },
                                { label: "Final Quiz", value: t.final_quiz_marks, color: "#2563eb", bg: "#eff6ff" },
                              ].map((q, qi) => (
                                <div key={qi} style={{
                                  flex: 1, backgroundColor: q.bg,
                                  borderRadius: 10, padding: "14px 18px"
                                }}>
                                  <p style={{ color: "#94a3b8", fontSize: 11, margin: 0, marginBottom: 4 }}>
                                    {q.label}
                                  </p>
                                  <p style={{
                                    fontFamily: "'Playfair Display', serif",
                                    fontSize: 28, fontWeight: 700,
                                    color: q.color, margin: 0
                                  }}>
                                    {q.value != null ? `${q.value}` : "—"}
                                    <span style={{ fontSize: 13, color: "#94a3b8" }}>/10</span>
                                  </p>
                                </div>
                              ))}
                            </div>

                            {/* Delivered Content */}
                            {t.delivered_content && (
                              <div>
                                <p style={{
                                  color: "#94a3b8", fontSize: 11, fontWeight: 600,
                                  textTransform: "uppercase", letterSpacing: "0.1em",
                                  marginBottom: 10
                                }}>
                                  Delivered Lesson Content
                                </p>
                                <div style={{
                                  backgroundColor: "white", border: "1px solid #e2e8f0",
                                  borderRadius: 10, padding: "16px 18px",
                                  fontSize: 13, color: "#475569",
                                  maxHeight: 200, overflowY: "auto",
                                  whiteSpace: "pre-wrap", lineHeight: 1.7
                                }}>
                                  {t.delivered_content}
                                </div>
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
    </div>
  );
}