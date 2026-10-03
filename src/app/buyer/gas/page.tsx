"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { Button } from "@/components/ui/button";
import { shortAddress } from "@/lib/wallet/ethereum";
import { cn } from "@/lib/utils";

type BridgeRole = "buyer" | "facilitator";

type Wallet = {
  roles: BridgeRole[];
  address: string;
  parentBalanceEth: string;
  childBalanceEth: string;
};

type Overview = {
  parentChain: string;
  childChain: string;
  maxDepositEth: number;
  wallets: Wallet[];
};

type DepositStage =
  | "parent_pending"
  | "parent_failed"
  | "child_pending"
  | "deposited";

type DepositStatus = {
  parentTxHash: string;
  parentTxUrl: string;
  stage: DepositStage;
  parentConfirmations: number;
  amountEth: string | null;
  to: string | null;
  childTxHash: string | null;
  childTxUrl: string | null;
};

type TrackedDeposit = {
  parentTxHash: string;
  role?: BridgeRole;
  amountEth?: string;
  createdAt: string;
  status?: DepositStatus;
  error?: string;
};

const STORAGE_KEY = "borneo.bridge.deposits";
const POLL_MS = 10_000;

const STORAGE_EVENT = "borneo-bridge-deposits";

function parseTracked(raw: string): TrackedDeposit[] {
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function readTracked(): TrackedDeposit[] {
  return parseTracked(localStorage.getItem(STORAGE_KEY) || "[]");
}

function writeTracked(list: TrackedDeposit[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 20)));
  window.dispatchEvent(new Event(STORAGE_EVENT));
}

function updateTracked(fn: (list: TrackedDeposit[]) => TrackedDeposit[]) {
  writeTracked(fn(readTracked()));
}

