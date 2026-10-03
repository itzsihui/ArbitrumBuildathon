"use client";

import { Reveal } from "@/components/landing/reveal";

const IMPACT = [
  {
    value: "N",
    label: "Tokens in the wallet",
    detail: "ETH, OKB, alts — fragmented for commerce",
  },
  {
    value: "1",
    label: "Settlement asset on X Layer",
    detail: "USDT0 via x402",
  },
  {
    value: "+",
    label: "XPoints on every buy",
    detail: "Protocol micro-fee → rewards for you",
  },
] as const;

export function LandingProblemImpact() {
  return (
    <section
      aria-label="The problem"
      className="relative overflow-hidden border-t border-white/10 bg-[#060908] px-6 py-24 md:px-10 md:py-32"
    >
      <div
        className="landing-grain pointer-events-none absolute inset-0 opacity-30"
        aria-hidden
      />
      <div className="relative mx-auto max-w-[1400px]">
        <Reveal>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--landing-fog)]/40">
            The problem
          </p>
          <h2 className="mt-4 max-w-[22ch] font-[family-name:var(--font-syne)] text-[clamp(1.75rem,4vw,2.75rem)] font-semibold leading-[1.1] tracking-tight text-[var(--landing-fog)]">
            Fragmented balances. Manual swaps. Walled agent catalogs.
          </h2>
          <p className="mt-4 max-w-[48ch] text-base leading-relaxed text-[var(--landing-fog)]/60">
            Buying merch or tokenized assets usually means multi-step
            conversions and separate rails — while open HTTP agents still cannot
            reach inventory locked inside two chat apps.
          </p>
        </Reveal>

        <Reveal className="mt-14 border-t border-white/10 pt-12" delay={0.05}>
          <p className="font-[family-name:var(--font-syne)] text-[clamp(1.75rem,4.5vw,3rem)] font-semibold leading-[1.15] tracking-tight text-[var(--landing-jade)]">
            Intent <span className="text-[var(--landing-fog)]/35">→</span> Route{" "}
            <span className="text-[var(--landing-fog)]/35">→</span> Settle{" "}
            <span className="text-[var(--landing-fog)]/35">→</span> Earn
          </p>
          <p className="mt-5 max-w-[40ch] font-[family-name:var(--font-syne)] text-xl font-medium leading-snug text-[var(--landing-fog)] md:text-2xl">
            One agent loop on X Layer
          </p>
          <p className="mt-3 max-w-[48ch] text-sm leading-relaxed text-[var(--landing-fog)]/50">
            Borneo evaluates the wallet, routes liquidity into USDT0, settles
            with OKX x402, and rewards you with XPoints from the protocol fee —
            so switching is seamless and rewarded.
          </p>
        </Reveal>

        <div className="mt-16 grid gap-10 border-t border-white/10 pt-12 sm:grid-cols-3 sm:gap-8">
          {IMPACT.map((item, i) => (
            <Reveal key={item.label} delay={0.08 * (i + 1)}>
              <p className="font-[family-name:var(--font-syne)] text-[clamp(3rem,8vw,4.5rem)] font-semibold leading-none tracking-tight text-[var(--landing-jade)]">
                {item.value}
              </p>
              <p className="mt-4 max-w-[28ch] font-[family-name:var(--font-syne)] text-lg font-medium leading-snug text-[var(--landing-fog)]">
                {item.label}
              </p>
              <p className="mt-2 text-sm text-[var(--landing-fog)]/50">
                {item.detail}
              </p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
