"use client";

/**
 * CursorGlow — DagHub-style multi-color cursor glow overlay.
 *
 * Pure Canvas 2D (no WebGL, works in every browser).
 * Renders 4 overlapping radial-gradient blobs that each lerp
 * toward the cursor at different speeds, creating a layered,
 * organic glow trail.
 *
 * Blob stack (slowest → fastest / largest → smallest):
 *   1. Deep violet  — r=380px, lerp 0.06  (long lazy tail)
 *   2. Electric cyan — r=260px, lerp 0.09
 *   3. Hot magenta  — r=180px, lerp 0.12
 *   4. Soft white   — r=100px, lerp 0.18  (tight bright core)
 *
 * Canvas CSS: mix-blend-mode: screen → colours "add" to dark
 * backgrounds, giving a volumetric neon-glow effect.
 */

import { useEffect, useRef } from "react";

/* ── Blob definitions ─────────────────────────────────────────────────── */
const BLOBS = [
  { r: 380, rgb: [110,  60, 255], alpha: 0.28, lerp: 0.06 }, // violet
  { r: 260, rgb: [  0, 200, 255], alpha: 0.22, lerp: 0.09 }, // cyan
  { r: 180, rgb: [255,  50, 200], alpha: 0.20, lerp: 0.12 }, // magenta
  { r: 100, rgb: [210, 235, 255], alpha: 0.45, lerp: 0.18 }, // white core
];

export default function CursorGlow() {
  const cvs = useRef(null);

  useEffect(() => {
    const canvas = cvs.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    /* ── Sizing ─────────────────────────────────────────────────────── */
    let W = window.innerWidth;
    let H = window.innerHeight;
    const resize = () => {
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width  = W;
      canvas.height = H;
    };
    resize();

    /* ── State: each blob tracks its own smoothed position ─────────── */
    const state = BLOBS.map(() => ({ x: W / 2, y: H / 2 }));
    let mouseX = W / 2;
    let mouseY = H / 2;
    let active = false; // only draw after first mouse event

    /* ── Mouse / touch tracking ─────────────────────────────────────── */
    const onMove = (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      active = true;
    };
    const onTouch = (e) => {
      mouseX = e.touches[0].clientX;
      mouseY = e.touches[0].clientY;
      active = true;
    };

    /* ── Animation loop ──────────────────────────────────────────────── */
    let raf;

    function draw() {
      ctx.clearRect(0, 0, W, H);

      if (active) {
        for (let i = 0; i < BLOBS.length; i++) {
          const b = BLOBS[i];
          const s = state[i];

          // Smooth lerp towards cursor
          s.x += (mouseX - s.x) * b.lerp;
          s.y += (mouseY - s.y) * b.lerp;

          // Radial gradient: colour at centre → transparent at edge
          const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, b.r);
          const [r, gr, bl] = b.rgb;
          g.addColorStop(0,   `rgba(${r},${gr},${bl},${b.alpha})`);
          g.addColorStop(0.5, `rgba(${r},${gr},${bl},${(b.alpha * 0.35).toFixed(3)})`);
          g.addColorStop(1,   `rgba(${r},${gr},${bl},0)`);

          ctx.beginPath();
          ctx.arc(s.x, s.y, b.r, 0, Math.PI * 2);
          ctx.fillStyle = g;
          ctx.fill();
        }
      }

      raf = requestAnimationFrame(draw);
    }

    raf = requestAnimationFrame(draw);

    window.addEventListener("mousemove",  onMove);
    window.addEventListener("touchmove",  onTouch, { passive: true });
    window.addEventListener("resize",     resize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove",  onMove);
      window.removeEventListener("touchmove",  onTouch);
      window.removeEventListener("resize",     resize);
    };
  }, []);

  return (
    <canvas
      ref={cvs}
      aria-hidden="true"
      style={{
        position:      "fixed",
        inset:         0,
        width:         "100%",
        height:        "100%",
        pointerEvents: "none",
        zIndex:        9999,
        mixBlendMode:  "screen",   /* blobs ADD to dark bg → neon glow */
      }}
    />
  );
}
