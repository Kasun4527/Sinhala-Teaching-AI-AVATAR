"use client";

import { useEffect, useRef } from "react";

/**
 * InteractiveParticles
 * ---------------------------------------------------------------------------
 * A dependency-free canvas "constellation" background: a field of drifting
 * dots that link into a web of lines whenever they're near each other, and
 * additionally link to the mouse cursor (with a small ring marking its
 * position) — the effect from the reference screen recording, where nodes
 * near the pointer light up and connect while the rest of the field stays
 * sparse.
 *
 * Usage:
 *   <div className="relative overflow-hidden">
 *     <InteractiveParticles className="absolute inset-0" />
 *     <div className="relative z-10"> ...your content... </div>
 *   </div>
 */
export default function InteractiveParticles({
  className = "",
  color = "#38bdf8", // sky-400 — swap for any brand accent hex
  particleCount = 70,
  connectDistance = 120,
  mouseRadius = 160,
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const ctx = canvas.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    let W = 0;
    let H = 0;
    let particles = [];
    let raf;
    const mouse = { x: null, y: null, active: false };

    const hexToRgb = (hex) => {
      const clean = hex.replace("#", "");
      const bigint = parseInt(clean, 16);
      return {
        r: (bigint >> 16) & 255,
        g: (bigint >> 8) & 255,
        b: bigint & 255,
      };
    };
    const { r, g, b } = hexToRgb(color);
    const rgba = (alpha) => `rgba(${r},${g},${b},${alpha})`;

    const seedParticles = () => {
      particles = Array.from({ length: particleCount }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        r: 1.4 + Math.random() * 1.8,
      }));
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      W = rect.width;
      H = rect.height;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seedParticles();
    };

    const onMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
      mouse.active = true;
    };
    const onMouseLeave = () => {
      mouse.active = false;
    };

    const draw = () => {
      ctx.clearRect(0, 0, W, H);

      // Particle-to-particle links
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.hypot(dx, dy);
          if (dist < connectDistance) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = rgba((1 - dist / connectDistance) * 0.35);
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }

      // Cursor-to-particle links + glowing cursor ring
      if (mouse.active && mouse.x !== null) {
        for (const p of particles) {
          const dx = p.x - mouse.x;
          const dy = p.y - mouse.y;
          const dist = Math.hypot(dx, dy);
          if (dist < mouseRadius) {
            const t = 1 - dist / mouseRadius;
            ctx.beginPath();
            ctx.moveTo(mouse.x, mouse.y);
            ctx.lineTo(p.x, p.y);
            ctx.strokeStyle = rgba(t * 0.7);
            ctx.lineWidth = 1.1;
            ctx.stroke();

            // brighten activated nodes
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r + t * 1.5, 0, Math.PI * 2);
            ctx.fillStyle = rgba(0.5 + t * 0.5);
            ctx.fill();
          }
        }

        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, 9, 0, Math.PI * 2);
        ctx.strokeStyle = rgba(0.9);
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Dots (drawn after links so they sit on top)
      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = rgba(0.55);
        ctx.fill();

        if (!prefersReducedMotion) {
          p.x += p.vx;
          p.y += p.vy;
          if (p.x < 0 || p.x > W) p.vx *= -1;
          if (p.y < 0 || p.y > H) p.vy *= -1;
        }
      }

      raf = requestAnimationFrame(draw);
    };

    resize();
    draw();

    window.addEventListener("resize", resize);
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mouseleave", onMouseLeave);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mouseleave", onMouseLeave);
    };
  }, [color, particleCount, connectDistance, mouseRadius]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ display: "block", width: "100%", height: "100%" }}
    />
  );
}
