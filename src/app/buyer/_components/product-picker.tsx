"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import type { MarketProductPick } from "../_lib/buyer-flow";

export function ProductPicker({
  products,
  selectedId,
  onSelect,
  disabled,
}: {
  products: MarketProductPick[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  disabled?: boolean;
}) {
  if (products.length === 0) {
    return (
      <section className="border border-border px-4 py-6 text-sm text-foreground/60">
        No apparel matches yet. Try a different intent or browse{" "}
        <a href="/market" className="underline underline-offset-2">
          Market
        </a>
        .
      </section>
    );
  }

  return (
    <section className="border border-border">
      <div className="border-b border-border px-4 py-3">
        <h2 className="font-[family-name:var(--font-syne)] text-sm font-semibold tracking-tight">
          Choose a piece
        </h2>
        <p className="mt-1 text-xs text-foreground/55">
          Ranked from the Borneo network · select one to continue
        </p>
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => {
          const selected = selectedId === product.id;
          return (
            <button
              key={product.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(product.id)}
              className={cn(
                "flex flex-col overflow-hidden rounded-lg border text-left transition-colors",
                selected
                  ? "border-foreground ring-1 ring-foreground"
                  : "border-border hover:border-foreground/40",
                disabled && "opacity-60",
              )}
            >
              <div className="relative aspect-square bg-muted">
                <Image
                  src={product.imageUrl}
                  alt={product.title}
                  fill
                  sizes="(max-width: 640px) 100vw, 220px"
                  className="object-cover"
                />
              </div>
              <div className="flex flex-1 flex-col gap-1 p-3">
                <p className="text-sm font-medium leading-snug">
                  {product.title}
                </p>
                <p className="font-mono text-[11px] text-foreground/50">
                  /s/{product.storeSlug}
                </p>
                <p className="mt-auto pt-2 text-sm font-medium">
                  {product.price}{" "}
                  <span className="text-foreground/50">USDC</span>
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
