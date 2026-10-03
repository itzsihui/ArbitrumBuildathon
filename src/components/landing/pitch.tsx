"use client";

import { useRouter } from "next/navigation";
import { PlaceholdersAndVanishInput } from "@/components/ui/placeholders-and-vanish-input";
import { TextGenerateEffect } from "@/components/ui/text-generate-effect";
import { Reveal } from "@/components/landing/reveal";

const BUYER_PLACEHOLDERS = [
  "Buy this limited-edition merch drop",
  "Deploy funds into this tokenized asset",
  "I want a black linen shirt in M",
  "Route my OKB to USDT0 and settle",
  "Authorize USDT0 — show me the locked quote",
];

const SELLER_WORDS =
  "Type what you sell. The store is live for people and for every other agent.";

/** Lean proof tease — merchant first, then buyer. */
export function LandingPitch() {
  const router = useRouter();

  return (
    <div className="relative mx-auto max-w-[1100px] space-y-20 md:space-y-28">
      <Reveal>
        <h2 className="font-[family-name:var(--font-syne)] text-[clamp(1.75rem,4vw,2.75rem)] font-semibold tracking-tight text-[var(--landing-fog)]">
          For sellers
        </h2>
        <div className="mt-5 max-w-[36ch] text-[var(--landing-fog)]">
          <TextGenerateEffect words={SELLER_WORDS} />
        </div>
        <p className="mt-6 max-w-[46ch] text-sm leading-relaxed text-[var(--landing-fog)]/55">
          Publish{" "}
          <span className="font-mono text-[var(--landing-ember)]">
            registry
          </span>{" "}
          and store{" "}
          <span className="font-mono text-[var(--landing-ember)]">
            llms.txt
          </span>
          . Not trapped inside ChatGPT or Claude — open to procurement, local,
          and personal agents too.
        </p>
        <button
          type="button"
          onClick={() => router.push("/merchant/login")}
          className="mt-8 inline-flex h-11 items-center rounded-md bg-[var(--landing-jade)] px-5 text-sm font-medium text-[var(--landing-ink)] transition-opacity hover:opacity-90"
        >
          Continue to Sell
        </button>
      </Reveal>

      <Reveal>
        <h2 className="font-[family-name:var(--font-syne)] text-[clamp(1.75rem,4vw,2.75rem)] font-semibold tracking-tight text-[var(--landing-fog)]">
          For buyers
        </h2>
        <p className="mt-3 max-w-[44ch] text-base leading-relaxed text-[var(--landing-fog)]/55">
          Tell the agent what you want on. It ranks live SKUs via{" "}
          <span className="font-mono text-[var(--landing-ember)]">
            /api/search
          </span>{" "}
          — the same endpoint external agents use — then settles in chat.
        </p>
        <div className="mt-8">
          <PlaceholdersAndVanishInput
            placeholders={BUYER_PLACEHOLDERS}
            onChange={() => {}}
            onSubmit={() => {
              window.setTimeout(() => {
                router.push("/buyer/login");
              }, 700);
            }}
          />
        </div>
      </Reveal>
    </div>
  );
}
