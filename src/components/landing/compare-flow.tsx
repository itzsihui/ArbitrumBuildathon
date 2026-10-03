"use client";

import {
  ProhibitIcon,
  CheckCircleIcon,
} from "@phosphor-icons/react";
import { Reveal } from "@/components/landing/reveal";
import { Separator } from "@/components/ui/separator";
import { Terminal } from "@/components/ui/terminal";
import { cn } from "@/lib/utils";

const CLOSED_STEPS = [
  "Merchant catalog",
  "Stripe / partner agent surface",
  "ChatGPT app",
  "Claude browser or app",
] as const;

const BLOCKED = [
  "Procurement agents",
  "Local LLMs",
  "Personal agents",
  "Cursor / custom runners",
] as const;

const WHY_LOSES = [
  "Reach is rented from two apps — not owned as a protocol.",
  "Personal, on-prem, and procurement agents cannot shop the same listings.",
  "Merchants stay invisible to the long tail of agents.",
] as const;

const OPEN_STEPS = [
  { label: "Publish", mono: "registry · llms.txt" },
  { label: "Discover", mono: "GET /api/search" },
  { label: "Any HTTP agent", mono: "procurement · local · personal" },
  { label: "Settle", mono: "USDT0 · x402 · POST /buy" },
] as const;

function FlowStep({
  label,
  index,
  muted,
}: {
  label: string;
  index: number;
  muted?: boolean;
}) {
  return (
    <li className={cn("flex items-center gap-3", muted && "opacity-45")}>
      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full border font-mono text-[11px]",
          muted
            ? "border-white/15 text-[var(--landing-fog)]/50"
            : "border-white/20 text-[var(--landing-fog)]/70",
        )}
      >
        {index}
      </span>
      <span
        className={cn(
          "text-sm leading-snug",
          muted
            ? "text-[var(--landing-fog)]/50"
            : "text-[var(--landing-fog)]/85",
        )}
      >
        {label}
      </span>
    </li>
  );
}

