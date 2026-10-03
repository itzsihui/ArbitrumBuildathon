"use client";

import { useEffect } from "react";
import { motion, stagger, useAnimate, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

export const TextGenerateEffect = ({
  words,
  className,
  filter = true,
  duration = 0.5,
}: {
  words: string;
  className?: string;
  filter?: boolean;
  duration?: number;
}) => {
  const [scope, animate] = useAnimate();
  const reduce = useReducedMotion();
  const wordsArray = words.split(" ");

  useEffect(() => {
    if (reduce) return;
    animate(
      "span",
      {
        opacity: 1,
        filter: filter ? "blur(0px)" : "none",
      },
      {
        duration: duration ? duration : 1,
        delay: stagger(0.08),
      },
    );
  }, [animate, duration, filter, reduce]);

  const renderWords = () => {
    return (
      <motion.div ref={scope}>
        {wordsArray.map((word, idx) => {
          return (
            <motion.span
              key={word + idx}
              className={cn(
                "text-current",
                reduce ? "opacity-100" : "opacity-0",
              )}
              style={{
                filter: reduce ? "none" : filter ? "blur(10px)" : "none",
              }}
            >
              {word}{" "}
            </motion.span>
          );
        })}
      </motion.div>
    );
  };

  return (
    <div className={cn("font-medium", className)}>
      <div className="text-xl leading-snug tracking-tight md:text-2xl">
        {renderWords()}
      </div>
    </div>
  );
};
