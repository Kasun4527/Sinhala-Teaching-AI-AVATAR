"use client";

import { useEffect, useRef } from "react";

export default function HexPattern({ color = "#2563eb" }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let W = canvas.width  = canvas.offsetWidth;
    let H = canvas.height = canvas.offsetHeight;
    let t = 0;

    const SIZE = 38;
    const HX   = SIZE * Math.sqrt(3);
    const HY   = SIZE * 1.5;

    const drawHex = (cx, cy, s, alpha) => {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 6;
        i === 0
          ? ctx.moveTo(cx + s * Math.cos(angle), cy + s * Math.sin(angle))
          : ctx.lineTo(cx + s * Math.cos(angle), cy + s * Math.sin(angle));
      }
      ctx.closePath();
      ctx.strokeStyle = color + Math.round(alpha * 255).toString(16).padStart(2, "0");
      ctx.lineWidth = 1.2;
      ctx.stroke();
    };

    let raf;
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      const cols = Math.ceil(W / HX) + 2;
      const rows = Math.ceil(H / HY) + 2;

      for (let row = -1; row < rows; row++) {
        for (let col = -1; col < cols; col++) {
          const cx    = col * HX + (row % 2 === 0 ? HX / 2 : 0);
          const cy    = row * HY;
          const wave  = Math.sin(t + col * 0.4 + row * 0.35);
          const alpha = 0.10 + Math.abs(wave) * 0.32;
          const s     = SIZE * (0.85 + Math.abs(wave) * 0.18);
          drawHex(cx, cy, s, alpha);
        }
      }
      t += 0.012;
      raf = requestAnimationFrame(draw);
    };
    draw();

    const onResize = () => {
      W = canvas.width  = canvas.offsetWidth;
      H = canvas.height = canvas.offsetHeight;
    };
    window.addEventListener("resize", onResize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); };
  }, [color]);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
    />
  );
}
