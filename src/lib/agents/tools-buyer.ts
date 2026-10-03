import { privateKeyToAccount } from "viem/accounts";
import { x402Client } from "@okxweb3/x402-core/client";
import { encodePaymentSignatureHeader } from "@okxweb3/x402-core/http";
import type {
  PaymentRequired,
  PaymentRequirements,
} from "@okxweb3/x402-core/types";
import { ExactEvmScheme } from "@okxweb3/x402-evm/exact/client";
import { resolveBuyerTarget } from "@/lib/agents/discover";
import { config, explorerTx, toAtomic, toPaymentAmount } from "@/lib/config";
import { ensureUsdt0Liquidity } from "@/lib/liquidity/route";
import { emit } from "@/lib/protocol/events";

export type BuyerStep = {
  type: "info" | "http" | "chain" | "error" | "success";
  text: string;
};

export type BuyerReceipt = {
  orderId?: string;
  explorerUrl?: string;
  txHash?: string;
  amount?: string;
  rail?: string;
  status?: string;
  swapTxHash?: string;
  swapExplorerUrl?: string;
  routeSummary?: string;
  ownershipPoints?: number;
  protocolFeeBps?: number;
  [key: string]: unknown;
};

/** Locked settle quote — no product titles or catalog prose. */
export type PayQuote = {
  storeSlug: string;
  skuId: string;
  price: string;
  merchantAddress?: string;
  settleAsset?: string;
  settleSymbol?: string;
};

export { extractRequestedProduct } from "@/lib/agents/discover";

/**
 * Deterministic x402 handshake on X Layer (USDT0).
 * Prefer a locked quote (slug+skuId+price). Fuzzy message/product matching
 * remains only for legacy demo paths without a quote.
 */
