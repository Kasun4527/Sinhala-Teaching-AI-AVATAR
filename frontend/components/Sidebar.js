"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState, useEffect } from "react";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export default function Sidebar({ subject: activeSub = null }) {
  const router   = useRouter();
  const pathname = usePathname();

  const [name, setName]               = useState("");
  const [subjectData, setSubjectData] = useState(null);   // single subject when activeSub set
  const [subjects, setSubjects]       = useState([]);     // all subjects for dashboard view
  const [expanded, setExpanded]       = useState({});
  const [hoveredItem, setHoveredItem] = useState(null);

  useEffect(() => {
    const n  = localStorage.getItem("name") || "Student";
    const id = localStorage.getItem("student_id");
    setName(n);
    if (!id) return;

    fetch(`${BACKEND}/sidebar-progress?student_id=${id}`)
      .then(r => r.json())
      .then(data => {
        const all = data.subjects || [];
        setSubjects(all);
        if (activeSub) {
          const found = all.find(s => s.subject === activeSub);
          setSubjectData(found || null);
        }
      })
      .catch(() => {});
  }, [activeSub]);

  const handleLogout = () => {
    localStorage.clear();
    router.push("/");
  };

  const toggleSubject = (name) =>
    setExpanded(prev => ({ ...prev, [name]: !prev[name] }));

  // Count completed topics in a subject
  const doneCount = (lessons) =>
    lessons.reduce((sum, l) => sum + l.topics.filter(t => t.done).length, 0);
  const totalCount = (lessons) =>
    lessons.reduce((sum, l) => sum + l.topics.length, 0);

  const subjectAccents = [
    "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4",
  ];

  return (
    <div style={{
      backgroundColor: "#0a0f1e",
      width: 230, minWidth: 230,
      minHeight: "100vh",
      display: "flex", flexDirection: "column",
      justifyContent: "space-between",
      borderRight: "1px solid #1e293b",
      flexShrink: 0,
      overflow: "hidden",
    }}>
      <style>{`div::-webkit-scrollbar { display: none; }`}</style>

      {/* ── Top ── */}
      <div style={{ overflowY: "auto", flex: 1, scrollbarWidth: "none", msOverflowStyle: "none" }}>

        {/* Logo */}
        <div style={{ padding: "20px 16px 16px", borderBottom: "1px solid #1e293b" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
              width: 34, height: 34, borderRadius: 10,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 12px rgba(37,99,235,0.4)", flexShrink: 0,
            }}>
              <span style={{ color: "white", fontWeight: 800, fontSize: 11 }}>IDS</span>
            </div>
            <div>
              <p style={{ color: "white", fontWeight: 700, fontSize: 13, margin: 0 }}>IDS Platform</p>
              <p style={{ color: "#334155", fontSize: 10, margin: 0, letterSpacing: 0.5 }}>LEARNING SYSTEM</p>
            </div>
          </div>
        </div>

        {/* Dashboard nav */}
        <div style={{ padding: "12px 10px 4px" }}>
          <div
            onClick={() => router.push("/dashboard")}
            onMouseEnter={() => setHoveredItem("dash")}
            onMouseLeave={() => setHoveredItem(null)}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "9px 10px", borderRadius: 10, cursor: "pointer",
              backgroundColor: pathname === "/dashboard"
                ? "rgba(37,99,235,0.15)"
                : hoveredItem === "dash" ? "rgba(255,255,255,0.04)" : "transparent",
              borderLeft: pathname === "/dashboard" ? "3px solid #2563eb" : "3px solid transparent",
              transition: "all 0.15s",
            }}
          >
            <span style={{ color: pathname === "/dashboard" ? "#2563eb" : "#475569", fontSize: 15 }}>⊞</span>
            <span style={{
              color: pathname === "/dashboard" ? "#e2e8f0" : "#94a3b8",
              fontSize: 13, fontWeight: pathname === "/dashboard" ? 600 : 400,
            }}>Dashboard</span>
          </div>
        </div>

        <div style={{ margin: "6px 10px", borderTop: "1px solid #1e293b" }} />

        {/* ── Subject context panel (when inside a subject) ── */}
        {activeSub && subjectData && (() => {
          const done  = doneCount(subjectData.lessons);
          const total = totalCount(subjectData.lessons);
          const pct   = total > 0 ? Math.round((done / total) * 100) : 0;
          const accent = "#3b82f6";

          return (
            <div style={{ padding: "0 10px 8px" }}>
              {/* Subject title + overall progress */}
              <div style={{
                padding: "10px 10px 8px",
                borderBottom: "1px solid #1e293b",
                marginBottom: 6,
              }}>
                <p style={{
                  color: "#94a3b8", fontSize: 9, fontWeight: 700,
                  letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 4px",
                }}>Current Subject</p>
                <p style={{
                  color: "#e2e8f0", fontSize: 12, fontWeight: 700,
                  margin: "0 0 6px",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {subjectData.subject}
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ flex: 1, height: 4, backgroundColor: "#1e293b", borderRadius: 4 }}>
                    <div style={{
                      width: `${pct}%`, height: "100%",
                      backgroundColor: pct === 100 ? "#22c55e" : accent,
                      borderRadius: 4, transition: "width 0.4s ease",
                    }} />
                  </div>
                  <span style={{ color: "#475569", fontSize: 9, flexShrink: 0 }}>
                    {done}/{total}
                  </span>
                </div>
              </div>

              {/* Lessons + topics */}
              {subjectData.lessons.map((lesson, li) => {
                const lessonDone = lesson.topics.length > 0 && lesson.topics.every(t => t.done);
                const lessonAny  = lesson.topics.some(t => t.done);
                const isOpen     = expanded[`lesson-${li}`] !== false; // default open
                const lessonAccent = lessonDone ? "#22c55e" : lessonAny ? "#60a5fa" : "#475569";

                return (
                  <div key={li} style={{ marginBottom: 2 }}>
                    {/* Lesson header */}
                    <div
                      onClick={() => setExpanded(p => ({ ...p, [`lesson-${li}`]: !isOpen }))}
                      onMouseEnter={() => setHoveredItem(`l-${li}`)}
                      onMouseLeave={() => setHoveredItem(null)}
                      style={{
                        display: "flex", alignItems: "center", gap: 7,
                        padding: "7px 8px", borderRadius: 8, cursor: "pointer",
                        backgroundColor: hoveredItem === `l-${li}` ? "rgba(255,255,255,0.04)" : "transparent",
                        transition: "all 0.15s",
                      }}
                    >
                      <span style={{ fontSize: 9, flexShrink: 0 }}>
                        {lessonDone ? "✅" : lessonAny ? "🔵" : "⚪"}
                      </span>
                      <p style={{
                        color: lessonAccent, fontSize: 10, fontWeight: 600,
                        margin: 0, flex: 1,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {lesson.name}
                      </p>
                      <span style={{
                        color: "#334155", fontSize: 8,
                        transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
                        transition: "transform 0.2s", flexShrink: 0,
                      }}>▶</span>
                    </div>

                    {/* Topics */}
                    {isOpen && lesson.topics.map((topic, ti) => (
                      <div
                        key={ti}
                        onMouseEnter={() => setHoveredItem(`t-${li}-${ti}`)}
                        onMouseLeave={() => setHoveredItem(null)}
                        style={{
                          display: "flex", alignItems: "center", gap: 7,
                          padding: "4px 6px 4px 22px", borderRadius: 6,
                          backgroundColor: hoveredItem === `t-${li}-${ti}`
                            ? "rgba(255,255,255,0.03)" : "transparent",
                        }}
                      >
                        <div style={{
                          width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
                          backgroundColor: topic.done ? "#22c55e" : "transparent",
                          border: `1.5px solid ${topic.done ? "#22c55e" : "#334155"}`,
                        }} />
                        <p style={{
                          color: topic.done ? "#86efac" : "#475569",
                          fontSize: 10, margin: 0,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          textDecoration: topic.done ? "line-through" : "none",
                          opacity: topic.done ? 0.6 : 1,
                        }}>
                          {topic.name}
                        </p>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* ── Dashboard view: compact subject list ── */}
        {!activeSub && subjects.length > 0 && (
          <div style={{ padding: "0 10px 8px" }}>
            <p style={{
              color: "#334155", fontSize: 9, fontWeight: 700,
              letterSpacing: "0.12em", textTransform: "uppercase",
              margin: "0 0 6px 4px",
            }}>My Subjects</p>
            {subjects.map((subj, si) => {
              const accent = subjectAccents[si % subjectAccents.length];
              const done  = doneCount(subj.lessons);
              const total = totalCount(subj.lessons);
              const pct   = total > 0 ? Math.round((done / total) * 100) : 0;
              return (
                <div key={`subj-${si}-${subj.subject}`} style={{
                  padding: "8px 10px", borderRadius: 10, marginBottom: 4,
                  backgroundColor: "rgba(255,255,255,0.02)",
                  border: "1px solid #1e293b",
                }}>
                  <p style={{
                    color: "#e2e8f0", fontSize: 11, fontWeight: 600, margin: "0 0 5px",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>{subj.subject}</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <div style={{ flex: 1, height: 3, backgroundColor: "#1e293b", borderRadius: 2 }}>
                      <div style={{
                        width: `${pct}%`, height: "100%",
                        backgroundColor: accent, borderRadius: 2,
                      }} />
                    </div>
                    <span style={{ color: "#475569", fontSize: 9 }}>{done}/{total}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Bottom ── */}
      <div>
        <div style={{ margin: "0 10px 10px", borderTop: "1px solid #1e293b" }} />

        {/* User card */}
        <div
          onClick={() => router.push("/user-details")}
          onMouseEnter={() => setHoveredItem("user")}
          onMouseLeave={() => setHoveredItem(null)}
          style={{
            margin: "0 10px 8px", padding: "11px 12px", borderRadius: 12,
            backgroundColor: hoveredItem === "user" ? "rgba(37,99,235,0.15)" : "rgba(255,255,255,0.03)",
            border: "1px solid #1e293b", cursor: "pointer", transition: "all 0.15s",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 9,
              background: "linear-gradient(135deg, #1e3a5f, #1e293b)",
              display: "flex", alignItems: "center", justifyContent: "center",
              border: "1px solid #2d3f55", flexShrink: 0,
            }}>
              <span style={{ color: "#60a5fa", fontWeight: 700, fontSize: 14 }}>
                {name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{
                color: "#e2e8f0", fontSize: 12, fontWeight: 600, margin: 0,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>{name}</p>
              <p style={{ color: "#334155", fontSize: 10, margin: 0 }}>Student</p>
            </div>
          </div>
        </div>

        {/* Logout */}
        <div
          onClick={handleLogout}
          onMouseEnter={() => setHoveredItem("logout")}
          onMouseLeave={() => setHoveredItem(null)}
          style={{
            display: "flex", alignItems: "center", gap: 10,
            margin: "0 10px 20px", padding: "9px 12px", borderRadius: 10,
            cursor: "pointer",
            backgroundColor: hoveredItem === "logout" ? "rgba(239,68,68,0.1)" : "transparent",
            transition: "all 0.15s",
          }}
        >
          <span style={{ color: "#ef4444", fontSize: 13 }}>→</span>
          <span style={{ color: "#ef4444", fontSize: 12, fontWeight: 500 }}>Sign Out</span>
        </div>
      </div>
    </div>
  );
}
