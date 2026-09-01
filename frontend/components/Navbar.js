"use client";
import { useRouter, usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [name, setName] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileComplete, setProfileComplete] = useState(true);
  const profileRef = useRef(null);
  const notifRef = useRef(null);

  useEffect(() => {
    setName(localStorage.getItem("name") || "Student");
    setProfileComplete(localStorage.getItem("profile_complete") === "true");
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleLogout = () => {
    localStorage.clear();
    router.push("/");
  };

  const navLinks = [
    { label: "Home", path: "/dashboard" },
    { label: "Lessons", path: "/lessons" },
    { label: "Progress", path: "/progress" },
  ];

  const isActive = (path) => pathname === path;

  return (
    <header style={{ position: "sticky", top: 16, zIndex: 100, padding: "0 16px", marginBottom: 32 }}>
      <nav
        style={{
          maxWidth: 1152,
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 24px",
          background: "rgba(255, 255, 255, 0.9)",
          backdropFilter: "blur(12px)",
          borderRadius: 9999,
          boxShadow: "0 10px 40px -10px rgba(0,0,0,0.1)",
          border: "1px solid rgba(0,0,0,0.05)",
        }}
      >
      {/* Left — Logo */}
      <div
        style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", flexShrink: 0 }}
        onClick={() => router.push("/dashboard")}
      >
        <img src="/logo.png" alt="SUBHASHA" style={{ height: 32, width: "auto", objectFit: "contain" }} />
        <span className="text-logo" style={{ color: "#0f172a" }}>SUBHASHA</span>
      </div>

      {/* Center — Nav Links */}
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        {navLinks.map((link) => (
          <button
            key={link.path}
            onClick={() => router.push(link.path)}
            style={{
              background: isActive(link.path) ? "#eff6ff" : "transparent",
              border: "none",
              color: isActive(link.path) ? "#2563eb" : "#64748b",
              fontSize: 14,
              fontWeight: isActive(link.path) ? 700 : 500,
              cursor: "pointer",
              padding: "8px 20px",
              borderRadius: 10,
              transition: "all 0.2s",
              position: "relative",
            }}
            onMouseEnter={(e) => {
              if (!isActive(link.path)) {
                e.currentTarget.style.background = "#f8fafc";
                e.currentTarget.style.color = "#0f172a";
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive(link.path)) {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "#64748b";
              }
            }}
          >
            {link.label}
            {isActive(link.path) && (
              <div style={{
                position: "absolute", bottom: -1, left: "50%", transform: "translateX(-50%)",
                width: 20, height: 3, borderRadius: 2, background: "#2563eb",
              }} />
            )}
          </button>
        ))}
      </div>

      {/* Right — Notification + Profile */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>

        <div ref={notifRef} style={{ position: "relative" }}>
          <button
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            style={{
              background: notificationsOpen ? "#f1f5f9" : "transparent", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 40, height: 40, borderRadius: 10, position: "relative",
            }}
            onMouseEnter={(e) => { if (!notificationsOpen) e.currentTarget.style.background = "#f1f5f9"; }}
            onMouseLeave={(e) => { if (!notificationsOpen) e.currentTarget.style.background = "transparent"; }}
            aria-label="Notifications"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
            {!profileComplete && (
              <span style={{
                position: "absolute", top: 8, right: 8, width: 8, height: 8,
                background: "#ef4444", borderRadius: "50%",
                boxShadow: "0 0 0 2px white"
              }} />
            )}
          </button>
          
          {notificationsOpen && (
            <div style={{
              position: "absolute", top: "calc(100% + 8px)", right: 0,
              background: "white", border: "1px solid #e2e8f0", borderRadius: 14,
              boxShadow: "0 10px 40px rgba(0,0,0,0.12)", width: 320,
              padding: 16, zIndex: 200,
              animation: "fadeIn 0.15s ease-out",
            }}>
              <h3 style={{ margin: "0 0 12px", fontSize: 16, color: "#0f172a" }}>Notifications</h3>
              {!profileComplete ? (
                <div
                  onClick={() => { setNotificationsOpen(false); router.push("/settings"); }}
                  style={{
                    display: "flex", alignItems: "flex-start", gap: 12,
                    padding: 12, borderRadius: 12, cursor: "pointer",
                    background: "rgba(245,158,11,0.1)",
                    border: "1px solid rgba(245,158,11,0.2)",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "rgba(245,158,11,0.15)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "rgba(245,158,11,0.1)"}
                >
                  <span style={{ fontSize: 20 }}>⚠️</span>
                  <div>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#b45309" }}>Complete your profile</p>
                    <p style={{ margin: "4px 0 0", fontSize: 12, color: "#92400e" }}>Please fill in your student information before continuing lessons.</p>
                  </div>
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: 14, color: "#64748b", textAlign: "center", padding: "20px 0" }}>
                  No new notifications.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Profile Dropdown */}
        <div ref={profileRef} style={{ position: "relative" }}>
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              background: profileOpen ? "#f1f5f9" : "transparent",
              border: "1px solid " + (profileOpen ? "#e2e8f0" : "transparent"),
              borderRadius: 12, padding: "6px 12px 6px 6px",
              cursor: "pointer", transition: "all 0.2s",
            }}
            onMouseEnter={(e) => { if (!profileOpen) e.currentTarget.style.background = "#f8fafc"; }}
            onMouseLeave={(e) => { if (!profileOpen) e.currentTarget.style.background = "transparent"; }}
          >
            {/* Avatar circle */}
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <span style={{ color: "white", fontWeight: 700, fontSize: 14 }}>
                {name.charAt(0).toUpperCase()}
              </span>
            </div>
            <span style={{ color: "#0f172a", fontSize: 14, fontWeight: 600, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {name}
            </span>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transition: "transform 0.2s", transform: profileOpen ? "rotate(180deg)" : "rotate(0)" }}>
              <path d="M3 4.5L6 7.5L9 4.5" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          {/* Dropdown menu */}
          {profileOpen && (
            <div style={{
              position: "absolute", top: "calc(100% + 8px)", right: 0,
              background: "white", border: "1px solid #e2e8f0", borderRadius: 14,
              boxShadow: "0 10px 40px rgba(0,0,0,0.12)", minWidth: 200,
              padding: 6, zIndex: 200,
              animation: "fadeIn 0.15s ease-out",
            }}>
              <button
                onClick={() => { setProfileOpen(false); router.push("/settings"); }}
                style={{
                  display: "flex", alignItems: "center", gap: 10, width: "100%",
                  background: "transparent", border: "none", padding: "10px 14px",
                  borderRadius: 10, cursor: "pointer", color: "#334155", fontSize: 14, fontWeight: 500,
                  textAlign: "left",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#f8fafc"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"></circle>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                </svg>
                Settings
              </button>
              <div style={{ height: 1, background: "#e2e8f0", margin: "4px 8px" }} />
              <button
                onClick={() => { setProfileOpen(false); handleLogout(); }}
                style={{
                  display: "flex", alignItems: "center", gap: 10, width: "100%",
                  background: "transparent", border: "none", padding: "10px 14px",
                  borderRadius: 10, cursor: "pointer", color: "#ef4444", fontSize: 14, fontWeight: 500,
                  textAlign: "left",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#fef2f2"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  <polyline points="16 17 21 12 16 7"></polyline>
                  <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </nav>
    </header>
  );
}
