"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { loginUser } from "@/services/api";

export default function AdminLoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await loginUser(form);
      const data = res.data;
      if (data.role !== "admin") {
        setError("Access denied. This login is for admins only.");
        return;
      }
      localStorage.setItem("token", data.token);
      localStorage.setItem("role", data.role);
      localStorage.setItem("name", data.name);
      localStorage.setItem("student_id", data.student_id);
      router.push("/admin/dashboard");
    } catch (err) {
      setError(err?.response?.data?.detail || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>

      {/* Left Dark Panel */}
      <div style={{
        width: "45%", backgroundColor: "#0f172a",
        display: "flex", flexDirection: "column",
        justifyContent: "center", padding: "60px 48px"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 64 }}>
          <div style={{
            backgroundColor: "#2563eb", width: 36, height: 36,
            borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center"
          }}>
            <span style={{ color: "white", fontWeight: 700, fontSize: 12 }}>IDS</span>
          </div>
          <span style={{ color: "white", fontWeight: 600, fontSize: 14 }}>IDS Platform</span>
        </div>

        <p style={{ color: "#3b82f6", fontSize: 11, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 16 }}>
          Admin Portal
        </p>
        <h1 style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 38, fontWeight: 700, color: "white",
          lineHeight: 1.2, marginBottom: 16
        }}>
          Manage Your Students & Analytics
        </h1>
        <p style={{ color: "#64748b", fontSize: 15, lineHeight: 1.6 }}>
          Access the admin dashboard to monitor student progress, view delivered content, and track performance.
        </p>

        {/* Feature list */}
        <div style={{ marginTop: 40, display: "flex", flexDirection: "column", gap: 12 }}>
          {[
            "View all registered students",
            "Track lesson completion progress",
            "Monitor quiz performance",
            "Review delivered content",
          ].map((f, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 18, height: 18, borderRadius: "50%",
                backgroundColor: "#1e3a5f",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0
              }}>
                <span style={{ color: "#3b82f6", fontSize: 10 }}>✓</span>
              </div>
              <span style={{ color: "#64748b", fontSize: 13 }}>{f}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right Form */}
      <div style={{
        flex: 1, backgroundColor: "#f8fafc",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "48px"
      }}>
        <div style={{ width: "100%", maxWidth: 400 }}>

          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            backgroundColor: "#fef3c7", color: "#92400e",
            padding: "6px 12px", borderRadius: 20,
            fontSize: 12, fontWeight: 600, marginBottom: 24
          }}>
            👨‍💼 Administrator Access
          </div>

          <h2 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 28, fontWeight: 700, color: "#0f172a", marginBottom: 6
          }}>
            Admin Sign In
          </h2>
          <p style={{ color: "#94a3b8", fontSize: 14, marginBottom: 32 }}>
            Sign in to access the admin dashboard
          </p>

          {error && (
            <div style={{
              backgroundColor: "#fef2f2", border: "1px solid #fecaca",
              color: "#dc2626", fontSize: 13, padding: "12px 16px",
              borderRadius: 10, marginBottom: 20
            }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: 20 }}>
            <label style={{ color: "#475569", fontSize: 13, fontWeight: 500, display: "block", marginBottom: 6 }}>
              Email Address
            </label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="admin@example.com"
              style={{
                width: "100%", padding: "12px 16px",
                border: "1.5px solid #e2e8f0", borderRadius: 10,
                fontSize: 14, outline: "none", backgroundColor: "white",
                color: "#0f172a", boxSizing: "border-box"
              }}
            />
          </div>

          <div style={{ marginBottom: 28 }}>
            <label style={{ color: "#475569", fontSize: 13, fontWeight: 500, display: "block", marginBottom: 6 }}>
              Password
            </label>
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="Enter your password"
              style={{
                width: "100%", padding: "12px 16px",
                border: "1.5px solid #e2e8f0", borderRadius: 10,
                fontSize: 14, outline: "none", backgroundColor: "white",
                color: "#0f172a", boxSizing: "border-box"
              }}
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              width: "100%", padding: "13px",
              backgroundColor: loading ? "#94a3b8" : "#0f172a",
              color: "white", border: "none", borderRadius: 10,
              fontSize: 14, fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              transition: "background 0.2s"
            }}
          >
            {loading ? "Signing in..." : "Sign In →"}
          </button>

          <p style={{ textAlign: "center", color: "#94a3b8", fontSize: 13, marginTop: 24 }}>
            Don't have an admin account?{" "}
            <span
              onClick={() => router.push("/admin/signup")}
              style={{ color: "#2563eb", cursor: "pointer", fontWeight: 500 }}
            >
              Sign up
            </span>
          </p>

          <p style={{ textAlign: "center", marginTop: 12 }}>
            <span
              onClick={() => router.push("/")}
              style={{ color: "#94a3b8", fontSize: 12, cursor: "pointer" }}
            >
              ← Back to home
            </span>
          </p>

        </div>
      </div>
    </div>
  );
}