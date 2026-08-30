"use client";
import { useRouter } from "next/navigation";

export default function Navbar() {
  const router = useRouter();

  const handleLogout = () => {
    localStorage.clear();
    router.push("/");
  };

  return (
    <nav style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "10px 24px",
      width: "100%",
      maxWidth: "900px",
      margin: "0 auto",
      background: "rgba(255,255,255,0.05)",
      backdropFilter: "blur(12px)",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: "20px",
      boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
    }}>
      {/* Left side: Navigation Links */}
      <div style={{ display: "flex", flex: 1, justifyContent: "space-evenly", alignItems: "center", paddingRight: "48px" }}>
        <button
          onClick={() => router.push("/")}
          style={{
            background: "transparent", border: "none", color: "#cbd5e1", fontSize: 15, fontWeight: 600, cursor: "pointer",
            padding: "8px 16px", borderRadius: "12px",
          }}
          className="hover:text-white hover:bg-white/10 hover:shadow-[0_8px_20px_rgba(37,99,235,0.2)] transition-all duration-300 transform hover:-translate-y-1 hover:scale-110"
        >
          Home
        </button>
        <button 
          onClick={() => {
            if (window.location.pathname === "/dashboard") {
              document.getElementById("other-lessons")?.scrollIntoView({ behavior: "smooth" });
            } else {
              router.push("/dashboard#other-lessons");
            }
          }}
          style={{
            background: "transparent", border: "none", color: "#cbd5e1", fontSize: 15, fontWeight: 600, cursor: "pointer",
            padding: "8px 16px", borderRadius: "12px",
          }}
          className="hover:text-white hover:bg-white/10 hover:shadow-[0_8px_20px_rgba(37,99,235,0.2)] transition-all duration-300 transform hover:-translate-y-1 hover:scale-110"
        >
          Lessons
        </button>
        <button
          onClick={() => router.push("/settings")}
          style={{
            background: "transparent", border: "none", color: "#cbd5e1", fontSize: 15, fontWeight: 600, cursor: "pointer",
            padding: "8px 16px", borderRadius: "12px",
          }}
          className="hover:text-white hover:bg-white/10 hover:shadow-[0_4px_12px_rgba(255,255,255,0.05)] transition-all duration-300 transform hover:-translate-y-1"
        >
          Settings
        </button>
      </div>

      {/* Right side: Actions */}
      <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
        {/* Notification Icon */}
        <button
          style={{
            background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            width: 36, height: 36, borderRadius: "50%",
            backgroundColor: "rgba(255,255,255,0.05)",
          }}
          className="text-[#cbd5e1] hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Notifications"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
          </svg>
        </button>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          style={{
            background: "rgba(255, 255, 255, 0.05)", border: "1px solid rgba(255, 255, 255, 0.1)",
            padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", borderRadius: "10px",
            display: "flex", alignItems: "center", gap: "6px"
          }}
          className="text-[#cbd5e1] hover:bg-white/10 hover:text-white transition-colors"
        >
          <span>Sign Out</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16 17 21 12 16 7"></polyline>
            <line x1="21" y1="12" x2="9" y2="12"></line>
          </svg>
        </button>
      </div>
    </nav>
  );
}
