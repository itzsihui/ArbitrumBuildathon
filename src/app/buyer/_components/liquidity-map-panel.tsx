"use client";

import { useEffect, useMemo, useState } from "react";
import {
  cartSettlementTotal,
  estimateOwnershipPoints,
  groupBySettleAsset,
  toSettleLine,
  type SettleLine,
} from "@/lib/outfit-settle";

export type OutfitLineInput = {
  storeSlug: string;
  storeName?: string;
  skuId: string;
  title?: string;
  quantity: number;
  price: string;
  quoteCurrency?: string;
  quotePrice?: string;
  settleAsset?: string;
  settleSymbol?: string;
};

type RoutePreview = {
  needed?: boolean;
  message?: string;
  quote?: {
    mode?: string;
    fromSymbol?: string;
    toSymbol?: string;
    fromAmountHuman?: string;
    toAmountHuman?: string;
    routeSummary?: string;
    networkLabel?: string;
    poolLabel?: string;
    hops?: string[];
    priceImpact?: string;
  };
  balances?: {
    usdt0Human?: string;
    nativeHuman?: string;
    hasEnoughUsdt0?: boolean;
  };
};

export function LiquidityMapPanel({
  lines,
  enabled,
}: {
  lines: OutfitLineInput[];
  enabled: boolean;
}) {
  const [route, setRoute] = useState<RoutePreview | null>(null);
  const [openPools, setOpenPools] = useState(true);

  const settleLines: SettleLine[] = useMemo(
    () =>
      lines.map((l) =>
        toSettleLine({
          storeSlug: l.storeSlug,
          storeName: l.storeName,
          quantity: l.quantity,
          sku: {
            id: l.skuId,
            title: l.title || l.skuId,
            price: l.price,
            quoteCurrency: l.quoteCurrency,
            quotePrice: l.quotePrice,
            settleAsset: l.settleAsset,
            settleSymbol: l.settleSymbol,
          },
        }),
      ),
    [lines],
  );

  const totals = useMemo(
    () => cartSettlementTotal(settleLines),
    [settleLines],
  );
  const groups = useMemo(
    () => groupBySettleAsset(settleLines),
    [settleLines],
  );
  const ownershipPts = estimateOwnershipPoints(totals.total);
  const multiQuote = settleLines.some((l) => l.converts);
  const multiAsset = settleLines.some((l) => l.multiAsset);

  useEffect(() => {
    if (!enabled || settleLines.length === 0) {
      setRoute(null);
      return;
    }
    let cancelled = false;
    void fetch("/api/liquidity", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        execute: false,
        lines: settleLines.map((l) => ({
          storeSlug: l.storeSlug,
          storeName: l.storeName,
          skuId: l.skuId,
          title: l.title,
          quantity: l.quantity,
          price: l.price,
          quoteCurrency: l.quoteCurrency,
          quotePrice: l.quotePrice,
          settleAsset: l.settleAsset,
          settleSymbol: l.settleSymbol,
        })),
      }),
    })
      .then((r) => r.json())
      .then((data: RoutePreview) => {
        if (!cancelled) setRoute(data);
      })
      .catch(() => {
        if (!cancelled) setRoute(null);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, settleLines]);

  if (!enabled || settleLines.length === 0) return null;

  return (
    <div className="mt-4 space-y-3 rounded-md border border-border bg-muted/40 px-3 py-3 text-[13px] leading-relaxed text-foreground/75">
      <div>
        <p className="text-[11px] font-medium tracking-wide text-foreground/50 uppercase">
          Outfit liquidity map
        </p>
        <p className="mt-1">
          Settlement total:{" "}
          <strong>{totals.total.toFixed(2)} USDT0-eq</strong>
          {multiQuote ? " · mixed merchant quote currencies" : null}
          {multiAsset ? " · multi-asset settle rails" : null}
        </p>
        {route?.balances ? (
          <p className="mt-1 text-xs text-foreground/55">
            Wallet: {route.balances.usdt0Human ?? "—"} settle-token ·{" "}
            {route.balances.nativeHuman ?? "—"} OKB
            {route.balances.hasEnoughUsdt0
              ? " (covers)"
              : " (will route if short)"}
          </p>
        ) : (
          <p className="mt-1 text-xs text-foreground/55">
            Set BUYER_PRIVATE_KEY to load live wallet balances.
          </p>
        )}
      </div>

      <div>
        <button
          type="button"
          className="text-[11px] font-medium tracking-wide text-foreground/60 uppercase underline-offset-2 hover:underline"
          onClick={() => setOpenPools((v) => !v)}
        >
          {openPools ? "Hide" : "Show"} route / pools
        </button>
        {openPools ? (
          <div className="mt-2 space-y-2 border-t border-border/60 pt-2">
            {route?.quote ? (
              <div className="font-mono text-[11px] text-foreground/70">
                <p>
                  {route.quote.mode === "live"
                    ? "Live route (OKX DEX, X Layer)"
                    : route.quote.mode === "mainnet-preview"
                      ? "Live OKX DEX quote on X Layer mainnet (196), quote only"
                      : "Plan only (no DEX liquidity on this network)"}
                </p>
                {route.quote.mode === "mainnet-preview" ? (
                  <p className="mt-0.5 text-foreground/55">
                    Settlement (x402 USDT0) runs on X Layer Testnet (1952). This
                    quote is never executed.
                  </p>
                ) : null}
                <p className="mt-1">
                  {route.quote.fromAmountHuman} {route.quote.fromSymbol} → ~
                  {route.quote.toAmountHuman} {route.quote.toSymbol}
                  {route.quote.poolLabel
                    ? ` · pool [${route.quote.poolLabel}]`
                    : null}
                </p>
                {route.quote.priceImpact ? (
                  <p className="mt-0.5">Impact ~{route.quote.priceImpact}%</p>
                ) : null}
                {route.quote.hops?.length ? (
                  <ul className="mt-1 list-inside list-disc text-foreground/55">
                    {route.quote.hops.map((h) => (
                      <li key={h}>{h}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : route?.message ? (
              <p className="text-xs text-foreground/55">{route.message}</p>
            ) : (
              <p className="text-xs text-foreground/55">Loading route…</p>
            )}

            {groups.length > 1 ? (
              <p className="text-[11px] text-foreground/55">
                Full build: {groups.length} settle assets — one DEX route group
                per asset, then per-store x402.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div>
        <p className="text-[11px] font-medium tracking-wide text-foreground/50 uppercase">
          Then settle (x402)
        </p>
        <ul className="mt-1 space-y-1 font-mono text-[11px]">
          {settleLines.map((l) => (
            <li
              key={`${l.storeSlug}:${l.skuId}`}
              className="flex justify-between gap-2 border-t border-border/50 pt-1"
            >
              <span className="min-w-0 truncate text-foreground/55">
                {l.storeName || l.storeSlug} · quoted{" "}
                {l.quotePrice} {l.quoteCurrency}
                {l.converts ? " →" : ""}
              </span>
              <span className="shrink-0 text-foreground">
                {(Number(l.price) * l.quantity).toFixed(2)} {l.settleSymbol}
                {l.multiAsset ? " *" : ""}
              </span>
            </li>
          ))}
        </ul>
        {multiAsset ? (
          <p className="mt-1 text-[10px] text-foreground/45">
            * Alt settleAsset (set ALT_SETTLE_TOKEN for a distinct EIP-3009
            token).
          </p>
        ) : null}
      </div>

      <p className="text-xs text-foreground/55">
        XPoints earned after settle: <strong>+{ownershipPts} XPoints</strong>{" "}
        (protocol fee reward).
      </p>
    </div>
  );
}
