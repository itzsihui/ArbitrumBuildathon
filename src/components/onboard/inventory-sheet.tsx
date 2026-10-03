"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  FileSpreadsheet,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { AgentDock } from "@/components/ui/agent-dock";
import { Button as MovingBorderButton } from "@/components/ui/moving-border";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  axisLabel,
  axisPlaceholder,
  axisPresets,
  axisSelectPrompt,
  INVENTORY_TABLE_AXES,
  enrichFashionMeta,
  FASHION_SUBCATEGORIES,
  fashionDef,
  formatFashionSkuTitle,
  inventoryTableAxesForSubcategory,
  isFashionLineComplete,
  missingAxes,
  type FashionAxis,
  type FashionSubcategory,
} from "@/lib/inventory/fashion";
import {
  downloadCsv,
  downloadExcel,
  draftToSheetRows,
  mergeImportedLines,
  parseSheetFile,
} from "@/lib/inventory/export-sheet";
import type { MerchantDraft } from "@/lib/inventory/parse";
import { cn } from "@/lib/utils";

const DISPLAY_AXES = INVENTORY_TABLE_AXES;

type InventorySheetProps = {
  open: boolean;
  onClose: () => void;
  draft: MerchantDraft;
  setDraft: (draft: MerchantDraft) => void;
  prices: string[];
  setPrices: (prices: string[]) => void;
  quantities: string[];
  setQuantities: (quantities: string[]) => void;
  busy?: boolean;
  live?: boolean;
  slug?: string | null;
  onPublish: () => void;
  onSaveLive?: () => Promise<void> | void;
  walletReady?: boolean;
};

