"use client";

import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUp, Loader2, Mic, Sparkles } from "lucide-react";
import { useVoiceToText } from "@/lib/voice/use-voice-to-text";
import { cn } from "@/lib/utils";
import type {
  ChainStep,
  ChatMessage,
  MarketProductPick,
} from "../_lib/buyer-flow";
import { FASHION_STARTERS, FASHION_WELCOME } from "../_lib/fashion-prompts";
import { BuyerChainOfThought } from "./buyer-chain-of-thought";
import {
  InteractiveCheckout,
  type CartLine,
  type CheckoutProduct,
} from "@/components/ui/interactive-checkout";

const URL_RE = /(https?:\/\/[^\s]+)/g;

function MessageBody({
  content,
  links,
  invert,
}: {
  content: string;
  links?: Array<{ label: string; href: string }>;
  invert?: boolean;
}) {
  const parts = content.split(URL_RE);

  return (
    <div className="min-w-0 space-y-2">
      <p className="break-words [overflow-wrap:anywhere] whitespace-pre-wrap">
        {parts.map((part, i) =>
          /^https?:\/\//i.test(part) ? (
            <a
              key={`${part}-${i}`}
              href={part}
              target="_blank"
              rel="noreferrer"
              className={cn(
                "break-all underline underline-offset-2",
                invert
                  ? "text-background/90 hover:text-background"
                  : "text-primary hover:opacity-80",
              )}
              onClick={(e) => e.stopPropagation()}
            >
              {part}
            </a>
          ) : (
            <span key={`${i}-${part.slice(0, 12)}`}>{part}</span>
          ),
        )}
      </p>
      {links && links.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {links.map((link) => (
            <a
              key={link.href + link.label}
              href={link.href}
              target="_blank"
              rel="noreferrer"
              className={cn(
                "inline-flex max-w-full items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium underline-offset-2 hover:underline",
                invert
                  ? "border-background/25 text-background"
                  : "border-border bg-background/80 text-foreground",
              )}
              onClick={(e) => e.stopPropagation()}
            >
              <span className="truncate">{link.label}</span>
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function SalespersonChat({
  messages,
  suggestions,
  steps,
  onSend,
  onProductClick,
  cartLines,
  onCartAdd,
  onCartRemove,
  onCartQty,
  onCartClear,
  onCartCheckout,
  chatBusy,
  searching,
  disabled,
  className,
}: {
  messages: ChatMessage[];
  suggestions: string[];
  steps?: ChainStep[];
  onSend: (text: string) => void;
  onProductClick: (product: MarketProductPick) => void;
  cartLines?: CartLine[];
  onCartAdd?: (product: MarketProductPick) => void;
  onCartRemove?: (productId: string) => void;
  onCartQty?: (productId: string, quantity: number) => void;
  onCartClear?: () => void;
  onCartCheckout?: () => void;
  /** Waiting on salesperson reply (no CoT). */
  chatBusy?: boolean;
  /** Catalog search / settle — show collapsible reasoning. */
  searching?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const [draft, setDraft] = useState("");
  const scrollerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chips =
    suggestions.length > 0 ? suggestions : [...FASHION_STARTERS];
  const locked = Boolean(chatBusy || searching || disabled);

  const onVoiceTranscript = useCallback((text: string) => {
    setDraft(text);
    window.requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(text.length, text.length);
    });
  }, []);

  const voice = useVoiceToText({
    onTranscript: onVoiceTranscript,
    disabled: locked,
  });

  const composerLocked = locked || voice.transcribing;

  const showReasoning = Boolean(searching && steps?.length);
  const lastProductsIdx = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]?.products && messages[i]!.products!.length > 0) return i;
    }
    return -1;
  })();
  const cart = cartLines ?? [];

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, chatBusy, searching, steps, showReasoning, cart.length]);

  function submit(text: string) {
    const value = text.trim();
    if (!value || composerLocked) return;
    setDraft("");
    onSend(value);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    submit(draft);
  }

  const empty = messages.length <= 1 && !showReasoning;

  return (
    <section
      className={cn(
        "flex min-h-0 flex-1 flex-col overflow-hidden border border-border bg-background",
        className,
      )}
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
            <Sparkles className="size-3.5" />
          </span>
          <div className="min-w-0">
            <h2 className="font-[family-name:var(--font-syne)] text-sm font-semibold tracking-tight">
              Fashion salesperson
            </h2>
            <p className="truncate text-[11px] text-foreground/50">
              Clarifies intent · searches Borneo · pays in-chat
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3 text-xs text-foreground/55">
          <Link href="/market" className="hover:text-foreground">
            Market
          </Link>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div
          ref={scrollerRef}
          className="min-h-0 flex-1 space-y-3 overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-4 sm:px-6"
        >
          {empty ? (
            <div className="flex min-h-[160px] flex-col items-center justify-center px-4 text-center">
              <p className="font-[family-name:var(--font-syne)] text-lg font-semibold tracking-tight">
                What are you looking for?
              </p>
              <p className="mt-2 max-w-[36ch] text-sm text-foreground/55">
                {FASHION_WELCOME}
              </p>
            </div>
          ) : null}

          {messages.map((msg, i) => {
            const isUser = msg.role === "user";
            return (
              <div key={`${msg.role}-${i}`} className="space-y-2">
                <div
                  className={cn(
                    "flex",
                    isUser ? "justify-end" : "justify-start",
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[min(90%,42rem)] min-w-0 rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                      isUser
                        ? "bg-foreground text-background"
                        : "border border-border bg-muted/40 text-foreground",
                    )}
                  >
                    <MessageBody
                      content={msg.content}
                      links={msg.links}
                      invert={isUser}
                    />
                  </div>
                </div>

                {msg.steps && msg.steps.length > 0 ? (
                  <BuyerChainOfThought
                    steps={msg.steps}
                    variant="chat"
                    live={false}
                    title="Thought process"
                  />
                ) : null}

                {msg.products && msg.products.length > 0 ? (
                  <div className="space-y-3">
                    {(() => {
                      const useSet =
                        i === lastProductsIdx &&
                        Boolean(onCartAdd) &&
                        Boolean(onCartRemove) &&
                        Boolean(onCartQty) &&
                        Boolean(onCartCheckout) &&
                        msg.products.length > 1;

                      if (useSet) {
                        return (
                          <InteractiveCheckout
                            products={msg.products
                              .filter((p) => !p.quarantined)
                              .map(
                                (p): CheckoutProduct => ({
                                  id: p.id,
                                  name: p.title,
                                  price: Number(p.price) || 0,
                                  category: `/s/${p.storeSlug}`,
                                  image: p.imageUrl,
                                  color: p.storeName,
                                  meta: { product: p },
                                }),
                              )}
                            cart={cart}
                            busy={locked}
                            onAdd={(cp) => {
                              const raw = msg.products?.find(
                                (p) => p.id === cp.id,
                              );
                              if (raw) onCartAdd!(raw);
                            }}
                            onRemove={onCartRemove!}
                            onQty={onCartQty!}
                            onClear={onCartClear}
                            onCheckout={onCartCheckout!}
                            onProductClick={(cp) => {
                              const raw = msg.products?.find(
                                (p) => p.id === cp.id,
                              );
                              if (raw) onProductClick(raw);
                            }}
                            checkoutLabel="Pay cart in chat"
                          />
                        );
                      }

                      return (
                        <div className="grid max-w-4xl gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {msg.products.map((product) => (
                            <button
                              key={product.id}
                              type="button"
                              onClick={() => onProductClick(product)}
                              className="flex overflow-hidden rounded-xl border border-border bg-background text-left transition-colors hover:bg-muted/30"
                            >
                              <div className="relative size-20 shrink-0 bg-muted sm:size-24">
                                <Image
                                  src={product.imageUrl}
                                  alt=""
                                  fill
                                  className="object-cover"
                                  sizes="96px"
                                />
                              </div>
                              <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 p-2.5">
                                <p className="truncate text-sm font-medium">
                                  {product.quarantined
                                    ? product.id.split(":")[1] || product.id
                                    : product.title}
                                </p>
                                {product.quarantined ? (
                                  <p className="text-[10px] font-medium text-destructive/80">
                                    Quarantined · injection-shaped copy
                                  </p>
                                ) : null}
                                <p className="truncate font-mono text-[10px] text-foreground/45">
                                  /s/{product.storeSlug}
                                </p>
                                <p className="text-sm font-medium">
                                  {product.price}{" "}
                                  <span className="text-foreground/45">
                                    USDT0
                                  </span>
                                </p>
                              </div>
                            </button>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                ) : null}
              </div>
            );
          })}

          {showReasoning && steps ? (
            <BuyerChainOfThought
              steps={steps}
              variant="chat"
              live={Boolean(searching)}
              title="Thought process"
              liveSummary="Thinking through catalogs…"
            />
          ) : null}

          {chatBusy ? (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl border border-border bg-muted/40 px-3.5 py-2.5 text-sm text-foreground/60">
                <Loader2 className="size-3.5 animate-spin" />
                Thinking…
              </div>
            </div>
          ) : null}
        </div>

        <div className="shrink-0 border-t border-border p-3 sm:px-6">
          {!composerLocked && chips.length > 0 ? (
            <div className="mb-2.5 flex flex-wrap gap-1.5">
              {chips.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => submit(chip)}
                  className="rounded-full border border-border px-3 py-1 text-xs text-foreground/70 transition-colors hover:bg-muted"
                >
                  {chip}
                </button>
              ))}
            </div>
          ) : null}

          {voice.listening ? (
            <p className="mb-2 text-xs text-foreground/55">
              Listening… tap the mic again when you&apos;re done.
            </p>
          ) : voice.transcribing ? (
            <p className="mb-2 flex items-center gap-2 text-xs text-foreground/55">
              <Loader2 className="size-3 animate-spin" />
              Transcribing…
            </p>
          ) : voice.hint ? (
            <p className="mb-2 text-xs text-destructive/80">{voice.hint}</p>
          ) : null}

          <form
            onSubmit={handleSubmit}
            className="flex items-end gap-2 rounded-2xl border border-border bg-muted/20 p-2 shadow-sm"
          >
            <button
              type="button"
              disabled={composerLocked}
              onClick={() => voice.toggleVoice()}
              aria-label={
                voice.listening ? "Stop recording" : "Voice input"
              }
              title={
                voice.listening
                  ? "Stop and transcribe"
                  : "Speak, then review and send"
              }
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-full border transition-colors disabled:opacity-40",
                voice.listening
                  ? "border-destructive/40 bg-destructive/10 text-destructive"
                  : "border-border text-foreground/60 hover:bg-muted",
              )}
            >
              {voice.transcribing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Mic className="size-4" />
              )}
            </button>
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit(draft);
                }
              }}
              rows={1}
              disabled={composerLocked}
              placeholder="Describe what you want to wear…"
              className="max-h-28 min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-foreground/40"
            />
            <button
              type="submit"
              disabled={composerLocked || !draft.trim()}
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-opacity disabled:opacity-40"
              aria-label="Send"
            >
              {chatBusy || searching ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ArrowUp className="size-4" />
              )}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
