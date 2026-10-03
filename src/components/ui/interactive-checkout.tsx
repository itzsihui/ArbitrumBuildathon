"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type CheckoutProduct = {
  id: string;
  name: string;
  price: number;
  category: string;
  image: string;
  color?: string;
  /** Pass-through for Borneo settle (storeSlug, merchant, etc.). */
  meta?: Record<string, unknown>;
};

export type CartLine = CheckoutProduct & { quantity: number };

type InteractiveCheckoutProps = {
  products: CheckoutProduct[];
  cart: CartLine[];
  onAdd: (product: CheckoutProduct) => void;
  onRemove: (productId: string) => void;
  onQty: (productId: string, quantity: number) => void;
  onClear?: () => void;
  onCheckout: () => void;
  /** Open product detail / single-item pay. */
  onProductClick?: (product: CheckoutProduct) => void;
  currency?: string;
  checkoutLabel?: string;
  busy?: boolean;
  className?: string;
};

function money(n: number, currency: string) {
  return `${n.toFixed(2)} ${currency}`;
}

/**
 * Kokonut-style interactive checkout — adapted for Borneo chat commerce.
 * @see https://21st.dev/@kokonutd/components/interactive-checkout
 */
export function InteractiveCheckout({
  products,
  cart,
  onAdd,
  onRemove,
  onQty,
  onClear,
  onCheckout,
  onProductClick,
  currency = "USDT0",
  checkoutLabel = "Pay in chat",
  busy,
  className,
}: InteractiveCheckoutProps) {
  const total = cart.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const count = cart.reduce((sum, line) => sum + line.quantity, 0);
  const inCart = new Set(cart.map((c) => c.id));

  return (
    <div
      className={cn(
        "w-full max-w-4xl overflow-hidden rounded-2xl border border-border bg-background",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2.5 sm:px-4">
        <div>
          <p className="font-[family-name:var(--font-syne)] text-sm font-semibold tracking-tight">
            Build your set
          </p>
          <p className="text-[11px] text-foreground/50">
            Add pieces, then pay in chat — each SKU settles on a locked quote
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs text-foreground/70">
          <ShoppingBag className="size-3.5" />
          {count} in cart
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-[1.2fr_0.9fr]">
        <ul className="divide-y divide-border max-h-[min(50vh,22rem)] overflow-y-auto">
          {products.map((product) => {
            const added = inCart.has(product.id);
            return (
              <li
                key={product.id}
                className="flex items-center gap-3 px-3 py-2.5 sm:px-4"
              >
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onProductClick?.(product)}
                  className={cn(
                    "flex min-w-0 flex-1 items-center gap-3 text-left rounded-lg -mx-1 px-1 py-0.5 transition-colors",
                    onProductClick
                      ? "hover:bg-muted/50 cursor-pointer"
                      : "cursor-default",
                  )}
                >
                  <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-muted sm:size-16">
                    <Image
                      src={product.image}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="64px"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{product.name}</p>
                    <p className="truncate text-[11px] text-foreground/45">
                      {product.category}
                      {product.color ? ` · ${product.color}` : ""}
                    </p>
                    <p className="mt-0.5 text-sm font-medium">
                      {money(product.price, currency)}
                    </p>
                  </div>
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    added ? onRemove(product.id) : onAdd(product)
                  }
                  className={cn(
                    "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    added
                      ? "border-foreground bg-foreground text-background"
                      : "border-border hover:bg-muted",
                  )}
                >
                  {added ? "Added" : "Add"}
                </button>
              </li>
            );
          })}
        </ul>

        <div className="border-t border-border bg-muted/20 lg:border-t-0 lg:border-l">
          <div className="flex items-center justify-between px-3 py-2.5 sm:px-4">
            <p className="text-xs font-medium uppercase tracking-wide text-foreground/50">
              Cart
            </p>
            {cart.length > 0 && onClear ? (
              <button
                type="button"
                disabled={busy}
                onClick={onClear}
                className="text-[11px] text-foreground/45 underline-offset-2 hover:underline"
              >
                Clear
              </button>
            ) : null}
          </div>

          <div className="max-h-[min(40vh,16rem)] overflow-y-auto px-3 pb-3 sm:px-4">
            <AnimatePresence initial={false} mode="popLayout">
              {cart.length === 0 ? (
                <motion.p
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="rounded-xl border border-dashed border-border px-3 py-8 text-center text-xs text-foreground/45"
                >
                  Tap Add on pieces you want in this outfit
                </motion.p>
              ) : (
                cart.map((line) => (
                  <motion.div
                    key={line.id}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="mb-2 flex items-center gap-2 rounded-xl border border-border bg-background p-2"
                  >
                    <div className="relative size-11 shrink-0 overflow-hidden rounded-md bg-muted">
                      <Image
                        src={line.image}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="44px"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium">{line.name}</p>
                      <p className="text-[11px] text-foreground/50">
                        {money(line.price, currency)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={busy || line.quantity <= 1}
                        aria-label="Decrease quantity"
                        onClick={() => onQty(line.id, line.quantity - 1)}
                        className="flex size-7 items-center justify-center rounded-full border border-border disabled:opacity-40"
                      >
                        <Minus className="size-3" />
                      </button>
                      <span className="w-5 text-center text-xs tabular-nums">
                        {line.quantity}
                      </span>
                      <button
                        type="button"
                        disabled={busy}
                        aria-label="Increase quantity"
                        onClick={() => onQty(line.id, line.quantity + 1)}
                        className="flex size-7 items-center justify-center rounded-full border border-border disabled:opacity-40"
                      >
                        <Plus className="size-3" />
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        aria-label="Remove"
                        onClick={() => onRemove(line.id)}
                        className="ml-0.5 flex size-7 items-center justify-center rounded-full text-foreground/45 hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>

          <div className="border-t border-border px-3 py-3 sm:px-4">
            <div className="mb-2.5 flex items-baseline justify-between gap-2">
              <span className="text-xs text-foreground/50">Total</span>
              <span className="font-[family-name:var(--font-syne)] text-base font-semibold tabular-nums">
                {money(total, currency)}
              </span>
            </div>
            <button
              type="button"
              disabled={busy || cart.length === 0}
              onClick={onCheckout}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-foreground px-3 py-2.5 text-sm font-medium text-background transition-opacity disabled:opacity-40"
            >
              {busy ? "Working…" : checkoutLabel}
              {!busy && cart.length > 0 ? (
                <span className="rounded-full bg-background/15 px-1.5 py-0.5 text-[10px]">
                  {count}
                </span>
              ) : null}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Compact cart chip for the chat footer. */
export function CartBadge({
  count,
  onOpen,
  className,
}: {
  count: number;
  onOpen: () => void;
  className?: string;
}) {
  if (count <= 0) return null;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs font-medium hover:bg-muted",
        className,
      )}
    >
      <ShoppingBag className="size-3.5" />
      Cart · {count}
    </button>
  );
}
