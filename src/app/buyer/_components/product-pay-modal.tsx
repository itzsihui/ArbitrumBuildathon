"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MarketProductPick, PaymentRail } from "../_lib/buyer-flow";

export function ProductPayModal({
  open,
  product,
  rail,
  onRailChange,
  onClose,
  onPay,
  busy,
  receiptNote,
  firstVisaIssue,
}: {
  open: boolean;
  product: MarketProductPick | null;
  rail: PaymentRail | null;
  onRailChange: (rail: PaymentRail) => void;
  onClose: () => void;
  onPay: () => void;
  busy?: boolean;
  receiptNote?: string | null;
  /** True when buyer has never completed a Visa checkout in this demo account. */
  firstVisaIssue?: boolean;
}) {
  const [step, setStep] = useState<"detail" | "confirm">("detail");

  useEffect(() => {
    if (!open) {
      setStep("detail");
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  if (!open || !product) return null;

  const isVisa = rail === "visa";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-detail-title"
    >
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/50"
        disabled={busy}
        onClick={() => {
          if (!busy) onClose();
        }}
      />
      <div className="relative z-[1] flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden border border-border bg-background shadow-xl">
        <div className="relative aspect-[4/3] bg-muted">
          <Image
            src={product.imageUrl}
            alt={product.title}
            fill
            className="object-cover"
            sizes="512px"
          />
        </div>

        <div className="overflow-y-auto px-5 py-4">
          <h2
            id="product-detail-title"
            className="font-[family-name:var(--font-syne)] text-lg font-semibold tracking-tight"
          >
            {product.quarantined
              ? product.id.includes(":")
                ? product.id.slice(product.id.indexOf(":") + 1)
                : product.id
              : product.title}
          </h2>
          {product.quarantined ? (
            <div className="mt-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-[12px] leading-relaxed text-foreground/80">
              <p className="font-medium text-destructive">
                Catalog injection attempt
              </p>
              <p className="mt-1 text-foreground/65">
                This listing’s title/description tried to act like instructions
                (e.g. retarget pay or skip authorize). That text is untrusted
                data — it cannot change the locked settle fields below.
              </p>
              {product.injectionFlags?.length ? (
                <p className="mt-1.5 font-mono text-[11px] text-foreground/50">
                  Flags: {product.injectionFlags.join(", ")}
                </p>
              ) : null}
            </div>
          ) : null}
          <p className="mt-1 font-mono text-xs text-foreground/50">
            /s/{product.storeSlug} · {product.storeName}
            {product.merchantDisplayName
              ? ` · sold by ${product.merchantDisplayName}`
              : ""}
          </p>
          {product.quarantined ? (
            <p className="mt-2 break-words font-mono text-[11px] leading-relaxed text-foreground/40">
              Raw title (data only): {product.title}
            </p>
          ) : null}
          <p className="mt-3 text-base font-medium">
            {product.price}{" "}
            <span className="text-foreground/50">USDT0</span>
          </p>
          {product.description ? (
            <p className="mt-2 text-sm leading-relaxed text-foreground/70">
              {product.description}
            </p>
          ) : null}

          {step === "detail" ? (
            <div className="mt-5 space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-foreground/50">
                Pay with
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onRailChange("visa")}
                  className={cn(
                    "rounded-lg border p-3 text-left text-sm transition-colors",
                    rail === "visa"
                      ? "border-foreground ring-1 ring-foreground"
                      : "border-border hover:border-foreground/40",
                  )}
                >
                  <span className="font-medium">Visa card</span>
                  <span className="mt-0.5 block text-xs text-foreground/55">
                    {product.visaReceiveLabel
                      ? `Settles to ${product.visaReceiveLabel}`
                      : firstVisaIssue
                        ? "Issue a scoped card and pay"
                        : "Agent-authorized scoped card"}
                  </span>
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onRailChange("stablecoin")}
                  className={cn(
                    "rounded-lg border p-3 text-left text-sm transition-colors",
                    rail === "stablecoin"
                      ? "border-foreground ring-1 ring-foreground"
                      : "border-border hover:border-foreground/40",
                  )}
                >
                  <span className="font-medium">USDT0 · x402</span>
                  <span className="mt-0.5 block text-xs text-foreground/55">
                    {product.merchantAddress
                      ? `To ${product.merchantAddress.slice(0, 6)}…${product.merchantAddress.slice(-4)}`
                      : "X Layer Testnet stablecoin"}
                  </span>
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              <div className="rounded-md border border-border bg-muted/40 px-3 py-3 text-[13px] leading-relaxed text-foreground/75">
                <p className="text-[11px] font-medium tracking-wide text-foreground/50 uppercase">
                  Locked quote
                </p>
                <dl className="mt-2 space-y-1.5 font-mono text-[12px]">
                  <div className="flex justify-between gap-3">
                    <dt className="text-foreground/45">Merchant</dt>
                    <dd className="text-right text-foreground">
                      /s/{product.storeSlug}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-foreground/45">SKU</dt>
                    <dd className="text-right text-foreground">
                      {product.id.includes(":")
                        ? product.id.slice(product.id.indexOf(":") + 1)
                        : product.id}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-foreground/45">Amount</dt>
                    <dd className="text-right text-foreground">
                      {product.price} USDT0
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-foreground/45">Rail</dt>
                    <dd className="text-right text-foreground">
                      {isVisa ? "Visa scoped card" : "USDT0 · x402"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-foreground/45">Authorize</dt>
                    <dd className="text-right text-foreground">Required</dd>
                  </div>
                </dl>
                <p className="mt-3 font-sans text-[12px] leading-relaxed text-foreground/55">
                  {product.quarantined
                    ? "Injection blocked from control flow: payee, amount, SKU, and authorize stay locked to this quote — not the hostile title."
                    : "Untrusted catalog copy cannot change these fields."}
                </p>
              </div>
              <div className="rounded-md border border-border bg-muted/20 px-3 py-2.5 text-[13px] leading-relaxed text-foreground/75">
              {isVisa ? (
                <>
                  {firstVisaIssue ? (
                    <p className="mb-2">
                      A scoped Visa card will be issued for this merchant, then
                      burned after payment.
                    </p>
                  ) : null}
                  Confirm Visa checkout: spend cap ≥{" "}
                  <strong>{product.price}</strong> USDT0 · merchant receive{" "}
                  <strong>
                    {product.visaReceiveLabel || product.storeSlug}
                  </strong>
                  {product.visaReceiveId
                    ? ` (${product.visaReceiveId})`
                    : ""}
                  . The agent will not charge until you authorize.
                </>
              ) : (
                <>
                  Confirm x402 on X Layer Testnet: transfer{" "}
                  <strong>{product.price}</strong> USDT0 to merchant crypto
                  receive{" "}
                  <span className="font-mono text-xs">
                    {product.merchantAddress || "store payTo"}
                  </span>{" "}
                  after HTTP 402, then unlock with PAYMENT-SIGNATURE.
                </>
              )}
              </div>
            </div>
          )}

          {receiptNote ? (
            <p className="mt-3 text-xs text-foreground/60">{receiptNote}</p>
          ) : null}
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-border px-5 py-3">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => {
              if (step === "confirm") setStep("detail");
              else onClose();
            }}
          >
            {step === "confirm" ? "Back" : "Close"}
          </Button>
          {step === "detail" ? (
            <Button
              type="button"
              disabled={busy || !rail}
              onClick={() => setStep("confirm")}
            >
              Continue to pay
            </Button>
          ) : (
            <Button
              type="button"
              disabled={busy || !rail}
              onClick={onPay}
            >
              {busy
                ? "Paying…"
                : product.quarantined
                  ? "Authorize locked settle"
                  : "Authorize purchase"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
