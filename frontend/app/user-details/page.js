"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import { getEnrollments } from "@/services/api";

export default function UserDetailsPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [enrolledSubjects, setEnrolledSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { router.push("/login"); return; }
    
    const storedName = localStorage.getItem("name") || "Student";
    const storedEmail = localStorage.getItem("email") || "student@example.com";
    const studentId = localStorage.getItem("student_id");
    
    setName(storedName);
    setEmail(storedEmail);
    
    // Fetch enrolled subjects from backend
    const fetchEnrollments = async () => {
      try {
        setLoading(true);
        const response = await getEnrollments(studentId);
        const data = response.data;
        setEnrolledSubjects(data.subjects || []);
      } catch (err) {
        console.error("Error fetching enrollments:", err);
        setError("Could not load enrollments");
        setEnrolledSubjects([]);
      } finally {
        setLoading(false);
      }
    };
    
    if (studentId) {
      fetchEnrollments();
    } else {
      setLoading(false);
    }
  }, []);

  const handleGoBack = () => {
    router.back();
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar />
      <main style={{
        flex: 1,
        padding: "48px",
        backgroundColor: "#f8fafc",
        overflowY: "auto",
        minWidth: 0
      }}>
        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <button
            onClick={handleGoBack}
            style={{
              background: "none",
              border: "none",
              color: "#2563eb",
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 20,
              padding: 0,
            }}>
            ← Back
          </button>
          <h1 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 40,
            fontWeight: 700,
            color: "#0f172a",
            marginBottom: 8
          }}>
            My Profile
          </h1>
          <p style={{
            color: "#64748b",
            fontSize: 14,
            margin: 0
          }}>
            View your account information and enrolled subjects
          </p>
        </div>

        {/* Profile Card */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "24px",
          marginBottom: "32px"
        }}>
          {/* Personal Information */}
          <div style={{
            backgroundColor: "white",
            borderRadius: 16,
            padding: "32px",
            border: "1px solid #e2e8f0",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "20px",
              marginBottom: "24px"
            }}>
              <div style={{
                width: 80,
                height: 80,
                borderRadius: 16,
                background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 12px rgba(37,99,235,0.3)",
                flexShrink: 0
              }}>
                <span style={{
                  color: "white",
                  fontWeight: 700,
                  fontSize: 36
                }}>
                  {name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <h2 style={{
                  fontSize: 24,
                  fontWeight: 700,
                  color: "#0f172a",
                  margin: "0 0 4px 0"
                }}>
                  {name}
                </h2>
                <p style={{
                  color: "#64748b",
                  fontSize: 14,
                  margin: 0
                }}>
                  Student Account
                </p>
              </div>
            </div>

            <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "24px" }}>
              <div style={{ marginBottom: "20px" }}>
                <p style={{
                  color: "#64748b",
                  fontSize: 12,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  margin: "0 0 8px 0"
                }}>
                  Email Address
                </p>
                <p style={{
                  color: "#0f172a",
                  fontSize: 16,
                  fontWeight: 500,
                  margin: 0,
                  wordBreak: "break-word"
                }}>
                  {email}
                </p>
              </div>

              <div>
                <p style={{
                  color: "#64748b",
                  fontSize: 12,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  margin: "0 0 8px 0"
                }}>
                  Account Type
                </p>
                <p style={{
                  color: "#0f172a",
                  fontSize: 16,
                  fontWeight: 500,
                  margin: 0
                }}>
                  Student
                </p>
              </div>
            </div>
          </div>

          {/* Enrolled Subjects */}
          <div style={{
            backgroundColor: "white",
            borderRadius: 16,
            padding: "32px",
            border: "1px solid #e2e8f0",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          }}>
            <h3 style={{
              fontSize: 20,
              fontWeight: 700,
              color: "#0f172a",
              margin: "0 0 20px 0"
            }}>
              Enrolled Subjects
            </h3>

            {loading ? (
              <div style={{
                padding: "32px 16px",
                textAlign: "center",
                backgroundColor: "#f8fafc",
                borderRadius: 12,
                border: "1px dashed #cbd5e1"
              }}>
                <p style={{
                  color: "#64748b",
                  fontSize: 14,
                  margin: 0
                }}>
                  Loading enrollments...
                </p>
              </div>
            ) : error ? (
              <div style={{
                padding: "32px 16px",
                textAlign: "center",
                backgroundColor: "#fef2f2",
                borderRadius: 12,
                border: "1px dashed #fca5a5"
              }}>
                <p style={{
                  color: "#dc2626",
                  fontSize: 14,
                  margin: 0
                }}>
                  {error}
                </p>
              </div>
            ) : enrolledSubjects.length > 0 ? (
              <div style={{
                display: "flex",
                flexDirection: "column",
                gap: "12px"
              }}>
                {enrolledSubjects.map((subject, index) => {
                  const subjectName =
                    typeof subject === "string"
                      ? subject
                      : subject?.subject || subject?.name || "Subject";
                  const lessons = Array.isArray(subject?.lessons)
                    ? subject.lessons
                    : [];

                  return (
                    <div key={index}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                          padding: "14px 16px",
                          backgroundColor: "#f0f9ff",
                          borderRadius: 12,
                          borderLeft: "4px solid #2563eb",
                          transition: "all 0.2s ease"
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = "#e0f2fe";
                          e.currentTarget.style.transform = "translateX(4px)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "#f0f9ff";
                          e.currentTarget.style.transform = "translateX(0)";
                        }}>
                        <span style={{
                          fontSize: 20,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center"
                        }}>
                          📚
                        </span>
                        <div>
                          <p style={{
                            color: "#0f172a",
                            fontSize: 15,
                            fontWeight: 600,
                            margin: 0
                          }}>
                            {subjectName}
                          </p>
                          {lessons.length > 0 && (
                            <p style={{
                              color: "#64748b",
                              fontSize: 12,
                              margin: "4px 0 0 0"
                            }}>
                              {lessons.length} lessons included
                            </p>
                          )}
                        </div>
                      </div>
                      {lessons.length > 0 && (
                        <div style={{ paddingLeft: 44, marginTop: 8 }}>
                        {lessons.map((lesson, lessonIndex) => {
                          const lessonName =
                            typeof lesson === "string"
                              ? lesson
                              : lesson?.name || `Lesson ${lessonIndex + 1}`;
                          const topics = Array.isArray(lesson?.topics)
                            ? lesson.topics
                            : [];

                          return (
                            <div
                              key={`${index}-${lessonIndex}`}
                              style={{
                                backgroundColor: "#ffffff",
                                border: "1px solid #e2e8f0",
                                borderRadius: 12,
                                padding: "12px 14px",
                                marginBottom: 10,
                              }}
                            >
                              <p style={{
                                margin: 0,
                                color: "#0f172a",
                                fontSize: 14,
                                fontWeight: 600,
                              }}>
                                {lessonName}
                              </p>

                              {topics.length > 0 ? (
                                <ul style={{
                                  margin: "8px 0 0 18px",
                                  padding: 0,
                                  color: "#475569",
                                  fontSize: 13,
                                }}>
                                  {topics.map((topic, topicIndex) => (
                                    <li key={`${index}-${lessonIndex}-${topicIndex}`} style={{ marginBottom: 4 }}>
                                      {topic}
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p style={{
                                  margin: "6px 0 0 0",
                                  color: "#94a3b8",
                                  fontSize: 12,
                                }}>
                                  No topics saved for this lesson
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{
                padding: "32px 16px",
                textAlign: "center",
                backgroundColor: "#f8fafc",
                borderRadius: 12,
                border: "1px dashed #cbd5e1"
              }}>
                <p style={{
                  color: "#64748b",
                  fontSize: 14,
                  margin: 0,
                  fontStyle: "italic"
                }}>
                  No subjects enrolled yet
                </p>
                <p style={{
                  color: "#94a3b8",
                  fontSize: 12,
                  margin: "8px 0 0 0"
                }}>
                  Start exploring subjects from your dashboard
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{
          display: "flex",
          gap: "12px",
          justifyContent: "flex-end"
        }}>
          <button
            onClick={handleGoBack}
            style={{
              padding: "12px 24px",
              border: "1px solid #e2e8f0",
              backgroundColor: "white",
              color: "#475569",
              borderRadius: 10,
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 600,
              transition: "all 0.2s ease"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#f8fafc";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "white";
            }}>
            Go Back
          </button>
          <button
            onClick={() => router.push("/dashboard")}
            style={{
              padding: "12px 24px",
              border: "none",
              backgroundColor: "#2563eb",
              color: "white",
              borderRadius: 10,
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 600,
              transition: "all 0.2s ease"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#1d4ed8";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "#2563eb";
            }}>
            Go to Dashboard
          </button>
        </div>
      </main>
    </div>
  );
}