function subscribeTracked(onChange: () => void) {
  window.addEventListener(STORAGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(STORAGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function isFinal(d: TrackedDeposit) {
  return d.status?.stage === "deposited" || d.status?.stage === "parent_failed";
}

async function fetchOverview(): Promise<Overview> {
  const res = await fetch("/api/bridge", { cache: "no-store" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to load balances");
  return data;
}

function formatEth(value: string) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(5) : value;
}

export default function BuyerGasPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [selectedRole, setRole] = useState<BridgeRole>("facilitator");
  const [amount, setAmount] = useState("0.01");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [trackHash, setTrackHash] = useState("");
  const depositsRaw = useSyncExternalStore(
    subscribeTracked,
    () => localStorage.getItem(STORAGE_KEY) || "[]",
    () => "[]",
  );
  const deposits = useMemo(() => parseTracked(depositsRaw), [depositsRaw]);

  const loadOverview = useCallback(
    () =>
      fetchOverview().then(
        (data) => {
          setOverview(data);
          setOverviewError(null);
        },
        (error) =>
          setOverviewError(
            error instanceof Error ? error.message : String(error),
          ),
      ),
    [],
  );

  const pollOne = useCallback(
    async (hash: string) => {
      try {
        const res = await fetch(`/api/bridge/status?tx=${hash}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Status lookup failed");
        updateTracked((list) =>
          list.map((d) =>
            d.parentTxHash === hash
              ? { ...d, status: data as DepositStatus, error: undefined }
              : d,
          ),
        );
        if ((data as DepositStatus).stage === "deposited") loadOverview();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        updateTracked((list) =>
          list.map((d) =>
            d.parentTxHash === hash ? { ...d, error: message } : d,
          ),
        );
      }
    },
    [loadOverview],
  );

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const pendingKey = deposits
    .filter((d) => !isFinal(d))
    .map((d) => d.parentTxHash)
    .join(",");

  useEffect(() => {
    if (!pendingKey) return;
    const hashes = pendingKey.split(",");
    hashes.forEach(pollOne);
    const id = setInterval(() => hashes.forEach(pollOne), POLL_MS);
    return () => clearInterval(id);
  }, [pendingKey, pollOne]);

  const availableRoles = useMemo<BridgeRole[]>(
    () =>
      overview
        ? Array.from(new Set(overview.wallets.flatMap((w) => w.roles)))
        : [],
    [overview],
  );

  const role =
    availableRoles.includes(selectedRole) || !availableRoles.length
      ? selectedRole
      : availableRoles[0];

  const addTracked = (entry: TrackedDeposit) =>
    updateTracked((list) => [
      entry,
      ...list.filter((d) => d.parentTxHash !== entry.parentTxHash),
    ]);

  const submit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/bridge/deposit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role, amountEth: amount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Deposit failed");
      addTracked({
        parentTxHash: data.parentTxHash,
        role,
        amountEth: amount,
        createdAt: new Date().toISOString(),
      });
      loadOverview();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : String(error));
    } finally {
      setSubmitting(false);
    }
  };

  const track = () => {
    const hash = trackHash.trim();
    if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) {
      setSubmitError("Paste a 0x… deposit transaction hash.");
      return;
    }
    setSubmitError(null);
    setTrackHash("");
    addTracked({ parentTxHash: hash, createdAt: new Date().toISOString() });
  };

  const parentChain = overview?.parentChain ?? "Ethereum";
  const childChain = overview?.childChain ?? "Arbitrum";

  return (
    <main className="mx-auto max-w-2xl space-y-8 px-6 py-10">
      <header className="space-y-2">
        <h1 className="font-[family-name:var(--font-syne)] text-2xl font-semibold tracking-tight">
          Gas top-up
        </h1>
        <p className="text-sm leading-relaxed text-foreground/60">
          The x402 relayer pays {childChain} gas in ETH to settle every USDC
          purchase. Bridge ETH from {parentChain} through Arbitrum&apos;s
          canonical bridge with the Arbitrum SDK — no external bridge UI.
        </p>
      </header>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Server wallets</h2>
          <Button type="button" size="sm" variant="ghost" onClick={loadOverview}>
            Refresh
          </Button>
        </div>
        {overviewError ? (
          <p className="text-sm text-destructive">{overviewError}</p>
        ) : !overview ? (
          <p className="text-sm text-foreground/50">Loading balances…</p>
        ) : overview.wallets.length === 0 ? (
          <p className="text-sm text-foreground/50">
            No wallet configured. Set BUYER_PRIVATE_KEY (and optionally
            FACILITATOR_PRIVATE_KEY) in .env.
          </p>
        ) : (
          <ul className="divide-y divide-border border border-border">
            {overview.wallets.map((w) => (
              <li
                key={w.address}
                className="flex items-start justify-between gap-4 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-mono">{shortAddress(w.address, 6)}</p>
                  <p className="mt-0.5 text-xs capitalize text-foreground/45">
                    {w.roles.join(" + ")}
                  </p>
                </div>
                <div className="text-right text-xs tabular-nums">
                  <p>
                    <span className="text-foreground/45">{parentChain} </span>
                    {formatEth(w.parentBalanceEth)} ETH
                  </p>
                  <p className="mt-0.5">
                    <span className="text-foreground/45">{childChain} </span>
                    {formatEth(w.childBalanceEth)} ETH
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4 border border-border bg-muted/30 px-5 py-5">
        <h2 className="text-sm font-medium">
          Bridge {parentChain} → {childChain}
        </h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-1 text-xs text-foreground/55">
            <span>Wallet</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as BridgeRole)}
              className="block h-8 border border-border bg-background px-2 text-sm text-foreground"
              disabled={!availableRoles.length}
            >
              {availableRoles.map((r) => (
                <option key={r} value={r}>
                  {r === "facilitator" ? "Relayer (facilitator)" : "Buyer"}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs text-foreground/55">
            <span>Amount (ETH)</span>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              className="block h-8 w-28 border border-border bg-background px-2 text-sm tabular-nums text-foreground"
            />
          </label>
          <Button
            type="button"
            onClick={submit}
            disabled={submitting || !availableRoles.length}
          >
            {submitting ? "Sending…" : "Bridge to Arbitrum"}
          </Button>
        </div>
        <p className="text-xs text-foreground/50">
          Max {overview?.maxDepositEth ?? "—"} ETH per deposit. ETH usually
          lands on {childChain} about 10–15 minutes after the {parentChain}{" "}
          transaction confirms.
        </p>
        {submitError ? (
          <p className="text-sm text-destructive">{submitError}</p>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Deposits</h2>
        <div className="flex gap-2">
          <input
            value={trackHash}
            onChange={(e) => setTrackHash(e.target.value)}
            placeholder={`Track an existing ${parentChain} deposit tx (0x…)`}
            className="h-8 flex-1 border border-border bg-background px-2 font-mono text-xs"
          />
          <Button type="button" size="sm" variant="outline" onClick={track}>
            Track
          </Button>
        </div>
        {deposits.length === 0 ? (
          <p className="text-sm text-foreground/50">No deposits yet.</p>
        ) : (
          <ul className="space-y-3">
            {deposits.map((d) => (
              <DepositCard
                key={d.parentTxHash}
                deposit={d}
                parentChain={parentChain}
                childChain={childChain}
              />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function DepositCard({
  deposit,
  parentChain,
  childChain,
}: {
  deposit: TrackedDeposit;
  parentChain: string;
  childChain: string;
}) {
  const s = deposit.status;
  const stage = s?.stage ?? "parent_pending";
  const failed = stage === "parent_failed";
  const stepIndex =
    stage === "deposited" ? 3 : stage === "child_pending" ? 2 : 1;
  const steps = [
    `Sent on ${parentChain}`,
    `Confirmed on ${parentChain}`,
    `Credited on ${childChain}`,
  ];
  const amount = s?.amountEth ?? deposit.amountEth;

  return (
    <li className="space-y-3 border border-border px-4 py-4 text-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-medium tabular-nums">
            {amount ? `${amount} ETH` : "ETH deposit"}
            {deposit.role ? (
              <span className="ml-2 text-xs font-normal capitalize text-foreground/45">
                {deposit.role}
              </span>
            ) : null}
          </p>
          <p className="mt-0.5 text-xs text-foreground/45">
            {new Date(deposit.createdAt).toLocaleString()}
          </p>
        </div>
        <p
          className={cn(
            "text-xs",
            failed
              ? "text-destructive"
              : stage === "deposited"
                ? "text-emerald-600"
                : "text-foreground/55",
          )}
        >
          {failed
            ? "Failed"
            : stage === "deposited"
              ? "Deposited"
              : stage === "child_pending"
                ? "Waiting for Arbitrum…"
                : "Confirming…"}
        </p>
      </div>

      <ol className="grid grid-cols-3 gap-2">
        {steps.map((label, i) => {
          const done = !failed && i < stepIndex;
          const active = !failed && i === stepIndex;
          return (
            <li key={label} className="space-y-1.5">
              <div
                className={cn(
                  "h-1",
                  done
                    ? "bg-emerald-500"
                    : active
                      ? "animate-pulse bg-foreground/30"
                      : failed && i === 1
                        ? "bg-destructive"
                        : "bg-foreground/10",
                )}
              />
              <p
                className={cn(
                  "text-[11px]",
                  done ? "text-foreground/80" : "text-foreground/45",
                )}
              >
                {label}
              </p>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <a
          href={s?.parentTxUrl ?? "#"}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-foreground/60 underline-offset-2 hover:underline"
        >
          {parentChain}: {shortAddress(deposit.parentTxHash, 6)}
        </a>
        {s?.childTxUrl ? (
          <a
            href={s.childTxUrl}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-foreground/60 underline-offset-2 hover:underline"
          >
            {childChain}: {shortAddress(s.childTxHash ?? "", 6)}
          </a>
        ) : null}
        {s && stage !== "parent_pending" ? (
          <span className="text-foreground/45">
            {s.parentConfirmations} confirmations
          </span>
        ) : null}
      </div>
      {deposit.error ? (
        <p className="text-xs text-destructive">{deposit.error}</p>
      ) : null}
    </li>
  );
}
