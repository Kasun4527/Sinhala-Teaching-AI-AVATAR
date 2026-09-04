"use client";

/**
 * MistyCursor — Velocity-aware, multi-color misty smoke trail.
 *
 * Features:
 *  - Cursor speed detection: fast = large wind-burst particles,
 *    slow = dense small clusters
 *  - Multi-color palette: soft neon purple, cyan, pastel pink,
 *    warm white — shifts with position & speed via HSL
 *  - Radial gradient particles with screen-blend volumetric glow
 *  - requestAnimationFrame loop with automatic dead-particle cleanup
 *  - Full viewport canvas, pointer-events-none, z-50
 *  - Resize-safe via window resize listener
 *
 * Usage (app/layout.js):
 *   import MistyCursor from "@/components/MistyCursor";
 *   <body><MistyCursor />{children}</body>
 */

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// Colour palette — soft neon / pastel mist tones (RGBA tuples)
// ---------------------------------------------------------------------------
const PALETTE = [
  [180, 150, 255],   // soft neon purple
  [100, 220, 255],   // electric cyan
  [255, 160, 210],   // pastel pink
  [200, 240, 255],   // icy white-blue
  [160, 255, 200],   // mint green
  [255, 220, 140],   // warm amber mist
];

// ---------------------------------------------------------------------------
// Physics constants
// ---------------------------------------------------------------------------
const FADE_SPEED_BASE  = 0.012;  // opacity decay / frame  (slow movement)
const FADE_SPEED_FAST  = 0.009;  // slower fade when burst (bigger clouds last longer)
const MAX_PARTICLES    = 250;
const VELOCITY_SCALE   = 0.12;   // how much speed amplifies particle size
const BURST_THRESHOLD  = 4;      // px/frame — "fast" movement cutoff

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Interpolate between two numbers */
const lerp = (a, b, t) => a + (b - a) * t;

/**
 * Return an RGBA colour string, optionally shifted by hue.
 * @param {number[]} rgb  - base [r,g,b] from PALETTE
 * @param {number}   opacity
 * @param {number}   hueShift - degrees to shift hue (-30 … 30)
 */
