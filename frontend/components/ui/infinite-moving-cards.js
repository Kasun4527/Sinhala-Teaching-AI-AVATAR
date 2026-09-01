"use client";

import { cn } from "@/lib/utils";
import React, { useEffect, useState, useRef } from "react";
import { useInView } from "framer-motion";

export const InfiniteMovingCards = ({
  items,
  direction = "right",
  speed = "normal",
  pauseOnHover = true,
  className,
  renderItem
}) => {
  const containerRef = useRef(null);
  const isInView = useInView(containerRef, { once: true, margin: "-100px" });
  const [start, setStart] = useState(false);
  
  useEffect(() => {
    if (isInView) {
      setStart(true);
    }
  }, [isInView]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "scroller relative z-20 max-w-full overflow-hidden [mask-image:linear-gradient(to_right,transparent,white_5%,white_95%,transparent)]",
        className
      )}
    >
      <div
        className={cn(
          "flex min-w-full shrink-0 gap-6 py-4 w-max flex-nowrap",
          start && "animate-scroll",
          pauseOnHover && "hover:[animation-play-state:paused]"
        )}
        style={{
          "--animation-duration": speed === "fast" ? "10s" : speed === "normal" ? "30s" : "60s",
          "--animation-direction": direction === "left" ? "forwards" : "reverse"
        }}
      >
        {[...items, ...items].map((item, idx) => (
          <div
            className="w-[320px] shrink-0"
            key={idx}
          >
             {renderItem(item)}
          </div>
        ))}
      </div>
      <style>{`
        .animate-scroll {
          animation: scroll var(--animation-duration) linear infinite var(--animation-direction);
        }
        @keyframes scroll {
          to {
            transform: translate(calc(-50% - 12px));
          }
        }
      `}</style>
    </div>
  );
};