export function LandingCompareFlow() {
  return (
    <>
      <section
        aria-label="What exists today"
        className="relative overflow-hidden border-t border-white/10 bg-[#050708] px-6 py-24 md:px-10 md:py-32"
      >
        <div
          className="landing-grain pointer-events-none absolute inset-0 opacity-25"
          aria-hidden
        />
        <div className="relative mx-auto max-w-[1400px]">
          <Reveal>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--landing-fog)]/40">
              What exists today
            </p>
            <h2 className="mt-4 max-w-[20ch] font-[family-name:var(--font-syne)] text-[clamp(1.75rem,4vw,2.75rem)] font-semibold leading-[1.1] tracking-tight text-[var(--landing-fog)]">
              Catalogs shouldn&apos;t only live inside two chat apps.
            </h2>
            <p className="mt-4 max-w-[48ch] text-base leading-relaxed text-[var(--landing-fog)]/55">
              Stripe-style agent commerce lists products where ChatGPT and
              Claude can reach them. Everything else is locked out.
            </p>
          </Reveal>

          <div className="mt-14 grid gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)] lg:gap-16">
            <Reveal>
              <p className="font-[family-name:var(--font-syne)] text-sm font-medium text-[var(--landing-fog)]/70">
                Closed path
              </p>
              <ol className="mt-6 space-y-4">
                {CLOSED_STEPS.map((step, i) => (
                  <FlowStep key={step} label={step} index={i + 1} />
                ))}
              </ol>
            </Reveal>

            <Reveal delay={0.1}>
              <p className="flex items-center gap-2 font-[family-name:var(--font-syne)] text-sm font-medium text-[var(--landing-fog)]/50">
                <ProhibitIcon
                  className="size-4 text-[var(--landing-fog)]/45"
                  weight="bold"
                  aria-hidden
                />
                Blocked
              </p>
              <ul className="mt-6 space-y-3">
                {BLOCKED.map((agent) => (
                  <li
                    key={agent}
                    className="border-l border-white/10 pl-4 text-sm text-[var(--landing-fog)]/45 line-through decoration-white/20"
                  >
                    {agent}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>

          <Separator className="mt-14 bg-white/10" />

          <Reveal className="mt-12">
            <p className="font-[family-name:var(--font-syne)] text-lg font-medium text-[var(--landing-fog)]">
              Why it loses
            </p>
            <ul className="mt-6 max-w-2xl space-y-4">
              {WHY_LOSES.map((line) => (
                <li
                  key={line}
                  className="flex gap-3 text-sm leading-relaxed text-[var(--landing-fog)]/60"
                >
                  <span
                    className="mt-2 size-1.5 shrink-0 rounded-full bg-[var(--landing-fog)]/35"
                    aria-hidden
                  />
                  {line}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      <section
        aria-label="Borneo open protocol"
        className="relative overflow-hidden border-t border-white/10 bg-[#060908] px-6 py-24 md:px-10 md:py-32"
      >
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden
          style={{
            background:
              "radial-gradient(ellipse 70% 45% at 20% 0%, oklch(0.35 0.06 155 / 0.2), transparent 55%)",
          }}
        />
        <div
          className="landing-grain pointer-events-none absolute inset-0 opacity-25"
          aria-hidden
        />
        <div className="relative mx-auto max-w-[1400px]">
          <Reveal>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--landing-jade)]/70">
              Borneo
            </p>
            <h2 className="mt-4 max-w-[16ch] font-[family-name:var(--font-syne)] text-[clamp(1.75rem,4vw,2.75rem)] font-semibold leading-[1.1] tracking-tight text-[var(--landing-fog)]">
              Open protocol. Any agent. Same settle rails.
            </h2>
            <p className="mt-4 max-w-[48ch] text-base leading-relaxed text-[var(--landing-fog)]/55">
              Publish once. Humans shop in chat. Procurement bots, local LLMs,
              and personal agents hit the same{" "}
              <span className="font-mono text-[var(--landing-ember)]">
                /api/search
              </span>{" "}
              and settle USDT0 via x402.
            </p>
          </Reveal>

          <div className="mt-14 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-start lg:gap-14">
            <ol className="space-y-6">
              {OPEN_STEPS.map((step, i) => (
                <Reveal key={step.label} delay={0.06 * i}>
                  <li className="flex gap-4">
                    <CheckCircleIcon
                      className="mt-0.5 size-5 shrink-0 text-[var(--landing-jade)]"
                      weight="fill"
                      aria-hidden
                    />
                    <div>
                      <p className="font-[family-name:var(--font-syne)] text-lg font-medium text-[var(--landing-fog)]">
                        {step.label}
                      </p>
                      <p className="mt-1 font-mono text-xs text-[var(--landing-ember)]">
                        {step.mono}
                      </p>
                    </div>
                  </li>
                </Reveal>
              ))}
            </ol>

            <Reveal delay={0.12}>
              <div className="overflow-hidden rounded-md border border-[var(--landing-jade)]/25 bg-[#0f1419]">
                <div className="border-b border-white/10 px-4 py-3">
                  <p className="font-[family-name:var(--font-syne)] text-sm font-medium text-[var(--landing-fog)]">
                    Any agent can call
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--landing-fog)]/45">
                    No ChatGPT or Claude gate
                  </p>
                </div>
                <div className="p-3 [&_.no-visible-scrollbar]:!h-48">
                  <Terminal
                    username="agent"
                    enableSound={false}
                    typingSpeed={26}
                    delayBetweenCommands={700}
                    initialDelay={400}
                    className="max-w-none px-0"
                    commands={[
                      "curl /registry.json",
                      "curl '/api/search?q=linen+shirt'",
                      "curl -X POST /s/canopy-wear/buy",
                    ]}
                    outputs={{
                      0: ["# stores[] · agent-readable index"],
                      1: [
                        '{ "mode": "semantic", "products": [/* ranked */] }',
                      ],
                      2: ["HTTP 402 · PAYMENT-REQUIRED · then settle"],
                    }}
                  />
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>
    </>
  );
}