export function InventorySheet({
  open,
  onClose,
  draft,
  setDraft,
  prices,
  setPrices,
  quantities,
  setQuantities,
  busy,
  live,
  slug,
  onPublish,
  onSaveLive,
  walletReady,
}: InventorySheetProps) {
  const importRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);

  const incomplete = useMemo(
    () =>
      draft.lines.filter((line, i) => {
        const withPrice = {
          ...line,
          price: prices[i] || line.price,
          quantity: Number(quantities[i] || line.quantity) || line.quantity,
        };
        return (
          !isFashionLineComplete(withPrice) ||
          !String(prices[i] ?? line.price ?? "").trim() ||
          !(Number(quantities[i] || line.quantity) > 0)
        );
      }).length,
    [draft.lines, prices, quantities],
  );

  const canPublish =
    draft.lines.length > 0 &&
    draft.lines.every((line, i) => {
      const qty = Number(quantities[i] || line.quantity);
      const price = String(prices[i] ?? line.price ?? "").trim();
      return (
        isFashionLineComplete(line) &&
        line.title.trim() &&
        Number.isFinite(qty) &&
        qty > 0 &&
        price
      );
    });

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

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
    const line = draft.lines[index]!;
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
    updateLine(index, { fashion });
  }

  function removeLine(index: number) {
    setDraft({
      ...draft,
      lines: draft.lines.filter((_, i) => i !== index),
    });
    setPrices(prices.filter((_, i) => i !== index));
    setQuantities(quantities.filter((_, i) => i !== index));
  }

  function addRow() {
    setDraft({
      ...draft,
      lines: [
        ...draft.lines,
        {
          quantity: 1,
          title: "",
          fashion: enrichFashionMeta("Shirt"),
        },
      ],
    });
    setQuantities([...quantities, ""]);
    setPrices([...prices, ""]);
  }

  function exportRows(kind: "csv" | "xlsx") {
    const rows = draftToSheetRows(draft, quantities, prices);
    const base = slug || draft.slug || draft.name || "inventory";
    if (kind === "csv") downloadCsv(`${base}-inventory`, rows);
    else downloadExcel(`${base}-inventory`, rows);
  }

  async function onImportFile(file: File) {
    const incoming = await parseSheetFile(file);
    if (!incoming.length) return;
    const merged = mergeImportedLines(draft, incoming);
    setDraft(merged);
    setPrices(merged.lines.map((l, i) => l.price || prices[i] || ""));
    setQuantities(
      merged.lines.map((l, i) => String(l.quantity || quantities[i] || "1")),
    );
  }

  async function handleAsk(question: string): Promise<string> {
    const rows = draft.lines.map((line, i) => ({
      title: formatFashionSkuTitle({
        style: line.fashion?.style || line.title || "Item",
        attrs: line.fashion?.attrs,
        subcategory: line.fashion?.subcategory || "tops",
      }),
      quantity: Number(quantities[i] || line.quantity) || 0,
      price: String(prices[i] ?? line.price ?? ""),
      subcategory: line.fashion?.subcategory,
      color: line.fashion?.attrs?.color,
      size:
        line.fashion?.attrs?.size ||
        (line.fashion?.attrs?.waist && line.fashion?.attrs?.inseam
          ? `${line.fashion.attrs.waist}x${line.fashion.attrs.inseam}`
          : undefined),
    }));
    try {
      const res = await fetch("/api/inventory-ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question, rows }),
      });
      const data = (await res.json()) as { reply?: string };
      return data.reply || "No answer.";
    } catch {
      return "Could not reach inventory assistant.";
    }
  }

  async function handleSaveLive() {
    if (!onSaveLive) return;
    setSaving(true);
    try {
      await onSaveLive();
    } finally {
      setSaving(false);
    }
  }

  const ctaLabel = busy
    ? live
      ? "Saving…"
      : "Publishing…"
    : saving
      ? "Saving…"
      : live
        ? "Save to store"
        : !canPublish
          ? "Complete fashion details"
          : walletReady
            ? "Confirm & publish"
            : "Finish Settings first";

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-background/80 p-2 backdrop-blur-sm sm:p-4">
      <div className="relative flex max-h-[100dvh] w-full max-w-[1400px] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <p className="font-[family-name:var(--font-syne)] text-base font-semibold tracking-tight">
              Inventory sheet
            </p>
            <p className="text-xs text-foreground/50">
              {draft.lines.length} SKU
              {draft.lines.length === 1 ? "" : "s"}
              {incomplete > 0 ? ` · ${incomplete} incomplete` : ""}
              {live && slug ? ` · live /s/${slug}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-medium hover:bg-muted"
              onClick={() => exportRows("xlsx")}
            >
              <Download className="size-3.5" />
              Excel
            </button>
            <button
              type="button"
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-medium hover:bg-muted"
              onClick={() => exportRows("csv")}
            >
              <FileSpreadsheet className="size-3.5" />
              CSV
            </button>
            <button
              type="button"
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-medium hover:bg-muted"
              onClick={() => importRef.current?.click()}
            >
              <Upload className="size-3.5" />
              Import
            </button>
            <input
              ref={importRef}
              type="file"
              accept=".csv,.xlsx,.xls,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void onImportFile(file);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              className="inline-flex size-9 items-center justify-center rounded-full border border-border hover:bg-muted"
              onClick={onClose}
              aria-label="Close inventory sheet"
            >
              <X className="size-4" />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-auto">
          <Table className="min-w-[1100px]">
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Style</TableHead>
                <TableHead>Subcategory</TableHead>
                <TableHead className="w-20">Qty</TableHead>
                <TableHead className="w-24">Price</TableHead>
                {DISPLAY_AXES.map((axis) => (
                  <TableHead key={axis}>{axisLabel(axis)}</TableHead>
                ))}
                <TableHead>SKU preview</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {draft.lines.map((line, index) => {
                const fashion =
                  line.fashion ??
                  enrichFashionMeta(line.title, line.description);
                const def = fashionDef(fashion.subcategory);
                const preview = formatFashionSkuTitle({
                  style: fashion.style?.trim() || line.title.trim() || "Item",
                  attrs: fashion.attrs,
                  subcategory: fashion.subcategory,
                });
                const missing = missingAxes(
                  fashion.subcategory,
                  fashion.attrs,
                );
                const applicableAxes = new Set(
                  inventoryTableAxesForSubcategory(fashion.subcategory),
                );
                return (
                  <TableRow
                    key={index}
                    className={cn(missing.length > 0 && "bg-destructive/5")}
                  >
                    <TableCell className="font-mono text-[11px] text-foreground/45">
                      {index + 1}
                    </TableCell>
                    <TableCell>
                      <Input
                        className="h-8 min-w-[8rem] rounded-lg"
                        placeholder="e.g. Oxford Shirt"
                        value={line.title}
                        disabled={busy}
                        onChange={(e) => {
                          const title = e.target.value;
                          updateLine(index, {
                            title,
                            fashion: { ...fashion, style: title },
                          });
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <select
                        value={fashion.subcategory}
                        disabled={busy}
                        onChange={(e) =>
                          updateFashion(index, {
                            subcategory: e.target
                              .value as FashionSubcategory,
                            attrs: {},
                          })
                        }
                        className="h-8 min-w-[8rem] rounded-lg border border-border bg-background px-2 text-sm"
                      >
                        {FASHION_SUBCATEGORIES.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </TableCell>
                    <TableCell>
                      <Input
                        className="h-8 w-20 rounded-lg"
                        inputMode="numeric"
                        placeholder="e.g. 8"
                        value={quantities[index] ?? ""}
                        disabled={busy}
                        onChange={(e) => {
                          const next = [...quantities];
                          next[index] = e.target.value;
                          setQuantities(next);
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        className="h-8 w-24 rounded-lg"
                        inputMode="decimal"
                        placeholder="e.g. 4.00"
                        value={prices[index] ?? ""}
                        disabled={busy}
                        onChange={(e) => {
                          const next = [...prices];
                          next[index] = e.target.value;
                          setPrices(next);
                        }}
                      />
                    </TableCell>
                    {DISPLAY_AXES.map((axis) => {
                      if (!applicableAxes.has(axis)) {
                        return (
                          <TableCell
                            key={axis}
                            className="text-center text-xs text-foreground/25"
                          >
                            —
                          </TableCell>
                        );
                      }
                      const required = def?.requiredAxes.includes(axis);
                      const presets = axisPresets(axis, fashion.subcategory);
                      const value = fashion.attrs?.[axis] ?? "";
                      // Always editable — empty/null is fine; required axes flag incompleteness.
                      if (presets.length > 0) {
                        return (
                          <TableCell key={axis}>
                            <select
                              value={value}
                              disabled={busy}
                              onChange={(e) =>
                                updateFashion(index, {
                                  attrs: { [axis]: e.target.value },
                                })
                              }
                              className={cn(
                                "h-8 min-w-[5.5rem] rounded-lg border border-border bg-background px-1.5 text-sm",
                                required &&
                                  !value &&
                                  "border-destructive/60",
                              )}
                            >
                              <option value="">
                                {axisSelectPrompt(
                                  axis,
                                  fashion.subcategory,
                                )}
                              </option>
                              {presets.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                              {value && !presets.includes(value) ? (
                                <option value={value}>{value}</option>
                              ) : null}
                            </select>
                          </TableCell>
                        );
                      }
                      return (
                        <TableCell key={axis}>
                          <Input
                            className={cn(
                              "h-8 min-w-[5rem] rounded-lg",
                              required &&
                                !value &&
                                "border-destructive/60",
                            )}
                            placeholder={axisPlaceholder(
                              axis,
                              fashion.subcategory,
                            )}
                            value={value}
                            disabled={busy}
                            onChange={(e) =>
                              updateFashion(index, {
                                attrs: { [axis]: e.target.value },
                              })
                            }
                          />
                        </TableCell>
                      );
                    })}
                    <TableCell className="max-w-[14rem] truncate font-mono text-[11px] text-foreground/55">
                      {preview}
                    </TableCell>
                    <TableCell>
                      <button
                        type="button"
                        disabled={busy}
                        className="flex size-8 items-center justify-center rounded-full text-foreground/45 hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => removeLine(index)}
                        aria-label={`Remove row ${index + 1}`}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {draft.lines.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-foreground/50">
              No products yet — add a row, import Excel/CSV, or describe stock
              in chat.
            </p>
          ) : null}
        </div>

        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-medium hover:bg-muted disabled:opacity-40"
              onClick={addRow}
            >
              <Plus className="size-3.5" />
              Add row
            </button>
            {incomplete > 0 ? (
              <p className="text-[11px] text-destructive">
                Fill required sizes/colors + qty + USDC price on {incomplete}{" "}
                row{incomplete === 1 ? "" : "s"}
              </p>
            ) : (
              <p className="text-[11px] text-foreground/45">
                Edits sync to chat draft
                {live ? " · save to update the live catalog" : ""}
              </p>
            )}
          </div>
          <MovingBorderButton
            type="button"
            disabled={busy || saving || (!live && (!canPublish || !walletReady))}
            onClick={() => {
              if (live) void handleSaveLive();
              else onPublish();
            }}
            borderRadius="1.5rem"
            containerClassName="h-10 w-auto min-w-[9.5rem] disabled:opacity-40"
            borderClassName="bg-[radial-gradient(#3d9b72_40%,transparent_60%)]"
            className="border-border bg-foreground px-4 text-xs font-medium text-background"
            duration={2500}
          >
            {ctaLabel}
          </MovingBorderButton>
        </footer>

        <div className="pointer-events-none absolute bottom-20 right-6 z-20 w-[min(100%,22rem)] sm:bottom-24">
          <div className="pointer-events-auto w-full">
            <AgentDock
              agentName="Borneo"
              avatarSrc="https://api.dicebear.com/9.x/shapes/svg?seed=Borneo&size=80"
              idleStatus="Ask about this sheet"
              workingStatus="Looking at inventory…"
              onMessageSubmit={handleAsk}
              className="w-full"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Compact bar shown under chat when a draft or live store exists. */
export function InventorySheetBar({
  count,
  onOpen,
  live,
}: {
  count: number;
  onOpen: () => void;
  live?: boolean;
}) {
  if (count <= 0) return null;
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-muted/30 px-3.5 py-2.5">
      <p className="text-xs text-foreground/60">
        <span className="font-medium text-foreground/80">
          {count} SKU{count === 1 ? "" : "s"}
        </span>
        {live ? " on your live store" : " in draft"}
      </p>
      <button
        type="button"
        onClick={onOpen}
        className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted"
      >
        <FileSpreadsheet className="size-3.5" />
        View inventory sheet
      </button>
    </div>
  );
}