export async function payX402Tool(args: {
  origin: string;
  slug?: string;
  message?: string;
  product?: string;
  quote?: PayQuote;
  buyerUid?: string;
}): Promise<{ steps: BuyerStep[]; receipt?: BuyerReceipt }> {
  const steps: BuyerStep[] = [];
  const quote = args.quote;
  const buyerUid = args.buyerUid?.trim() || undefined;

  const resolved = await resolveBuyerTarget({
    slug: quote?.storeSlug || args.slug,
    skuId: quote?.skuId,
    message: quote ? undefined : args.message,
    product: quote ? undefined : args.product,
  });

  if (!resolved.ok) {
    steps.push({
      type: "info",
      text: quote
        ? `Resolving locked quote /s/${quote.storeSlug} · ${quote.skuId}`
        : args.slug || args.message?.includes("/s/")
          ? "Resolving store"
          : "Searching Borneo network registry (no /s/{slug} in prompt)",
    });
    steps.push({
      type: "error",
      text: resolved.available
        ? `${resolved.reason} Available: ${resolved.available}.`
        : resolved.reason,
    });
    return { steps };
  }

  const { slug, sku, via, merchantAddress } = resolved;
  const base = `${args.origin}/s/${slug}`;
  const expectedPrice = quote?.price || sku.price;
  const expectedPayTo = (quote?.merchantAddress || merchantAddress).trim();

  const settleAsset =
    quote?.settleAsset || sku.settleAsset || config.tokenAddress;
  const settleSymbol =
    quote?.settleSymbol || sku.settleSymbol || config.tokenSymbol;

  if (via === "quote") {
    steps.push({
      type: "info",
      text: `Capability lock → /s/${slug} · sku ${sku.id} · ${expectedPrice} ${settleSymbol}`,
    });
  } else if (via === "registry") {
    steps.push({
      type: "info",
      text: `Network registry → matched sku ${sku.id} @ /s/${slug}`,
    });
    emit({
      status: 200,
      method: "GET",
      path: "/registry.json",
      store: slug,
      message: `buyer matched sku ${sku.id}`,
    });
  }

  steps.push({ type: "info", text: `Discovering ${base}/llms.txt` });
  const llms = await fetch(`${base}/llms.txt`);
  steps.push({
    type: "http",
    text: `GET llms.txt → ${llms.status}`,
  });

  steps.push({ type: "info", text: "Loading ACP catalog" });
  const catalogRes = await fetch(`${base}/catalog.json`);
  steps.push({
    type: "http",
    text: `GET catalog.json → ${catalogRes.status} · sku ${sku.id}`,
  });

  let expectedAmount: string;
  let expectedAtomic: string;
  try {
    expectedAmount = toPaymentAmount(expectedPrice);
    expectedAtomic = toAtomic(expectedPrice);
  } catch {
    steps.push({
      type: "error",
      text: `Invalid locked price: ${expectedPrice}`,
    });
    return { steps };
  }

  steps.push({
    type: "info",
    text: `Routing liquidity on X Layer (${settleSymbol} balance → OKX DEX if short)`,
  });
  let routeSwapTx: string | undefined;
  let routeSummary: string | undefined;
  try {
    const route = await ensureUsdt0Liquidity({
      price: expectedPrice,
      quantity: 1,
      execute: true,
      toTokenAddress: settleAsset,
      toSymbol: settleSymbol,
    });
    if (route.balances) {
      steps.push({
        type: "chain",
        text: `Wallet ${route.balances.address.slice(0, 8)}… · ${settleSymbol} ${route.balances.usdt0Human} · native ${route.balances.nativeHuman}`,
      });
    }
    if (route.quote) {
      routeSummary = route.quote.routeSummary;
      const label =
        route.quote.mode === "live"
          ? "Live route"
          : route.quote.mode === "mainnet-preview"
            ? "Live OKX DEX quote on X Layer mainnet (quote only, not executed)"
            : "Plan only (no DEX liquidity on this network)";
      steps.push({
        type: route.quote.mode === "plan" ? "info" : "chain",
        text: `${label}: ${route.quote.fromAmountHuman} ${route.quote.fromSymbol} → ~${route.quote.toAmountHuman} ${route.quote.toSymbol}`,
      });
      if (route.quote.mode === "mainnet-preview") {
        steps.push({
          type: "info",
          text: `Settlement network: X Layer ${config.chainId === 196 ? "mainnet (196)" : "Testnet (" + config.chainId + ")"}`,
        });
      }
    }
    if (route.executed && route.swapTxHash) {
      routeSwapTx = route.swapTxHash;
      steps.push({
        type: "success",
        text: `Liquidity routed · ${route.explorerUrl || route.swapTxHash}`,
      });
    } else {
      steps.push({ type: "info", text: route.message });
    }
  } catch (error) {
    steps.push({
      type: "info",
      text: `Liquidity check skipped: ${error instanceof Error ? error.message : "unknown"}`,
    });
  }

  const orderId = crypto.randomUUID();
  steps.push({ type: "info", text: `POST ${base}/buy (no payment)` });
  const first = await fetch(`${base}/buy`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      skuId: sku.id,
      quantity: 1,
      orderId,
      buyerUid,
      swapTxHash: routeSwapTx,
    }),
  });
  const challenge = (await first.json()) as PaymentRequired & {
    error?: string;
  };
  steps.push({
    type: "http",
    text: `HTTP ${first.status} ${first.status === 402 ? "Payment Required" : ""}`,
  });

  if (first.status !== 402) {
    steps.push({ type: "error", text: "Expected 402 challenge" });
    return { steps };
  }

  const accept = challenge.accepts?.[0] as PaymentRequirements | undefined;
  if (!accept) {
    steps.push({ type: "error", text: "402 missing accepts[]" });
    return { steps };
  }

  if (accept.payTo.trim().toLowerCase() !== expectedPayTo.toLowerCase()) {
    steps.push({
      type: "error",
      text: `Capability check failed: 402 payTo ${accept.payTo} does not match locked merchant ${expectedPayTo}`,
    });
    return { steps };
  }

  if (accept.amount !== expectedAtomic) {
    steps.push({
      type: "error",
      text: `Capability check failed: 402 amount ${accept.amount} does not match locked price ${expectedPrice} ${config.tokenSymbol} (${expectedAmount} → ${expectedAtomic} atomic)`,
    });
    return { steps };
  }

  steps.push({
    type: "info",
    text: "Capability checks passed: payTo + amount match locked quote",
  });

  const buyerKey = config.buyerPrivateKey;
  if (!buyerKey) {
    emit({
      status: 402,
      method: "POST",
      path: `${base}/buy`,
      store: slug,
      orderId,
      rail: "x402",
      message: "402 unpaid: BUYER_PRIVATE_KEY missing, cannot sign on X Layer",
    });
    steps.push({
      type: "error",
      text: `402 is the challenge. Add BUYER_PRIVATE_KEY + funded ${config.tokenSymbol} on X Layer (${config.network}), then Buy again.`,
    });
    return { steps, receipt: challenge as BuyerReceipt };
  }

  const account = privateKeyToAccount(buyerKey);

  steps.push({
    type: "chain",
    text: `Signing ${config.tokenSymbol} Payment ${accept.amount} atomic → ${accept.payTo} on ${config.network} (${account.address})`,
  });

  let paymentHeader: string;
  try {
    const client = new x402Client().register(
      config.network,
      new ExactEvmScheme(account, { rpcUrl: config.rpcUrl }),
    );
    const payload = await client.createPaymentPayload(challenge);
    paymentHeader = encodePaymentSignatureHeader(payload);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "sign failed";
    emit({
      status: 402,
      method: "POST",
      path: `${base}/buy`,
      store: slug,
      orderId,
      rail: "x402",
      message: `402 unsigned: ${reason}`,
    });
    steps.push({ type: "error", text: reason });
    return { steps, receipt: challenge as BuyerReceipt };
  }

  steps.push({ type: "chain", text: "Signed PAYMENT-SIGNATURE ready" });

  const second = await fetch(`${base}/buy`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "PAYMENT-SIGNATURE": paymentHeader,
    },
    body: JSON.stringify({
      skuId: sku.id,
      quantity: 1,
      orderId,
      buyerUid,
      swapTxHash: routeSwapTx,
    }),
  });
  const secondText = await second.text();
  let receipt: BuyerReceipt;
  try {
    receipt = JSON.parse(secondText) as BuyerReceipt;
  } catch {
    const snippet = secondText.slice(0, 160).replace(/\s+/g, " ");
    steps.push({
      type: "error",
      text: `HTTP ${second.status} non-JSON from /buy: ${snippet}`,
    });
    return {
      steps,
      receipt: { status: "verify-failed" },
    };
  }
  if (receipt.txHash && !receipt.explorerUrl) {
    receipt.explorerUrl = explorerTx(String(receipt.txHash));
  }
  if (routeSwapTx) {
    receipt.swapTxHash = routeSwapTx;
    receipt.swapExplorerUrl = explorerTx(routeSwapTx);
  }
  if (routeSummary) receipt.routeSummary = routeSummary;
  steps.push({
    type: second.ok ? "success" : "error",
    text: `HTTP ${second.status} ${second.ok ? "receipt unlocked" : JSON.stringify(receipt)}`,
  });
  if (second.ok && receipt.explorerUrl) {
    steps.push({ type: "success", text: receipt.explorerUrl });
  } else if (second.ok && receipt.txHash) {
    steps.push({ type: "success", text: explorerTx(String(receipt.txHash)) });
  }
  if (second.ok && receipt.ownershipPoints) {
    steps.push({
      type: "success",
      text: `XPoints +${receipt.ownershipPoints} (${receipt.protocolFeeBps ?? config.protocolFeeBps} bps protocol fee)`,
    });
  }
  return { steps, receipt };
}
