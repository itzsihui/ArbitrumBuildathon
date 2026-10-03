"use client";

import {
  FormEvent,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ArrowLeft, ArrowUp, Loader2, Paperclip, Plus, Store, Trash2 } from "lucide-react";
import { Button as MovingBorderButton } from "@/components/ui/moving-border";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { MerchantDraft } from "@/lib/inventory/parse";
import {
  FASHION_SUBCATEGORIES,
  axisLabel,
  axisPlaceholder,
  axisSelectPrompt,
  enrichFashionMeta,
  fashionDef,
  formatFashionSkuTitle,
  isFashionLineComplete,
  missingAxes,
  type FashionSubcategory,
} from "@/lib/inventory/fashion";

export type ChatLine = {
  role: "merchant" | "borneo";
  text: string;
  llm?: string;
};

export type StarterAction = "describe" | "import" | "url";

export type ComposerMode = "choose" | StarterAction;

const STARTERS: Array<{ action: StarterAction; label: string }> = [
  { action: "describe", label: "Add product" },
  { action: "import", label: "Import CSV" },
  { action: "url", label: "Store URL" },
];

export function MerchantChat({
  lines,
  message,
  setMessage,
  busy,
  onSubmit,
  onFile,
  storeUrl,
  setStoreUrl,
  onImportUrl,
  belowMessages,
  onStarter,
  onOpenSheet,
  sheetSkuCount,
  className,
}: {
  lines: ChatLine[];
  message: string;
  setMessage: (value: string) => void;
  busy: boolean;
  onSubmit: (event: FormEvent) => void;
  onFile: (file: File) => void;
  storeUrl?: string;
  setStoreUrl?: (value: string) => void;
  onImportUrl?: () => void;
  belowMessages?: ReactNode;
  onStarter?: (action: StarterAction) => void;
  onOpenSheet?: () => void;
  sheetSkuCount?: number;
  className?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<ComposerMode>("choose");

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [lines, busy, belowMessages]);

  function pick(action: StarterAction) {
    setMode(action);
    onStarter?.(action);
  }

  function backToChoose() {
    setMode("choose");
  }

  const empty = lines.length <= 1;

  return (
    <section
      className={cn(
        "flex min-h-0 flex-1 flex-col overflow-hidden border border-border bg-background",
        className,
      )}
    >
      <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
            <Store className="size-3.5" />
          </span>
          <div className="min-w-0">
            <h2 className="font-[family-name:var(--font-syne)] text-sm font-semibold tracking-tight">
              Merchant agent
            </h2>
            <p className="truncate text-[11px] text-foreground/50">
              Inventory · prices · publish
            </p>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div
          ref={scrollerRef}
          className="min-h-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden overscroll-contain px-4 py-4 [scrollbar-gutter:stable] sm:px-6"
        >
          {empty ? (
            <div className="flex min-h-[160px] flex-col items-center justify-center px-4 text-center">
              <p className="font-[family-name:var(--font-syne)] text-lg font-semibold tracking-tight">
                What are you selling?
              </p>
              <p className="mt-2 max-w-[40ch] text-sm text-foreground/55">
                Apparel, accessories, shoes — describe stock, import a CSV, or
                paste a Shopify URL. Then set USDT0 prices and publish.
              </p>
            </div>
          ) : null}

          {lines.map((line, index) => {
            const isUser = line.role === "merchant";
            const showSheetCta =
              !isUser &&
              onOpenSheet &&
              (sheetSkuCount ?? 0) > 0 &&
              (/inventory sheet|SKU|skus|store is now live|Loaded \d+|Confirm fashion|fashion SKU|Added \d+ product/i.test(
                line.text,
              ) ||
                index === lines.length - 1);
            return (
              <div key={`${line.role}-${index}`} className="space-y-2">
                <div
                  className={cn(
                    "flex",
                    isUser ? "justify-end" : "justify-start",
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[min(90%,42rem)] min-w-0 rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
                      isUser
                        ? "bg-foreground text-background"
                        : "border border-border bg-muted/40 text-foreground",
                    )}
                  >
                    {line.text}
                    {showSheetCta ? (
                      <button
                        type="button"
                        onClick={onOpenSheet}
                        className="mt-2 block text-xs font-medium text-primary underline-offset-2 hover:underline"
                      >
                        View inventory sheet
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}

          {belowMessages}

          {busy ? (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl border border-border bg-muted/40 px-3.5 py-2.5 text-sm text-foreground/60">
                <Loader2 className="size-3.5 animate-spin" />
                Working…
              </div>
            </div>
          ) : null}
        </div>

        <div className="shrink-0 border-t border-border p-3 sm:px-6">
          {mode === "choose" && !busy ? (
            <div className="mb-2.5 flex flex-wrap gap-1.5">
              {STARTERS.map((chip) => (
                <button
                  key={chip.action}
                  type="button"
                  onClick={() => pick(chip.action)}
                  className="rounded-full border border-border px-3 py-1 text-xs text-foreground/70 transition-colors hover:bg-muted"
                >
                  {chip.label}
                </button>
              ))}
              <button
                type="button"
                disabled={busy}
                onClick={() => {}}
                className="rounded-full border border-dashed border-border px-3 py-1 text-xs text-foreground/40"
                title="Placeholder for the demo"
              >
                Connect CRM
              </button>
            </div>
          ) : null}

          {mode === "choose" ? (
            <form
              onSubmit={onSubmit}
              className="flex items-end gap-2 rounded-2xl border border-border bg-muted/20 p-2 shadow-sm"
            >
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    e.currentTarget.form?.requestSubmit();
                  }
                }}
                rows={1}
                disabled={busy}
                placeholder="Describe your fashion inventory…"
                className="max-h-28 min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-foreground/40"
              />
              <button
                type="submit"
                disabled={busy || !message.trim()}
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-opacity disabled:opacity-40"
                aria-label="Send"
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ArrowUp className="size-4" />
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={onSubmit} className="flex flex-col gap-2.5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={busy}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full px-2 text-xs text-foreground/70 transition-colors hover:bg-muted disabled:opacity-40"
                  onClick={backToChoose}
                >
                  <ArrowLeft className="size-3.5" />
                  Back
                </button>
                <p className="text-xs font-medium text-foreground/60">
                  {mode === "describe"
                    ? "Add product"
                    : mode === "import"
                      ? "Import CSV"
                      : mode === "url"
                        ? "Store URL"
                        : "Connect X Layer wallet"}
                </p>
              </div>

              {mode === "describe" ? (
                <div className="flex items-end gap-2 rounded-2xl border border-border bg-muted/20 p-2 shadow-sm">
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={2}
                    disabled={busy}
                    autoFocus
                    placeholder='e.g. "10 linen shirts, 8 tote bags, 6 sneakers"'
                    className="max-h-28 min-h-[48px] flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-foreground/40"
                  />
                  <button
                    type="submit"
                    disabled={busy || !message.trim()}
                    className="flex size-9 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-opacity disabled:opacity-40"
                    aria-label="Send"
                  >
                    {busy ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <ArrowUp className="size-4" />
                    )}
                  </button>
                </div>
              ) : null}

              {mode === "import" ? (
                <button
                  type="button"
                  disabled={busy}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-border bg-muted/20 px-4 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-40"
                  onClick={() => fileRef.current?.click()}
                >
                  <Paperclip className="size-4" />
                  {busy ? "Uploading…" : "Choose CSV file"}
                </button>
              ) : null}

              {mode === "url" ? (
                <div className="flex items-center gap-2 rounded-2xl border border-border bg-muted/20 p-2 shadow-sm">
                  <input
                    value={storeUrl ?? ""}
                    onChange={(e) => setStoreUrl?.(e.target.value)}
                    placeholder="your-store.myshopify.com"
                    disabled={busy}
                    autoFocus
                    className="min-h-[40px] flex-1 bg-transparent px-2 text-sm outline-none placeholder:text-foreground/40"
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      e.preventDefault();
                      if ((storeUrl ?? "").trim()) onImportUrl?.();
                    }}
                  />
                  <button
                    type="button"
                    disabled={busy || !(storeUrl ?? "").trim()}
                    className="flex size-9 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-opacity disabled:opacity-40"
                    onClick={() => onImportUrl?.()}
                    aria-label="Import URL"
                  >
                    {busy ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <ArrowUp className="size-4" />
                    )}
                  </button>
                </div>
              ) : null}

              <input
                ref={fileRef}
                type="file"
                accept=".csv,.txt,.tsv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onFile(file);
                  e.target.value = "";
                }}
              />
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