function toRGBA([r, g, b], opacity, hueShift = 0) {
  if (hueShift === 0) return `rgba(${r},${g},${b},${opacity.toFixed(3)})`;
  // Simple hue rotation in RGB space (approximate)
  const cos = Math.cos((hueShift * Math.PI) / 180);
  const sin = Math.sin((hueShift * Math.PI) / 180);
  const nr = Math.min(255, Math.max(0,
    r * (0.213 + cos * 0.787 - sin * 0.213) +
    g * (0.715 - cos * 0.715 - sin * 0.715) +
    b * (0.072 - cos * 0.072 + sin * 0.928)));
  const ng = Math.min(255, Math.max(0,
    r * (0.213 - cos * 0.213 + sin * 0.143) +
    g * (0.715 + cos * 0.285 + sin * 0.140) +
    b * (0.072 - cos * 0.072 - sin * 0.283)));
  const nb = Math.min(255, Math.max(0,
    r * (0.213 - cos * 0.213 - sin * 0.787) +
    g * (0.715 - cos * 0.715 + sin * 0.715) +
    b * (0.072 + cos * 0.928 + sin * 0.072)));
  return `rgba(${Math.round(nr)},${Math.round(ng)},${Math.round(nb)},${opacity.toFixed(3)})`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function MistyCursor() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    // ── Canvas sizing ───────────────────────────────────────────────────────
    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // ── State ────────────────────────────────────────────────────────────────
    const particles = [];
    let lastX = 0, lastY = 0, lastTime = performance.now();
    let speed = 0; // px/frame — smoothed cursor speed

    // ── Spawn logic ──────────────────────────────────────────────────────────
    /**
     * Spawn a burst of particles at (x, y) scaled to cursor speed.
     */
    function spawnCloud(x, y, cursorSpeed) {
      const isFast   = cursorSpeed > BURST_THRESHOLD;
      const count    = isFast ? 7 + Math.floor(cursorSpeed * 0.8) : 4 + Math.floor(Math.random() * 3);
      const cappedCount = Math.min(count, 14);

      for (let i = 0; i < cappedCount; i++) {
        if (particles.length >= MAX_PARTICLES) particles.shift();

        // Pick a colour from palette, shifted slightly by position for variety
        const baseColor = PALETTE[Math.floor(Math.random() * PALETTE.length)];
        const hueShift  = ((x + y) % 60) - 30; // -30..+30 deg based on position

        // Size: slow = small/dense, fast = large/wispy
        const baseRadius = isFast
          ? 18 + cursorSpeed * VELOCITY_SCALE * 6
          : 8 + Math.random() * 10;

        // Opacity: slow = opaque clusters, fast = more transparent wisps
        const opacity = isFast
          ? 0.12 + Math.random() * 0.15
          : 0.20 + Math.random() * 0.25;

        // Drift direction: slightly biased upward + spread by cursor direction
        const angle = Math.random() * Math.PI * 2;
        const drift = isFast ? 0.8 + Math.random() * 1.2 : 0.3 + Math.random() * 0.5;

        particles.push({
          x,
          y,
          radius:  baseRadius,
          opacity,
          vx:      Math.cos(angle) * drift * 0.5,
          vy:      -(0.4 + Math.random() * 0.6) + Math.sin(angle) * drift * 0.2,
          grow:    isFast ? 1.0 + Math.random() * 1.2 : 0.4 + Math.random() * 0.5,
          fade:    isFast ? FADE_SPEED_FAST : FADE_SPEED_BASE + Math.random() * 0.005,
          color:   baseColor,
          hueShift,
        });
      }
    }

    // ── Event listeners ──────────────────────────────────────────────────────
    const onMouseMove = (e) => {
      const now  = performance.now();
      const dt   = Math.max(now - lastTime, 1); // ms
      const dx   = e.clientX - lastX;
      const dy   = e.clientY - lastY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      // Smooth speed: blend raw speed towards current (low-pass filter)
      speed  = lerp(speed, (dist / dt) * 16, 0.3); // *16 normalises to ~px/frame@60fps

      spawnCloud(e.clientX, e.clientY, speed);

      lastX = e.clientX;
      lastY = e.clientY;
      lastTime = now;
    };

    const onTouchMove = (e) => {
      Array.from(e.touches).forEach((t) => {
        spawnCloud(t.clientX, t.clientY, speed);
      });
    };

    window.addEventListener("mousemove",  onMouseMove);
    window.addEventListener("touchmove",  onTouchMove, { passive: true });

    // ── Animation loop ───────────────────────────────────────────────────────
    let rafId;

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = "screen";

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];

        // Update physics
        p.x       += p.vx;
        p.y       += p.vy;
        p.radius  += p.grow;
        p.opacity -= p.fade;
        p.vy      *= 0.995; // slight deceleration of upward drift

        // Cull dead particles
        if (p.opacity <= 0 || p.radius <= 0) {
          particles.splice(i, 1);
          continue;
        }

        // Draw soft radial gradient
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius);
        grad.addColorStop(0,    toRGBA(p.color, p.opacity,           p.hueShift));
        grad.addColorStop(0.35, toRGBA(p.color, p.opacity * 0.60,   p.hueShift * 0.5));
        grad.addColorStop(0.70, toRGBA(p.color, p.opacity * 0.25,   0));
        grad.addColorStop(1,    toRGBA(p.color, 0,                  0));

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
      }

      rafId = requestAnimationFrame(draw);
    }

    rafId = requestAnimationFrame(draw);

    // ── Cleanup ───────────────────────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize",     resize);
      window.removeEventListener("mousemove",  onMouseMove);
      window.removeEventListener("touchmove",  onTouchMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed left-0 top-0 h-full w-full pointer-events-none z-50"
      aria-hidden="true"
    />
  );
}
