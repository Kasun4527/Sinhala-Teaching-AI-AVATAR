"use client";

import { useEffect, useState, useRef } from "react";

export default function CursorGlow({ color = "#3b82f6", opacity = 0.12, size = 800, zIndex = 50 }) {
  const glowRef = useRef(null);

  useEffect(() => {
    let rafId = null;
    let mouseX = -1000;
    let mouseY = -1000;
    let currentX = -1000;
    let currentY = -1000;
    
    const handleMouseMove = (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };

    const animate = () => {
      // Smooth easing (intertia)
      currentX += (mouseX - currentX) * 0.12;
      currentY += (mouseY - currentY) * 0.12;

      if (glowRef.current) {
        glowRef.current.style.transform = `translate(${currentX}px, ${currentY}px)`;
      }

      rafId = requestAnimationFrame(animate);
    };

    window.addEventListener("mousemove", handleMouseMove);
    rafId = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  const hex2rgb = (hex) => {
    const v = hex.replace('#', '');
    if (v.length !== 6) return { r: 59, g: 130, b: 246 }; // fallback blue
    return {
      r: parseInt(v.substring(0, 2), 16),
      g: parseInt(v.substring(2, 4), 16),
      b: parseInt(v.substring(4, 6), 16)
    };
  };

  const rgb = hex2rgb(color);
  const gradientColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;

  return (
    <div
      style={{
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
        pointerEvents: "none", zIndex: zIndex, overflow: "hidden"
      }}
    >
      <div
        ref={glowRef}
        style={{
          position: "absolute",
          top: -size / 2,
          left: -size / 2,
          width: size,
          height: size,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${gradientColor} 0%, transparent 60%)`,
          willChange: "transform",
        }}
      />
    </div>
  );
}
