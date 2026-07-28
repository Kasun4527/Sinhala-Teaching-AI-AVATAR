"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

function VerifyEmailPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [status, setStatus] = useState("verifying"); // verifying | success | error
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) { setStatus("error"); setMessage("No verification token found in the link."); return; }

    fetch(`${BACKEND}/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json();
        if (res.ok) { setStatus("success"); setMessage(data.message); }
        else { setStatus("error"); setMessage(data.detail || "Verification failed."); }
      })
      .catch(() => { setStatus("error"); setMessage("Could not connect to the server. Please try again."); });
  }, [token]);

  const icon = status === "verifying" ? "⏳" : status === "success" ? "✅" : "❌";
  const color = status === "verifying" ? "#2563eb" : status === "success" ? "#16a34a" : "#dc2626";
  const bg    = status === "verifying" ? "#eff6ff" : status === "success" ? "#f0fdf4" : "#fef2f2";
  const border = status === "verifying" ? "#bfdbfe" : status === "success" ? "#bbf7d0" : "#fecaca";

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f8fafc", alignItems: "center", justifyContent: "center", fontFamily: "'Source Sans 3', sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 460, padding: "0 24px" }}>

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", marginBottom: 40 }}>
          <div style={{ backgroundColor: "#2563eb", width: 36, height: 36, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "white", fontWeight: 700, fontSize: 12 }}>IDS</span>
          </div>
          <span style={{ fontWeight: 600, fontSize: 15, color: "#0f172a" }}>IDS Platform</span>
        </div>

        <div style={{ background: "white", borderRadius: 20, padding: "48px 40px", boxShadow: "0 4px 24px rgba(0,0,0,0.07)", textAlign: "center" }}>

          <div style={{ fontSize: 56, marginBottom: 20 }}>{icon}</div>

          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 700, color: "#0f172a", margin: "0 0 12px" }}>
            {status === "verifying" && "Verifying your email…"}
            {status === "success"   && "Email Verified!"}
            {status === "error"     && "Verification Failed"}
          </h1>

          <div style={{
            background: bg, border: `1px solid ${border}`,
            borderRadius: 12, padding: "14px 20px", margin: "20px 0 28px",
          }}>
            <p style={{ margin: 0, color, fontSize: 14, lineHeight: 1.6 }}>
              {status === "verifying" ? "Please wait while we verify your email address…" : message}
            </p>
          </div>

          {status === "verifying" && (
            <div style={{ display: "flex", justifyContent: "center" }}>
              <div style={{
                width: 36, height: 36, borderRadius: "50%",
                border: "3px solid #e2e8f0", borderTop: "3px solid #2563eb",
                animation: "spin 0.8s linear infinite",
              }} />
            </div>
          )}

          {status === "success" && (
            <button
              onClick={() => router.push("/login")}
              style={{
                width: "100%", padding: "13px", backgroundColor: "#2563eb",
                color: "white", border: "none", borderRadius: 10,
                fontSize: 14, fontWeight: 600, cursor: "pointer",
              }}
            >
              Go to Login →
            </button>
          )}

          {status === "error" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <button
                onClick={() => router.push("/signup")}
                style={{
                  width: "100%", padding: "13px", backgroundColor: "#2563eb",
                  color: "white", border: "none", borderRadius: 10,
                  fontSize: 14, fontWeight: 600, cursor: "pointer",
                }}
              >
                Back to Signup
              </button>
              <button
                onClick={() => router.push("/login")}
                style={{
                  width: "100%", padding: "13px", backgroundColor: "transparent",
                  color: "#64748b", border: "1.5px solid #e2e8f0", borderRadius: 10,
                  fontSize: 14, fontWeight: 500, cursor: "pointer",
                }}
              >
                Go to Login
              </button>
            </div>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailPageContent />
    </Suspense>
  );
}
