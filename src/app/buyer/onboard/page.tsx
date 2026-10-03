"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createBuyerAccount,
  readBuyerAccount,
  updateBuyerAccount,
  writeBuyerAccount,
  type GovernancePolicy,
} from "@/lib/buyer-account";
import { useBuyerAuth } from "../_components/buyer-auth-provider";

function parseOptionalNumber(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export default function BuyerOnboardPage() {
  const router = useRouter();
  const auth = useBuyerAuth();
  const existing = readBuyerAccount();
  const [step, setStep] = useState<1 | 2>(existing?.displayName ? 2 : 1);
  const [name, setName] = useState(
    existing?.displayName || auth.user?.displayName || "",
  );
  const [maxTx, setMaxTx] = useState("");
  const [maxDay, setMaxDay] = useState("");
  const [maxWeek, setMaxWeek] = useState("");
  const [error, setError] = useState<string | null>(null);

  function onNameSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Enter a display name to continue");
      return;
    }
    setError(null);
    setStep(2);
  }

  function finish(policy?: Partial<GovernancePolicy>) {
    if (!name.trim()) {
      setError("Enter a display name to continue");
      setStep(1);
      return;
    }

    const current = readBuyerAccount();
    if (current) {
      updateBuyerAccount({
        displayName: name.trim(),
        email: auth.user?.email ?? current.email,
        policy: { ...current.policy, ...policy },
      });
    } else {
      createBuyerAccount({
        displayName: name.trim() || auth.user?.displayName || "Buyer",
        email: auth.user?.email ?? undefined,
        policy,
      });
    }

    const saved = readBuyerAccount();
    if (saved) writeBuyerAccount(saved);

    void auth.refreshAccount().then(() => {
      router.replace("/buyer");
    });
  }

  function onLimitsSubmit(e: FormEvent) {
    e.preventDefault();
    finish({
      maxPerTransaction: parseOptionalNumber(maxTx),
      maxPerDay: parseOptionalNumber(maxDay),
      maxPerWeek: parseOptionalNumber(maxWeek),
    });
  }

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-6 px-6 pt-24 pb-12">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Buyer onboarding
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          {step === 1 ? "Set up your buyer" : "Optional spend limits"}
        </h1>
        <p className="mt-2 text-sm text-foreground/70">
          {step === 1
            ? "A short profile so governance and checkout know who is buying. No card yet."
            : "You can skip this and set limits later in Governance. Leave blank for unlimited."}
        </p>
      </div>

      {error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {step === 1 ? (
        <form onSubmit={onNameSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="buyer-name" className="text-sm font-medium">
              Display name
            </label>
            <Input
              id="buyer-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Alex"
              autoFocus
              className="h-10"
            />
            {auth.user?.email ? (
              <p className="text-xs text-muted-foreground">
                Signed in as {auth.user.email}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Stored in this browser
                {auth.configured ? " and synced when signed in" : ""}.
              </p>
            )}
          </div>
          <Button type="submit" className="h-10 px-4">
            Continue
          </Button>
        </form>
      ) : (
        <form onSubmit={onLimitsSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <label htmlFor="max-tx" className="text-sm font-medium">
                Per transaction
              </label>
              <Input
                id="max-tx"
                inputMode="decimal"
                value={maxTx}
                onChange={(e) => setMaxTx(e.target.value)}
                placeholder="e.g. 10"
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="max-day" className="text-sm font-medium">
                Per day
              </label>
              <Input
                id="max-day"
                inputMode="decimal"
                value={maxDay}
                onChange={(e) => setMaxDay(e.target.value)}
                placeholder="e.g. 100"
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="max-week" className="text-sm font-medium">
                Per week
              </label>
              <Input
                id="max-week"
                inputMode="decimal"
                value={maxWeek}
                onChange={(e) => setMaxWeek(e.target.value)}
                placeholder="optional"
                className="h-10"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-10 px-4"
              onClick={() => setStep(1)}
            >
              Back
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-10 px-4"
              onClick={() => finish()}
            >
              Skip for now
            </Button>
            <Button type="submit" className="h-10 px-4">
              Save and shop
            </Button>
          </div>
        </form>
      )}
    </main>
  );
}
