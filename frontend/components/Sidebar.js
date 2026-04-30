"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState, useEffect } from "react";

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [name, setName] = useState("");
  const [hoveredItem, setHoveredItem] = useState(null);

  useEffect(() => {
    setName(localStorage.getItem("name") || "Student");
  }, []);

  const handleLogout = () => {
    localStorage.clear();
    router.push("/");
  };

  const navItems = [
    { label: "Dashboard", icon: "⊞", path: "/dashboard", desc: "Home" },
  ];

  const subjects = [
    { label: "Physics",   icon: "⚛", path: "/sub-lesson?subject=Physics",   color: "#2563eb" },
    { label: "Chemistry", icon: "⚗", path: "/sub-lesson?subject=Chemistry", color: "#16a34a" },
    { label: "Biology",   icon: "🧬", path: "/sub-lesson?subject=Biology",   color: "#059669" },
    { label: "Maths",     icon: "∑", path: "/sub-lesson?subject=Maths",     color: "#9333ea" },
  ];

  const isActive = (path) => pathname === path.split("?")[0];

  return (
    <div style={{
      backgroundColor: "#0a0f1e",
      width: "210px",
      minWidth: "210px",
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      padding: "0",
      margin: 0,
      flexShrink: 0,
      borderRight: "1px solid #1e293b",
    }}>

      {/* ── Top Section ── */}
      <div>

        {/* Logo Area */}
        <div style={{
          padding: "24px 20px 20px",
          borderBottom: "1px solid #1e293b",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
              width: 34, height: 34, borderRadius: 10,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 12px rgba(37,99,235,0.4)",
              flexShrink: 0
            }}>
              <span style={{ color: "white", fontWeight: 800, fontSize: 11, letterSpacing: 0.5 }}>IDS</span>
            </div>
            <div>
              <p style={{ color: "white", fontWeight: 700, fontSize: 13, margin: 0, letterSpacing: 0.3 }}>
                IDS Platform
              </p>
              <p style={{ color: "#334155", fontSize: 10, margin: 0, letterSpacing: 0.5 }}>
                LEARNING SYSTEM
              </p>
            </div>
          </div>
        </div>

        {/* Main Nav */}
        <div style={{ padding: "16px 12px 8px" }}>
          <p style={{
            color: "#334155", fontSize: 9, fontWeight: 700,
            letterSpacing: "0.12em", textTransform: "uppercase",
            marginBottom: 8, paddingLeft: 8
          }}>
            Main Menu
          </p>

          {navItems.map((item) => {
            const active = pathname === item.path;
            return (
              <div
                key={item.path}
                onClick={() => router.push(item.path)}
                onMouseEnter={() => setHoveredItem(item.path)}
                onMouseLeave={() => setHoveredItem(null)}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 12px", borderRadius: 10,
                  cursor: "pointer", marginBottom: 2,
                  backgroundColor: active
                    ? "rgba(37,99,235,0.15)"
                    : hoveredItem === item.path
                    ? "rgba(255,255,255,0.04)"
                    : "transparent",
                  borderLeft: active ? "3px solid #2563eb" : "3px solid transparent",
                  transition: "all 0.15s ease",
                }}
              >
                <span style={{
                  color: active ? "#2563eb" : "#475569",
                  fontSize: 16, width: 20, textAlign: "center"
                }}>
                  {item.icon}
                </span>
                <div>
                  <p style={{
                    color: active ? "#e2e8f0" : "#94a3b8",
                    fontSize: 13, fontWeight: active ? 600 : 400,
                    margin: 0, letterSpacing: 0.2
                  }}>
                    {item.label}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Divider */}
        <div style={{ margin: "8px 12px", borderTop: "1px solid #1e293b" }} />

        {/* Subjects */}
        <div style={{ padding: "8px 12px" }}>
          <p style={{
            color: "#334155", fontSize: 9, fontWeight: 700,
            letterSpacing: "0.12em", textTransform: "uppercase",
            marginBottom: 8, paddingLeft: 8
          }}>
            Subjects
          </p>

          {subjects.map((item) => {
            const active = pathname.includes("sub-lesson") && 
                          typeof window !== "undefined" && 
                          window.location.search.includes(item.label);
            return (
              <div
                key={item.label}
                onClick={() => router.push(item.path)}
                onMouseEnter={() => setHoveredItem(item.label)}
                onMouseLeave={() => setHoveredItem(null)}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "9px 12px", borderRadius: 10,
                  cursor: "pointer", marginBottom: 2,
                  backgroundColor: hoveredItem === item.label
                    ? "rgba(255,255,255,0.04)"
                    : "transparent",
                  transition: "all 0.15s ease",
                }}
              >
                {/* Color dot */}
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  backgroundColor: item.color + "18",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0
                }}>
                  <span style={{ color: item.color, fontSize: 14 }}>{item.icon}</span>
                </div>
                <p style={{
                  color: "#64748b", fontSize: 12, fontWeight: 500,
                  margin: 0, letterSpacing: 0.2
                }}>
                  {item.label}
                </p>
              </div>
            );
          })}
        </div>

      </div>

      {/* ── Bottom Section ── */}
      <div>

        {/* Divider */}
        <div style={{ margin: "0 12px 12px", borderTop: "1px solid #1e293b" }} />

        {/* User Card */}
        <div style={{
          margin: "0 12px 8px",
          padding: "12px 14px",
          backgroundColor: "rgba(255,255,255,0.03)",
          borderRadius: 12,
          border: "1px solid #1e293b",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: "linear-gradient(135deg, #1e3a5f, #1e293b)",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0, border: "1px solid #2d3f55"
            }}>
              <span style={{ color: "#60a5fa", fontWeight: 700, fontSize: 14 }}>
                {name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{
                color: "#e2e8f0", fontSize: 12, fontWeight: 600,
                margin: 0, whiteSpace: "nowrap",
                overflow: "hidden", textOverflow: "ellipsis"
              }}>
                {name}
              </p>
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
            margin: "0 12px 20px",
            padding: "10px 14px", borderRadius: 10,
            cursor: "pointer",
            backgroundColor: hoveredItem === "logout"
              ? "rgba(239,68,68,0.1)"
              : "transparent",
            transition: "all 0.15s ease",
          }}
        >
          <span style={{ color: "#ef4444", fontSize: 14 }}>→</span>
          <span style={{ color: "#ef4444", fontSize: 12, fontWeight: 500 }}>
            Sign Out
          </span>
        </div>

      </div>
    </div>
  );
}