export function PriceDraftForm({
  draft,
  setDraft,
  prices,
  setPrices,
  quantities,
  setQuantities,
  busy,
  onSubmit,
  walletReady = true,
}: {
  draft: MerchantDraft;
  setDraft: (draft: MerchantDraft) => void;
  prices: string[];
  setPrices: (prices: string[]) => void;
  quantities: string[];
  setQuantities: (quantities: string[]) => void;
  busy: boolean;
  onSubmit: () => void;
  walletReady?: boolean;
}) {
  const hasLines = draft.lines.length > 0;
  const allTitled = draft.lines.every((line) => line.title.trim().length > 0);
  const allPriced = draft.lines.every((_, i) => String(prices[i] ?? "").trim());
  const allQtyOk = draft.lines.every((_, i) => {
    const q = Number(String(quantities[i] ?? "").trim());
    return Number.isFinite(q) && q > 0;
  });
  const allFashionOk = draft.lines.every((line) => isFashionLineComplete(line));
  const canPublish =
    hasLines && allTitled && allPriced && allQtyOk && allFashionOk;
  const hasSuggestions = draft.lines.some((line) => Boolean(line.price));

  function updateLine(
    index: number,
    patch: Partial<MerchantDraft["lines"][number]>,
  ) {
    setDraft({
      ...draft,
      lines: draft.lines.map((line, i) =>
        i === index ? { ...line, ...patch } : line,
      ),
    });
  }

  function updateFashion(
    index: number,
    patch: Partial<NonNullable<MerchantDraft["lines"][number]["fashion"]>>,
  ) {
    const line = draft.lines[index];
    const prev = line.fashion ?? enrichFashionMeta(line.title, line.description);
    const nextSub =
      (patch.subcategory as FashionSubcategory | undefined) ?? prev.subcategory;
    const fashion = {
      ...prev,
      ...patch,
      subcategory: nextSub,
      attrs: {
        ...(prev.attrs ?? {}),
        ...(patch.attrs ?? {}),
      },
      tracking: fashionDef(nextSub)?.tracking ?? prev.tracking,
    };
    const style = fashion.style?.trim() || line.title.trim();
    const preview = formatFashionSkuTitle({
      style,
      attrs: fashion.attrs,
      subcategory: fashion.subcategory,
    });
    updateLine(index, {
      fashion,
      name: preview,
      title: line.title,
    });
  }

  function removeLine(index: number) {
    setDraft({
      ...draft,
      lines: draft.lines.filter((_, i) => i !== index),
    });
    setPrices(prices.filter((_, i) => i !== index));
    setQuantities(quantities.filter((_, i) => i !== index));
  }

  function addLine() {
    setDraft({
      ...draft,
      lines: [
        ...draft.lines,
        {
          quantity: 1,
          title: "",
          description: undefined,
          price: undefined,
          fashion: enrichFashionMeta("Shirt"),
        },
      ],
    });
    setQuantities([...quantities, "1"]);
    setPrices([...prices, ""]);
  }

  const ctaLabel = busy
    ? "Publishing…"
    : !allFashionOk
      ? "Complete fashion details"
      : hasSuggestions
        ? "Confirm & publish"
        : "Submit prices";

  return (
    <div className="rounded-2xl border border-border bg-muted/30 p-3.5">
      <p className="font-[family-name:var(--font-syne)] text-sm font-semibold tracking-tight">
        Edit inventory
      </p>
      <p className="mt-0.5 text-xs text-foreground/50">
        Subcategory, size/color (and other axes), qty, and USDT0 price — all
        required before publish.
        {!walletReady ? (
          <>
            {" "}
            Finish receive rails in{" "}
            <a href="/merchant/setup" className="underline underline-offset-2">
              Settings
            </a>{" "}
            first.
          </>
        ) : null}
      </p>
      <div className="mt-3 flex flex-col gap-3">
        {draft.lines.map((line, index) => {
          const fashion =
            line.fashion ?? enrichFashionMeta(line.title, line.description);
          const def = fashionDef(fashion.subcategory);
          const missing = missingAxes(fashion.subcategory, fashion.attrs);
          const axes = [
            ...(def?.requiredAxes ?? []),
            ...(def?.optionalAxes ?? []),
          ];
          const preview = formatFashionSkuTitle({
            style: fashion.style?.trim() || line.title.trim() || "Item",
            attrs: fashion.attrs,
            subcategory: fashion.subcategory,
          });
          return (
            <div
              key={index}
              className="rounded-xl border border-border/80 bg-background/60 p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-mono text-[11px] text-foreground/45">
                  SKU preview · {preview}
                </p>
                <button
                  type="button"
                  disabled={busy}
                  className="flex size-8 shrink-0 items-center justify-center rounded-full text-foreground/50 transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
                  onClick={() => removeLine(index)}
                  aria-label={`Remove ${line.title || `row ${index + 1}`}`}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>

              <div className="mt-2 grid gap-2 sm:grid-cols-[4.5rem_minmax(0,1fr)_6.5rem]">
                <Input
                  inputMode="numeric"
                  placeholder="e.g. 8"
                  value={quantities[index] ?? ""}
                  onChange={(event) => {
                    const next = [...quantities];
                    next[index] = event.target.value;
                    setQuantities(next);
                  }}
                  aria-label={`Quantity for row ${index + 1}`}
                  className="rounded-xl"
                />
                <Input
                  placeholder="e.g. Oxford Shirt"
                  value={line.title}
                  onChange={(event) => {
                    const title = event.target.value;
                    updateLine(index, {
                      title,
                      name: title,
                      fashion: {
                        ...fashion,
                        style: title,
                      },
                    });
                  }}
                  aria-label={`Title for row ${index + 1}`}
                  className="rounded-xl"
                />
                <Input
                  inputMode="decimal"
                  placeholder="e.g. 4.00"
                  value={prices[index] ?? ""}
                  onChange={(event) => {
                    const next = [...prices];
                    next[index] = event.target.value;
                    setPrices(next);
                  }}
                  aria-label={`Price for row ${index + 1}`}
                  className="rounded-xl"
                />
              </div>

              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-[11px] text-foreground/55">
                  Subcategory
                  <select
                    value={fashion.subcategory}
                    disabled={busy}
                    onChange={(e) =>
                      updateFashion(index, {
                        subcategory: e.target.value as FashionSubcategory,
                        attrs: {},
                      })
                    }
                    className="h-9 rounded-xl border border-border bg-background px-2 text-sm text-foreground"
                  >
                    {FASHION_SUBCATEGORIES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>
                {axes.map((axis) => {
                  const presets = def?.presets[axis] ?? [];
                  const value = fashion.attrs?.[axis] ?? "";
                  const required = def?.requiredAxes.includes(axis);
                  return (
                    <label
                      key={axis}
                      className={cn(
                        "flex flex-col gap-1 text-[11px]",
                        required && !String(value).trim()
                          ? "text-destructive"
                          : "text-foreground/55",
                      )}
                    >
                      {axisLabel(axis)}
                      {required ? " *" : ""}
                      {presets.length > 0 ? (
                        <select
                          value={value}
                          disabled={busy}
                          onChange={(e) =>
                            updateFashion(index, {
                              attrs: { [axis]: e.target.value },
                            })
                          }
                          className="h-9 rounded-xl border border-border bg-background px-2 text-sm text-foreground"
                        >
                          <option value="">
                            {axisSelectPrompt(axis, fashion.subcategory)}
                          </option>
                          {presets.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <Input
                          value={value}
                          disabled={busy}
                          placeholder={axisPlaceholder(
                            axis,
                            fashion.subcategory,
                          )}
                          onChange={(e) =>
                            updateFashion(index, {
                              attrs: { [axis]: e.target.value },
                            })
                          }
                          className="rounded-xl"
                        />
                      )}
                    </label>
                  );
                })}
              </div>
              {missing.length > 0 ? (
                <p className="mt-2 text-[11px] text-destructive">
                  Missing: {missing.map(axisLabel).join(", ")}
                </p>
              ) : null}
            </div>
          );
        })}
        {draft.lines.length === 0 ? (
          <p className="text-xs text-foreground/50">
            No products yet — add a row or import a catalog.
          </p>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-medium transition-colors hover:bg-muted disabled:opacity-40"
          onClick={addLine}
        >
          <Plus className="size-3.5" />
          Add product
        </button>
        <MovingBorderButton
          type="button"
          disabled={busy || !canPublish}
          onClick={onSubmit}
          borderRadius="1.5rem"
          containerClassName="h-10 w-auto min-w-[9.5rem] disabled:opacity-40"
          borderClassName="bg-[radial-gradient(#3d9b72_40%,transparent_60%)]"
          className="border-border bg-foreground px-4 text-xs font-medium text-background"
          duration={2500}
        >
          {ctaLabel}
        </MovingBorderButton>
      </div>
    </div>
  );
}
