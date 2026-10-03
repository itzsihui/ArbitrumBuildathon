"use client";

import Image from "next/image";
import { useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { StageParallax } from "@/components/landing/stage-parallax";

const VIDEO_SRC = "/media/metal-human.mp4";
const POSTER_SRC = "/media/metal-human.jpg";

/**
 * Full-bleed GetLayers metalHuman loop — 4K master + 2K poster.
 * Falls back to the poster when reduced motion is preferred or autoplay fails.
 */
export function MetalHumanStage() {
  const reduce = useReducedMotion();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showVideo, setShowVideo] = useState(false);

  useEffect(() => {
    if (reduce) {
      setShowVideo(false);
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;

    const tryPlay = async () => {
      try {
        video.muted = true;
        await video.play();
        if (!cancelled) setShowVideo(true);
      } catch {
        if (!cancelled) setShowVideo(false);
      }
    };

    if (video.readyState >= 2) {
      void tryPlay();
    } else {
      video.addEventListener("loadeddata", () => void tryPlay(), { once: true });
    }

    return () => {
      cancelled = true;
    };
  }, [reduce]);

  return (
    <StageParallax>
      <div className="landing-parallax-layer absolute overflow-hidden">
        {/* Bust sits in the right stage — left stays clear for brand + copy */}
        <div className="landing-metal-frame absolute inset-y-0 right-0">
          <Image
            src={POSTER_SRC}
            alt=""
            aria-hidden
            fill
            priority
            sizes="(max-width: 768px) 100vw, 62vw"
            className="object-cover object-[42%_40%]"
          />

          {!reduce ? (
            <video
              ref={videoRef}
              className={`absolute inset-0 h-full w-full object-cover object-[42%_40%] transition-opacity duration-700 ${
                showVideo ? "opacity-100" : "opacity-0"
              }`}
              src={VIDEO_SRC}
              poster={POSTER_SRC}
              muted
              loop
              playsInline
              preload="metadata"
              aria-hidden
            />
          ) : null}
        </div>

        <div className="landing-metal-scrim pointer-events-none absolute inset-0" />
      </div>
    </StageParallax>
  );
}
