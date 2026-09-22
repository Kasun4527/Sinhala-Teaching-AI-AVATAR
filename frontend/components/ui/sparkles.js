"use client";
import React, { useEffect, useRef } from "react";

export const SparklesCore = ({
  id,
  background = "transparent",
  minSize = 0.6,
  maxSize = 1.4,
  particleDensity = 100,
  className,
  particleColor = "#FFFFFF"
}) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let width = canvas.width = canvas.offsetWidth;
    let height = canvas.height = canvas.offsetHeight;

    // Calculate number of particles based on density (100 means dense, scale based on area)
    const area = width * height;
    const particleCount = Math.floor((area / 100000) * particleDensity);
    
    const particles = Array.from({ length: particleCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * (maxSize - minSize) + minSize,
      speedX: (Math.random() - 0.5) * 0.5,
      speedY: (Math.random() - 0.5) * 0.5,
      opacity: Math.random(),
      fadeSpeed: (Math.random() * 0.02) + 0.005,
      fadeDir: Math.random() > 0.5 ? 1 : -1
    }));

    let raf;
    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      if (background !== "transparent") {
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, width, height);
      }

      const hex = particleColor.replace("#", "");
      const r = parseInt(hex.substring(0, 2), 16) || 255;
      const g = parseInt(hex.substring(2, 4), 16) || 255;
      const b = parseInt(hex.substring(4, 6), 16) || 255;

      particles.forEach(p => {
        p.opacity += p.fadeSpeed * p.fadeDir;
        if (p.opacity >= 1) { p.opacity = 1; p.fadeDir = -1; }
        if (p.opacity <= 0) {
          p.opacity = 0;
          p.fadeDir = 1;
          p.x = Math.random() * width;
          p.y = Math.random() * height;
        }

        p.x += p.speedX;
        p.y += p.speedY;
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${p.opacity})`;
        ctx.fill();
      });

      raf = requestAnimationFrame(draw);
    };

    draw();

    const handleResize = () => {
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", handleResize);
    };
  }, [minSize, maxSize, particleDensity, particleColor, background]);

  return (
    <canvas 
      ref={canvasRef} 
      id={id} 
      className={className} 
      style={{ width: "100%", height: "100%", position: "absolute", top: 0, left: 0, pointerEvents: "none" }} 
    />
  );
};
