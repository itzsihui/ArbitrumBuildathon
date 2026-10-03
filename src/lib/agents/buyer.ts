import {
  payX402Tool,
  type BuyerReceipt,
  type BuyerStep,
  type PayQuote,
} from "@/lib/agents/tools-buyer";

export type { BuyerStep, BuyerReceipt, PayQuote };

/**
 * Settle USDC / x402 from a locked quote.
 * When quote is present: no LLM, no product titles — deterministic tool only.
 * Legacy message path kept for /demo scripts without a structured quote.
 */
export async function runBuyerAgent(args: {
  origin: string;
  message?: string;
  quote?: PayQuote;
  buyerUid?: string;
}): Promise<{
  steps: BuyerStep[];
  receipt?: BuyerReceipt;
  llm?: "bedrock" | "deterministic" | "quote";
}> {
  if (args.quote?.storeSlug && args.quote?.skuId && args.quote?.price) {
    const result = await payX402Tool({
      origin: args.origin,
      buyerUid: args.buyerUid,
      quote: {
        storeSlug: args.quote.storeSlug,
        skuId: args.quote.skuId,
        price: args.quote.price,
        merchantAddress: args.quote.merchantAddress,
      },
    });
    result.steps.unshift({
      type: "info",
      text: "CaMeL-shaped settle: locked quote only (catalog text never entered the pay agent)",
    });
    return { ...result, llm: "quote" };
  }

  // Legacy / demo: deterministic settle from message — still no Bedrock title parsing
  const fallback = await payX402Tool({
    origin: args.origin,
    message: args.message || "buy a hackathon shirt",
    buyerUid: args.buyerUid,
  });
  fallback.steps.unshift({
    type: "info",
    text: "Deterministic settle (no quote) — fuzzy match from message only",
  });
  return { ...fallback, llm: "deterministic" };
}
