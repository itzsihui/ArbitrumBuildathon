"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  EMPTY_POLICY,
  formatPolicySummary,
  readBuyerAccount,
  applyPolicyPatch,
  updateBuyerAccount,
  writeBuyerAccount,
  type BuyerAccount,
  type GovernancePolicy,
  type GovernanceRule,
} from "@/lib/buyer-account";

function numToInput(v: number | null): string {
  return v == null ? "" : String(v);
}

function parseOptionalNumber(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export default function BuyerGovernancePage() {
  const [account, setAccount] = useState<BuyerAccount | null>(null);
  const [maxTx, setMaxTx] = useState("");
  const [maxDay, setMaxDay] = useState("");
  const [maxWeek, setMaxWeek] = useState("");
  const [maxPerHour, setMaxPerHour] = useState("");
  const [maxPurchasesDay, setMaxPurchasesDay] = useState("");
  const [nlText, setNlText] = useState("");
  const [preview, setPreview] = useState<{
    summary: string;
    policy: Partial<GovernancePolicy>;
    llm?: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hydrate = useCallback((acc: BuyerAccount) => {
    setAccount(acc);
    setMaxTx(numToInput(acc.policy.maxPerTransaction));
    setMaxDay(numToInput(acc.policy.maxPerDay));
    setMaxWeek(numToInput(acc.policy.maxPerWeek));
    setMaxPerHour(numToInput(acc.policy.maxPurchasesPerHour));
    setMaxPurchasesDay(numToInput(acc.policy.maxPurchasesPerDay));
  }, []);

  useEffect(() => {
    const acc = readBuyerAccount();
    if (acc) hydrate(acc);
  }, [hydrate]);

  function policyFromForm(): GovernancePolicy {
    return {
      maxPerTransaction: parseOptionalNumber(maxTx),
      maxPerDay: parseOptionalNumber(maxDay),
      maxPerWeek: parseOptionalNumber(maxWeek),
      maxPurchasesPerHour: parseOptionalNumber(maxPerHour),
      maxPurchasesPerDay: parseOptionalNumber(maxPurchasesDay),
    };
  }

  function saveManual(e: FormEvent) {
    e.preventDefault();
    const policy = policyFromForm();
    const next = updateBuyerAccount({ policy });
    if (!next) {
      setError("No buyer account found");
      return;
    }
    hydrate(next);
    setMessage("Limits saved");
    setError(null);
  }

  async function understand() {
    const text = nlText.trim();
    if (!text) {
      setError("Enter a rule in plain language first");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    setPreview(null);
    try {
      const res = await fetch("/api/buyer-governance", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = (await res.json()) as {
        summary?: string;
        policy?: Partial<GovernancePolicy>;
        llm?: string;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || `Parse failed (HTTP ${res.status})`);
      }
      const policy = data.policy ?? {};
      if (Object.keys(policy).length === 0) {
        setError(
          data.summary ||
            "Could not understand any limits. Try “max 10 per transaction and 100 per day”.",
        );
        return;
      }
      setPreview({
        summary: data.summary || formatPolicySummary({ ...EMPTY_POLICY, ...policy }).join("; "),
        policy,
        llm: data.llm,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Parse failed");
    } finally {
      setBusy(false);
    }
  }

  function savePreview() {
    if (!preview || !account) return;
    const nextPolicy = applyPolicyPatch(account.policy, preview.policy);
    const rule: GovernanceRule = {
      id: crypto.randomUUID(),
      sourceText: nlText.trim(),
      summary: preview.summary,
      createdAt: new Date().toISOString(),
    };
    const next: BuyerAccount = {
      ...account,
      policy: nextPolicy,
      rules: [...account.rules, rule],
    };
    writeBuyerAccount(next);
    hydrate(next);
    setPreview(null);
    setNlText("");
    setMessage("Rule approved and saved to governance");
    setError(null);
  }

  if (!account) {
    return (
      <main className="mx-auto max-w-[1400px] px-6 py-8">
        <p className="text-sm text-muted-foreground">No buyer account yet.</p>
      </main>
    );
  }

  const previewLines = preview
    ? formatPolicySummary({ ...EMPTY_POLICY, ...preview.policy }).filter(
        (l) => l !== "No spend limits set",
      )
    : [];

  return (
    <main className="mx-auto flex max-w-[1400px] flex-col gap-8 px-6 py-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Governance</h1>
        <p className="mt-2 max-w-[58ch] text-sm text-foreground/70">
          Set spend and rate limits. Checkout blocks purchases that would break
          these rules. You can type limits in natural language, review what we
          understood, then save.
        </p>
      </div>

      {error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground/80">
          {message}
        </p>
      ) : null}

      <form
        onSubmit={saveManual}
        className="rounded-lg border border-border bg-background p-5"
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Structured limits
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Blank means unlimited. Values are the source of truth.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <label htmlFor="gov-tx" className="text-sm font-medium">
              Max per transaction
            </label>
            <Input
              id="gov-tx"
              inputMode="decimal"
              value={maxTx}
              onChange={(e) => setMaxTx(e.target.value)}
              placeholder="unlimited"
              className="h-10"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="gov-day" className="text-sm font-medium">
              Max per day
            </label>
            <Input
              id="gov-day"
              inputMode="decimal"
              value={maxDay}
              onChange={(e) => setMaxDay(e.target.value)}
              placeholder="unlimited"
              className="h-10"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="gov-week" className="text-sm font-medium">
              Max per week
            </label>
            <Input
              id="gov-week"
              inputMode="decimal"
              value={maxWeek}
              onChange={(e) => setMaxWeek(e.target.value)}
              placeholder="unlimited"
              className="h-10"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="gov-hour-count" className="text-sm font-medium">
              Max purchases per hour
            </label>
            <Input
              id="gov-hour-count"
              inputMode="numeric"
              value={maxPerHour}
              onChange={(e) => setMaxPerHour(e.target.value)}
              placeholder="unlimited"
              className="h-10"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="gov-day-count" className="text-sm font-medium">
              Max purchases per day
            </label>
            <Input
              id="gov-day-count"
              inputMode="numeric"
              value={maxPurchasesDay}
              onChange={(e) => setMaxPurchasesDay(e.target.value)}
              placeholder="unlimited"
              className="h-10"
            />
          </div>
        </div>
        <Button type="submit" className="mt-4 h-9 px-3">
          Save limits
        </Button>
      </form>

      <section className="rounded-lg border border-border bg-background p-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Natural language rule
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Example: cannot spend more than 10 in 1 transaction and more than 100
          per day
        </p>
        <Textarea
          value={nlText}
          onChange={(e) => setNlText(e.target.value)}
          rows={3}
          className="mt-3"
          placeholder="Describe the rule in plain language…"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            className="h-9 px-3"
            disabled={busy}
            onClick={() => void understand()}
          >
            {busy ? "Understanding…" : "Understand"}
          </Button>
        </div>

        {preview ? (
          <div className="mt-5 rounded-md border border-border bg-muted/30 p-4">
            <p className="text-sm font-medium">What we understood</p>
            <p className="mt-1 text-sm text-foreground/80">{preview.summary}</p>
            <ul className="mt-2 list-inside list-disc text-sm text-foreground/70">
              {previewLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            {preview.llm ? (
              <p className="mt-2 font-mono text-[10px] text-muted-foreground">
                parser={preview.llm}
              </p>
            ) : null}
            <p className="mt-2 text-xs text-muted-foreground">
              Saving overwrites the structured limits above for any field we
              understood (other fields stay unchanged).
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" className="h-9 px-3" onClick={savePreview}>
                Save rule
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-9 px-3"
                onClick={() => setPreview(null)}
              >
                Discard
              </Button>
            </div>
          </div>
        ) : null}
      </section>

      {account.rules.length > 0 ? (
        <section className="rounded-lg border border-border bg-background p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Approved rules
          </p>
          <ul className="mt-3 space-y-2">
            {account.rules
              .slice()
              .reverse()
              .map((rule) => (
                <li
                  key={rule.id}
                  className="rounded-md border border-border/80 px-3 py-2 text-sm"
                >
                  <p className="font-medium text-foreground/90">{rule.summary}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    “{rule.sourceText}”
                  </p>
                </li>
              ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
