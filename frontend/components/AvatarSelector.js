"use client";

import { useState } from "react";
import AvatarTeacher from "./AvatarTeacher";
import Avatar3D from "./Avatar3D";

/**
 * Wraps AvatarTeacher (avtr-1) and Avatar3D (full-body) with a toggle pill.
 * Passes all props through unchanged to whichever avatar is active.
 */
export default function AvatarSelector(props) {
  const [mode, setMode] = useState("avtr1"); // "avtr1" | "3d"

  return (
    <div>
      {/* Toggle pill */}
      <div style={{
        display: "flex", gap: 0, marginBottom: 12,
        background: "#1e293b", borderRadius: 10, padding: 4,
        width: "fit-content",
      }}>
        {[
          { key: "avtr1", label: "👩‍🏫 AVTR-1" },
          { key: "3d",    label: "🧍 Full Body" },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setMode(key)}
            style={{
              padding: "7px 18px", borderRadius: 7, border: "none",
              background: mode === key ? "#3b82f6" : "transparent",
              color: mode === key ? "white" : "#94a3b8",
              fontWeight: 600, fontSize: 12, cursor: "pointer",
              transition: "all 0.18s ease",
              boxShadow: mode === key ? "0 2px 8px rgba(59,130,246,0.4)" : "none",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Avatar */}
      {mode === "avtr1"
        ? <AvatarTeacher {...props} />
        : <Avatar3D     {...props} />
      }
    </div>
  );
}
