"use client";

import { useLenis } from "lenis/react";
import { useReducedMotion } from "motion/react";
import { useRef } from "react";

/** Soft parallax on the hero stage — tied to Lenis scroll. */
export function StageParallax({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  useLenis((lenis) => {
    if (reduce || !ref.current) return;
    const y = Math.min(lenis.scroll * 0.22, 180);
    ref.current.style.setProperty("--landing-parallax", `${y}px`);
  });

  return (
    <div ref={ref} className="landing-parallax-target">
      {children}
    </div>
  );
}
