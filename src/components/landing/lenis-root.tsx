"use client";

import { ReactLenis } from "lenis/react";
import "lenis/dist/lenis.css";

export function LandingLenis({ children }: { children: React.ReactNode }) {
  return (
    <ReactLenis
      root
      options={{
        autoRaf: true,
        lerp: 0.085,
        anchors: true,
        syncTouch: false,
        stopInertiaOnNavigate: true,
      }}
    >
      {children}
    </ReactLenis>
  );
}
