"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, BookOpen, User, ShieldCheck, Sparkles, TrendingUp, Bot } from "lucide-react";

export default function UserManual() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="font-body" style={{
      minHeight: "100vh",
      width: "100vw",
      background: "linear-gradient(to bottom, #020617 0%, #0f172a 100%)",
      color: "white",
      padding: "40px 20px"
    }}>
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        
        {/* Header */}
        <button 
          onClick={() => router.back()}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "transparent", border: "none", color: "#94a3b8",
            cursor: "pointer", fontSize: 14, fontWeight: 500, marginBottom: 30,
            padding: 0
          }}
        >
          <ArrowLeft size={16} /> Back
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 40 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: "linear-gradient(135deg, #10b981, #059669)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 8px 24px rgba(16, 185, 129, 0.4)"
          }}>
            <BookOpen size={28} color="white" />
          </div>
          <div>
            <h1 className="text-section-title" style={{ margin: 0 }}>SUBHASHA User Manual</h1>
            <p className="text-body c-muted" style={{ margin: 0, marginTop: 4 }}>
              How to use the Sinhala AI Avatar Teaching Platform
            </p>
          </div>
        </div>

        {/* Content Sections */}
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          
          {/* Section 1: Introduction */}
          <section style={{
            background: "rgba(255, 255, 255, 0.03)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: 20, padding: 30
          }}>
            <h2 style={{ fontSize: 22, fontWeight: 600, color: "#60a5fa", display: "flex", alignItems: "center", gap: 10, marginTop: 0 }}>
              <Sparkles size={20} /> Introduction
            </h2>
            <p style={{ color: "#cbd5e1", lineHeight: 1.7, fontSize: 15, margin: 0 }}>
              Welcome to SUBHASHA, Sri Lanka's first AI Avatar teaching platform. The system uses a Hybrid BKT + LSTM engine to predict your knowledge level and adapts its teaching dynamically. Whether you are a student learning a new subject or a teacher monitoring progress, this manual will guide you through the features.
            </p>
          </section>

          {/* Section 2: For Students */}
          <section style={{
            background: "rgba(255, 255, 255, 0.03)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: 20, padding: 30
          }}>
            <h2 style={{ fontSize: 22, fontWeight: 600, color: "#34d399", display: "flex", alignItems: "center", gap: 10, marginTop: 0 }}>
              <User size={20} /> For Students
            </h2>
            <ul style={{ color: "#cbd5e1", lineHeight: 1.8, fontSize: 15, paddingLeft: 20, margin: 0 }}>
              <li><strong>Registration & Login:</strong> Select "Student" from the role selection page and create your account.</li>
              <li><strong>Pre-Quiz:</strong> Before starting a new topic, take the diagnostic pre-quiz. This helps the AI understand your current knowledge level.</li>
              <li><strong>AI Avatar Lessons:</strong> Watch and interact with the Sinhala AI Avatar. The Avatar explains concepts tailored specifically to your pre-quiz results.</li>
              <li><strong style={{ display: "flex", alignItems: "center", gap: 6, display: "inline-flex" }}><Bot size={16} color="#60a5fa" /> Instant Q&A:</strong> Ask questions at any time during the lesson. The AI will respond instantly in Sinhala with a personalized answer.</li>
              <li><strong style={{ display: "flex", alignItems: "center", gap: 6, display: "inline-flex" }}><TrendingUp size={16} color="#c084fc" /> Track Progress:</strong> Check your dashboard to see your mastery scores and learning trajectory.</li>
            </ul>
          </section>

          {/* Section 3: For Teachers / Teachers */}
          <section style={{
            background: "rgba(255, 255, 255, 0.03)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: 20, padding: 30
          }}>
            <h2 style={{ fontSize: 22, fontWeight: 600, color: "#f472b6", display: "flex", alignItems: "center", gap: 10, marginTop: 0 }}>
              <ShieldCheck size={20} /> For Teachers (Teachers)
            </h2>
            <ul style={{ color: "#cbd5e1", lineHeight: 1.8, fontSize: 15, paddingLeft: 20, margin: 0 }}>
              <li><strong>Teacher Login:</strong> Select "Teacher" or "Teacher" from the role selection page to access the teacher dashboard.</li>
              <li><strong>Student Monitoring:</strong> View real-time analytics on student performance, quiz results, and mastery levels across all subjects.</li>
              <li><strong>Content Management:</strong> (Coming soon) Add new topics, questions, and course material that the AI can seamlessly integrate into its lessons.</li>
              <li><strong>System Insights:</strong> Monitor the performance of the predictive AI engine and identify areas where students collectively struggle.</li>
            </ul>
          </section>

        </div>
        
        {/* Footer */}
        <div style={{ marginTop: 40, textAlign: "center", color: "#64748b", fontSize: 13 }}>
          &copy; {new Date().getFullYear()} SUBHASHA Platform. All rights reserved.
        </div>
      </div>
    </div>
  );
}
