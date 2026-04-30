"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signupUser } from "@/services/api";

export default function AdminSignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async () => {
    setError("");
    setLoading(true);
    try {
      await signupUser({ ...form, role: "admin" });
      router.push("/admin/login");
    } catch (err) {
      setError(err?.response?.data?.detail || "Signup failed");
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
          Admin Registration
        </p>
        <h1 style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 38, fontWeight: 700, color: "white",
          lineHeight: 1.2, marginBottom: 16
        }}>
          Create Your Admin Account
        </h1>
        <p style={{ color: "#64748b", fontSize: 15, lineHeight: 1.6 }}>
          Register as an administrator to manage students and monitor their learning progress.
        </p>
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
            👨‍💼 Administrator Registration
          </div>

          <h2 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 28, fontWeight: 700, color: "#0f172a", marginBottom: 6
          }}>
            Create Admin Account
          </h2>
          <p style={{ color: "#94a3b8", fontSize: 14, marginBottom: 32 }}>
            Fill in your details to register
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

          {[
            { label: "Full Name", name: "name", type: "text", placeholder: "Your full name" },
            { label: "Email Address", name: "email", type: "email", placeholder: "admin@example.com" },
            { label: "Password", name: "password", type: "password", placeholder: "Create a password" },
          ].map((field) => (
            <div key={field.name} style={{ marginBottom: 20 }}>
              <label style={{ color: "#475569", fontSize: 13, fontWeight: 500, display: "block", marginBottom: 6 }}>
                {field.label}
              </label>
              <input
                type={field.type}
                name={field.name}
                value={form[field.name]}
                onChange={handleChange}
                placeholder={field.placeholder}
                style={{
                  width: "100%", padding: "12px 16px",
                  border: "1.5px solid #e2e8f0", borderRadius: 10,
                  fontSize: 14, outline: "none", backgroundColor: "white",
                  color: "#0f172a", boxSizing: "border-box"
                }}
              />
            </div>
          ))}

          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              width: "100%", padding: "13px",
              backgroundColor: loading ? "#94a3b8" : "#0f172a",
              color: "white", border: "none", borderRadius: 10,
              fontSize: 14, fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              marginTop: 8
            }}
          >
            {loading ? "Creating account..." : "Create Admin Account →"}
          </button>

          <p style={{ textAlign: "center", color: "#94a3b8", fontSize: 13, marginTop: 24 }}>
            Already have an account?{" "}
            <span
              onClick={() => router.push("/admin/login")}
              style={{ color: "#2563eb", cursor: "pointer", fontWeight: 500 }}
            >
              Sign in
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