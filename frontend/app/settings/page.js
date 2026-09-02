"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [copied, setCopied] = useState(false);
  const [parentInfo, setParentInfo] = useState(null);

  // Teacher code
  const [needsTeacherCode, setNeedsTeacherCode] = useState(false);
  const [teacherCodeInput, setTeacherCodeInput] = useState("");
  const [teacherCodeStatus, setTeacherCodeStatus] = useState({ saving: false, error: "", success: "" });

  // Profile fields
  const [profile, setProfile] = useState({
    name: "",
    email: "",
    student_code: "",
    education_level: "",
    bio: "",
    contact_number: "",
    parent_name: "",
    parent_contact: "",
    school: "",
  });

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { router.push("/login"); return; }

    setNeedsTeacherCode(!localStorage.getItem("teacher_id"));

    const sid = localStorage.getItem("student_id");
    if (!sid) { setLoading(false); return; }

    fetch(`${BACKEND}/student-profile?student_id=${encodeURIComponent(sid)}`)
      .then(r => r.json())
      .then(data => {
        setProfile({
          name: data.name || "",
          email: data.email || "",
          student_code: data.student_code || "",
          education_level: data.education_level || "",
          bio: data.bio || "",
          contact_number: data.contact_number || "",
          parent_name: data.parent_name || "",
          parent_contact: data.parent_contact || "",
          school: data.school || "",
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    // Fetch linked parent info
    fetch(`${BACKEND}/student/parent-info?student_id=${encodeURIComponent(sid)}`)
      .then(r => r.json())
      .then(data => { if (data.linked) setParentInfo(data); })
      .catch(() => {});
  }, [router]);

  const submitTeacherCode = async () => {
    const code = teacherCodeInput.trim();
    if (!code) return;
    setTeacherCodeStatus({ saving: true, error: "", success: "" });
    try {
      const res = await fetch(`${BACKEND}/auth/set-teacher-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: localStorage.getItem("student_id"), teacher_code: code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Invalid code");
      localStorage.setItem("teacher_id", data.teacher_id);
      setNeedsTeacherCode(false);
      setTeacherCodeStatus({ saving: false, error: "", success: "Successfully linked to teacher!" });
    } catch (err) {
      setTeacherCodeStatus({ saving: false, error: err.message || "Invalid code", success: "" });
    }
  };

  const saveProfile = async () => {
    setSaving(true);
    setSaveMsg("");
    try {
      const res = await fetch(`${BACKEND}/student-profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: localStorage.getItem("student_id"),
          bio: profile.bio,
          contact_number: profile.contact_number,
          parent_name: profile.parent_name,
          parent_contact: profile.parent_contact,
          school: profile.school,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Save failed");
      if (data.profile_complete) {
        localStorage.setItem("profile_complete", "true");
      }
      setSaveMsg("Profile saved successfully!");
    } catch (err) {
      setSaveMsg(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(profile.student_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isProfileComplete = profile.bio && profile.contact_number && profile.parent_name && profile.parent_contact && profile.school;

  const fieldStyle = {
    width: "100%", padding: "12px 16px", borderRadius: 12, fontSize: 14,
    border: "1px solid #334155", background: "#0f172a", color: "#f8fafc", outline: "none",
    transition: "border-color 0.2s",
  };

  const labelStyle = {
    fontSize: 13, fontWeight: 600, color: "#cbd5e1", marginBottom: 6, display: "block",
  };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(to bottom, #020617 0%, #0f172a 100%)" }}>
      <Navbar />

      <main style={{ maxWidth: 720, margin: "0 auto", padding: "40px 24px 80px" }}>
        <h1 className="text-page-title" style={{ color: "#f8fafc", margin: "0 0 8px" }}>Settings</h1>
        <p className="text-body" style={{ color: "#94a3b8", marginBottom: 40 }}>Manage your profile and account settings.</p>

        {loading ? (
          <p style={{ color: "#94a3b8" }}>Loading...</p>
        ) : (
          <>
            {/* ── Teacher Code Section ── */}
            <div style={{
              background: "#1e293b", borderRadius: 20, padding: 28,
              border: "1px solid #334155", marginBottom: 28,
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
            }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "#f8fafc", margin: "0 0 6px" }}>Link to Teacher</h2>
              <p style={{ fontSize: 14, color: "#cbd5e1", margin: "0 0 20px" }}>
                Enter the code your teacher gave you so their lessons appear in your curriculum.
              </p>

              {!needsTeacherCode && !teacherCodeStatus.success ? (
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: "rgba(16, 185, 129, 0.1)", borderRadius: 12, border: "1px solid rgba(16, 185, 129, 0.2)" }}>
                  <span style={{ fontSize: 18 }}>✅</span>
                  <span style={{ fontSize: 14, color: "#10b981", fontWeight: 600 }}>Already linked to a teacher</span>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", gap: 10 }}>
                    <input
                      value={teacherCodeInput}
                      onChange={(e) => setTeacherCodeInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && submitTeacherCode()}
                      placeholder="e.g. TE123456"
                      style={{ ...fieldStyle, flex: 1 }}
                      onFocus={(e) => { e.target.style.borderColor = "#3b82f6"; e.target.style.boxShadow = "0 0 0 1px #3b82f6"; }}
                      onBlur={(e) => { e.target.style.borderColor = "#334155"; e.target.style.boxShadow = "none"; }}
                    />
                    <button
                      onClick={submitTeacherCode}
                      disabled={teacherCodeStatus.saving || !teacherCodeInput.trim()}
                      style={{
                        padding: "12px 24px", borderRadius: 12, border: "none",
                        background: "#2563eb", color: "white", fontWeight: 600, fontSize: 14,
                        cursor: teacherCodeStatus.saving ? "default" : "pointer",
                        opacity: teacherCodeStatus.saving ? 0.6 : 1,
                      }}
                    >
                      {teacherCodeStatus.saving ? "Linking..." : "Link"}
                    </button>
                  </div>
                  {teacherCodeStatus.error && (
                    <p style={{ margin: "10px 0 0", fontSize: 13, color: "#ef4444" }}>{teacherCodeStatus.error}</p>
                  )}
                  {teacherCodeStatus.success && (
                    <p style={{ margin: "10px 0 0", fontSize: 13, color: "#10b981", fontWeight: 600 }}>{teacherCodeStatus.success}</p>
                  )}
                </>
              )}
            </div>

            {/* ── Student Information ── */}
            <div style={{
              background: "#1e293b", borderRadius: 20, padding: 28,
              border: "1px solid #334155",
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 700, color: "#f8fafc", margin: "0 0 6px" }}>Student Information</h2>
                  <p style={{ fontSize: 14, color: "#cbd5e1", margin: 0 }}>
                    Please fill in all fields to continue using the platform.
                  </p>
                </div>
                {!isProfileComplete && (
                  <span style={{
                    background: "#fef3c7", color: "#92400e", fontSize: 12, fontWeight: 700,
                    padding: "5px 14px", borderRadius: 100, border: "1px solid #fde68a",
                  }}>
                    Incomplete
                  </span>
                )}
              </div>

              {/* Read-only fields */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={labelStyle}>Student Code (Unique Identifier)</label>
                  <div style={{ display: "flex", gap: 10 }}>
                    <input value={profile.student_code} disabled style={{ ...fieldStyle, flex: 1, background: "#020617", color: "#64748b", borderColor: "#1e293b", cursor: "not-allowed", fontFamily: "monospace", letterSpacing: "0.05em" }} />
                    <button
                      onClick={handleCopyId}
                      style={{
                        padding: "0 16px", borderRadius: 12, border: "1px solid #334155",
                        background: copied ? "#10b981" : "#1e293b", color: copied ? "white" : "#f8fafc", cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                        transition: "all 0.2s"
                      }}
                    >
                      {copied ? (
                        <>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                          <span style={{ fontSize: 13, fontWeight: 600 }}>Copied!</span>
                        </>
                      ) : (
                        <>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                          <span style={{ fontSize: 13, fontWeight: 600 }}>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                <div>
                  <label style={labelStyle}>Full Name</label>
                  <input value={profile.name} disabled style={{ ...fieldStyle, background: "#020617", color: "#64748b", borderColor: "#1e293b", cursor: "not-allowed" }} />
                </div>
                <div>
                  <label style={labelStyle}>Email</label>
                  <input value={profile.email} disabled style={{ ...fieldStyle, background: "#020617", color: "#64748b", borderColor: "#1e293b", cursor: "not-allowed" }} />
                </div>
              </div>

              <div style={{ height: 1, background: "#334155", margin: "20px 0" }} />

              {/* Linked Parent (from mobile app) */}
              {parentInfo ? (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                    <span style={{ fontSize: 16 }}>👨‍👩‍👧</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#f8fafc" }}>Linked Parent</span>
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: "2px 10px", borderRadius: 99,
                      background: "rgba(16,185,129,0.15)", color: "#34d399",
                    }}>Connected</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <div>
                      <label style={labelStyle}>Parent Name</label>
                      <input value={parentInfo.parent_name} disabled style={{ ...fieldStyle, background: "#020617", color: "#64748b", borderColor: "#1e293b", cursor: "not-allowed" }} />
                    </div>
                    <div>
                      <label style={labelStyle}>Parent Contact</label>
                      <input value={parentInfo.parent_contact || "Not provided"} disabled style={{ ...fieldStyle, background: "#020617", color: "#64748b", borderColor: "#1e293b", cursor: "not-allowed" }} />
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "14px 16px",
                  background: "rgba(255,255,255,0.03)", borderRadius: 12, border: "1px solid #334155", marginBottom: 20,
                }}>
                  <span style={{ fontSize: 16 }}>👨‍👩‍👧</span>
                  <span style={{ fontSize: 13, color: "#64748b" }}>No parent linked yet — parents can link via the mobile app using your Student Code.</span>
                </div>
              )}

              <div style={{ height: 1, background: "#334155", margin: "0 0 20px" }} />

              {/* Editable fields */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={labelStyle}>Contact Number <span style={{ color: "#dc2626" }}>*</span></label>
                  <input
                    value={profile.contact_number}
                    onChange={(e) => setProfile({ ...profile, contact_number: e.target.value })}
                    placeholder="07X XXX XXXX"
                    style={fieldStyle}
                    onFocus={(e) => { e.target.style.borderColor = "#3b82f6"; e.target.style.boxShadow = "0 0 0 1px #3b82f6"; }}
                    onBlur={(e) => { e.target.style.borderColor = "#334155"; e.target.style.boxShadow = "none"; }}
                  />
                </div>
                <div>
                  <label style={labelStyle}>School <span style={{ color: "#dc2626" }}>*</span></label>
                  <input
                    value={profile.school}
                    onChange={(e) => setProfile({ ...profile, school: e.target.value })}
                    placeholder="Your school name"
                    style={fieldStyle}
                    onFocus={(e) => { e.target.style.borderColor = "#3b82f6"; e.target.style.boxShadow = "0 0 0 1px #3b82f6"; }}
                    onBlur={(e) => { e.target.style.borderColor = "#334155"; e.target.style.boxShadow = "none"; }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Bio <span style={{ color: "#dc2626" }}>*</span></label>
                <textarea
                  value={profile.bio}
                  onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                  placeholder="Tell us about yourself..."
                  rows={3}
                  style={{ ...fieldStyle, resize: "vertical" }}
                  onFocus={(e) => { e.target.style.borderColor = "#3b82f6"; e.target.style.boxShadow = "0 0 0 1px #3b82f6"; }}
                  onBlur={(e) => { e.target.style.borderColor = "#334155"; e.target.style.boxShadow = "none"; }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
                <div>
                  <label style={labelStyle}>Parent / Guardian Name <span style={{ color: "#dc2626" }}>*</span></label>
                  <input
                    value={profile.parent_name}
                    onChange={(e) => setProfile({ ...profile, parent_name: e.target.value })}
                    placeholder="Full name"
                    style={fieldStyle}
                    onFocus={(e) => { e.target.style.borderColor = "#3b82f6"; e.target.style.boxShadow = "0 0 0 1px #3b82f6"; }}
                    onBlur={(e) => { e.target.style.borderColor = "#334155"; e.target.style.boxShadow = "none"; }}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Parent Contact Number <span style={{ color: "#dc2626" }}>*</span></label>
                  <input
                    value={profile.parent_contact}
                    onChange={(e) => setProfile({ ...profile, parent_contact: e.target.value })}
                    placeholder="07X XXX XXXX"
                    style={fieldStyle}
                    onFocus={(e) => { e.target.style.borderColor = "#3b82f6"; e.target.style.boxShadow = "0 0 0 1px #3b82f6"; }}
                    onBlur={(e) => { e.target.style.borderColor = "#334155"; e.target.style.boxShadow = "none"; }}
                  />
                </div>
              </div>

              {/* Save button + message */}
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <button
                  onClick={saveProfile}
                  disabled={saving || !isProfileComplete}
                  style={{
                    padding: "12px 32px", borderRadius: 12, border: "none",
                    background: (!saving && isProfileComplete) ? "linear-gradient(135deg, #1d4ed8, #3b82f6)" : "#cbd5e1",
                    color: "white", fontWeight: 700, fontSize: 14,
                    cursor: (!saving && isProfileComplete) ? "pointer" : "not-allowed",
                    boxShadow: (!saving && isProfileComplete) ? "0 4px 14px rgba(37,99,235,0.3)" : "none",
                    transition: "all 0.2s",
                  }}
                >
                  {saving ? "Saving..." : "Save Profile"}
                </button>
                {saveMsg && (
                  <span style={{
                    fontSize: 14, fontWeight: 600,
                    color: saveMsg.includes("success") ? "#059669" : "#dc2626",
                  }}>
                    {saveMsg}
                  </span>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
