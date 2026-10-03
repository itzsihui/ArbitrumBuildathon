"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ownershipInviteUrl,
  readOwnership,
  type OwnershipState,
} from "@/lib/ownership";

export default function BuyerXPointsPage() {
  const [state, setState] = useState<OwnershipState | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setState(readOwnership());
  }, []);

  const refresh = useCallback(() => setState(readOwnership()), []);

  const copyInvite = useCallback(async () => {
    const url = ownershipInviteUrl();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }, []);

  if (!state) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-10">
        <p className="text-sm text-foreground/55">Loading XPoints…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl space-y-8 px-6 py-10">
      <header className="space-y-2">
        <h1 className="font-[family-name:var(--font-syne)] text-2xl font-semibold tracking-tight">
          XPoints
        </h1>
        <p className="text-sm leading-relaxed text-foreground/60">
          Every USDT0 purchase earns XPoints from Borneo&apos;s protocol
          micro-fee. Invite friends — they get a boost, and the loop grows
          switching incentives without leaving X Layer.
        </p>
      </header>

      <section className="border border-border bg-muted/30 px-5 py-6">
        <p className="text-xs uppercase tracking-wide text-foreground/45">
          Your balance
        </p>
        <p className="mt-2 font-[family-name:var(--font-syne)] text-4xl font-semibold tabular-nums">
          {state.balance}
          <span className="ml-2 text-base font-normal text-foreground/50">
            XPoints
          </span>
        </p>
        <p className="mt-2 text-xs text-foreground/50">
          Demo rewards ledger — not a token or a security. Merchant still
          receives full listed USDT0.
        </p>
      </section>

      <section className="space-y-3 border border-border px-5 py-5">
        <h2 className="text-sm font-medium">Friend&apos;s loop</h2>
        <p className="text-xs text-foreground/55">
          Share your invite. New buyers who land with{" "}
          <code className="text-[11px]">?ref=</code> earn +25% XPoints on their
          first purchases.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <code className="rounded border border-border bg-muted/40 px-2 py-1 font-mono text-xs">
            {state.inviteCode}
          </code>
          <Button type="button" size="sm" variant="outline" onClick={copyInvite}>
            {copied ? "Copied" : "Copy invite link"}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={refresh}>
            Refresh
          </Button>
        </div>
        {state.referredBy ? (
          <p className="text-xs text-foreground/55">
            You joined via <span className="font-mono">{state.referredBy}</span>
          </p>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Earnings</h2>
        {state.accruals.length === 0 ? (
          <p className="text-sm text-foreground/50">
            No XPoints yet — complete a USDT0 purchase in Shop to start
            earning.
          </p>
        ) : (
          <ul className="divide-y divide-border border border-border">
            {[...state.accruals].reverse().map((a) => (
              <li
                key={a.id}
                className="flex items-start justify-between gap-4 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {a.reason === "friend_boost"
                      ? "Friend boost"
                      : "Purchase reward"}
                    {a.storeSlug ? (
                      <span className="ml-2 font-mono text-xs text-foreground/45">
                        /s/{a.storeSlug}
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-xs text-foreground/45">
                    {new Date(a.at).toLocaleString()}
                    {a.orderId
                      ? ` · order ${a.orderId.slice(0, 8)}…`
                      : null}
                  </p>
                </div>
                <p className="shrink-0 tabular-nums text-foreground/80">
                  +{a.points}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
