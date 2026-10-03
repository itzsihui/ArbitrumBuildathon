"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Check, ChevronDown, Circle, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ChainStepStatus = "pending" | "active" | "complete" | "error";

export type ChainStepCapability = "privileged" | "untrusted";

export type ChainStep = {
  id: string;
  title: string;
  status: ChainStepStatus;
  description?: string;
  /** CaMeL-shaped tag: privileged = shopper intent; untrusted = catalog data only */
  capability?: ChainStepCapability;
  bullets?: string[];
  links?: Array<{ label: string; href: string }>;
  protocolLines?: Array<{ role: string; text: string }>;
};

function StatusIcon({ status }: { status: ChainStepStatus }) {
  if (status === "complete") {
    return (
      <span className="flex size-5 items-center justify-center rounded-full bg-foreground text-background">
        <Check className="size-3" strokeWidth={3} />
      </span>
    );
  }
  if (status === "active") {
    return (
      <span className="flex size-5 items-center justify-center rounded-full border border-foreground/30">
        <Loader2 className="size-3 animate-spin text-foreground" />
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="flex size-5 items-center justify-center rounded-full bg-destructive/15 text-destructive">
        <X className="size-3" strokeWidth={3} />
      </span>
    );
  }
  return (
    <span className="flex size-5 items-center justify-center rounded-full border border-border">
      <Circle className="size-2 text-foreground/30" fill="currentColor" />
    </span>
  );
}

function StepBody({ step }: { step: ChainStep }) {
  return (
    <div className="mt-1.5 space-y-2 pl-0.5 text-sm text-foreground/70">
      {step.description ? <p>{step.description}</p> : null}
      {step.bullets?.length ? (
        <ul className="list-inside list-disc space-y-0.5 text-[13px]">
          {step.bullets.map((b, i) => (
            <li key={`${step.id}-bullet-${i}`}>{b}</li>
          ))}
        </ul>
      ) : null}
      {step.links?.length ? (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {step.links.map((link, i) => (
            <a
              key={`${step.id}-link-${i}-${link.href}`}
              href={link.href}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-border bg-muted/40 px-2.5 py-0.5 font-mono text-[11px] text-foreground/80 hover:bg-muted"
            >
              {link.label}
            </a>
          ))}
        </div>
      ) : null}
      {step.protocolLines?.length ? (
        <div className="mt-1 space-y-1 rounded-md border border-border bg-[#0f1419] p-2.5 font-mono text-[11px] leading-relaxed text-[#c8d0d8]">
          {step.protocolLines.map((line, i) => (
            <p key={`${step.id}-proto-${i}`} className="whitespace-pre-wrap break-all">
              <span className="text-[#8a949e]">{line.role}: </span>
              {/^https?:\/\//i.test(line.text.trim()) ? (
                <a
                  className="text-[#8ec8a8] underline-offset-2 hover:underline"
                  href={line.text.trim()}
                  target="_blank"
                  rel="noreferrer"
                >
                  {line.text.trim()}
                </a>
              ) : (
                line.text
              )}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ChainOfThought({
  steps,
  className,
  footer,
  title = "Agent reasoning",
  variant = "panel",
  live = false,
  liveSummary = "Searching catalog…",
  errorSummary = "Search needs attention",
}: {
  steps: ChainStep[];
  className?: string;
  footer?: ReactNode;
  title?: string;
  /** `chat` nests inside the salesperson stream — chat-reasoning style. */
  variant?: "panel" | "chat";
  /** When true, keep the disclosure open (search / settle in flight). */
  live?: boolean;
  /** Chat-variant label while steps are active / live. */
  liveSummary?: string;
  /** Chat-variant label when a step failed. */
  errorSummary?: string;
}) {
  const completed = steps.filter((s) => s.status === "complete").length;
  const hasError = steps.some((s) => s.status === "error");
  const hasActive = steps.some((s) => s.status === "active");
  const embedded = variant === "chat";
  const [open, setOpen] = useState(embedded ? live || hasActive : true);

  useEffect(() => {
    if (!embedded) return;
    if (live || hasActive) setOpen(true);
    else if (completed === steps.length || hasError) setOpen(false);
  }, [embedded, live, hasActive, completed, steps.length, hasError]);

  const summary =
    live || hasActive
      ? liveSummary
      : hasError
        ? errorSummary
        : `Thought · ${completed} steps`;

  return (
    <section
      className={cn(
        embedded
          ? "w-full max-w-3xl overflow-hidden rounded-xl border border-border/80 bg-transparent"
          : "flex min-h-0 flex-col border border-border bg-background",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center gap-2 text-left",
          embedded
            ? "px-1 py-1.5 text-foreground/55 hover:text-foreground"
            : "justify-between border-b border-border px-4 py-3",
        )}
      >
        {embedded ? (
          <>
            {live || hasActive ? (
              <Loader2 className="size-3.5 shrink-0 animate-spin" />
            ) : (
              <ChevronDown
                className={cn(
                  "size-3.5 shrink-0 transition-transform",
                  open ? "rotate-0" : "-rotate-90",
                )}
              />
            )}
            <span className="text-xs font-medium tracking-tight">{summary}</span>
          </>
        ) : (
          <>
            <div>
              <p className="font-[family-name:var(--font-syne)] text-sm font-semibold tracking-tight">
                {title}
              </p>
              <p className="mt-0.5 text-xs text-foreground/55">
                {steps.length} steps · {completed} complete
                {hasError ? " · needs attention" : ""}
              </p>
            </div>
            <ChevronDown
              className={cn(
                "size-4 shrink-0 text-foreground/50 transition-transform",
                open ? "rotate-0" : "-rotate-90",
              )}
            />
          </>
        )}
      </button>

      {open ? (
        <div
          className={cn(
            embedded
              ? "mt-1 rounded-xl border border-border bg-muted/25 px-3.5 py-3"
              : "flex-1 overflow-y-auto px-4 py-4",
          )}
        >
          <ol className="relative space-y-0">
            {steps.map((step, index) => {
              const isLast = index === steps.length - 1;
              return (
                <li key={step.id} className="relative flex gap-3 pb-5 last:pb-0">
                  {!isLast ? (
                    <span
                      aria-hidden
                      className="absolute top-5 left-[9px] h-[calc(100%-8px)] w-px bg-border"
                    />
                  ) : null}
                  <div className="relative z-[1] mt-0.5 shrink-0">
                    <StatusIcon status={step.status} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "flex flex-wrap items-center gap-2 text-sm font-medium",
                        step.status === "pending" && "text-foreground/45",
                        step.status === "active" && "text-foreground",
                        step.status === "complete" && "text-foreground",
                        step.status === "error" && "text-destructive",
                      )}
                    >
                      <span>{step.title}</span>
                      {step.capability ? (
                        <span
                          className={cn(
                            "rounded-full px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase",
                            step.capability === "privileged"
                              ? "bg-foreground/10 text-foreground/70"
                              : "bg-amber-500/15 text-amber-800 dark:text-amber-200/90",
                          )}
                        >
                          {step.capability === "privileged"
                            ? "Your intent"
                            : "Catalog data"}
                        </span>
                      ) : null}
                    </p>
                    {(step.status === "active" ||
                      step.status === "complete" ||
                      step.status === "error") && <StepBody step={step} />}
                  </div>
                </li>
              );
            })}
          </ol>
          {footer}
        </div>
      ) : null}
    </section>
  );
}

/** @deprecated Prefer ChainOfThought — kept for buyer import compatibility. */
export const BuyerChainOfThought = ChainOfThought;
