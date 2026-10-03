import { privateKeyToAccount } from "viem/accounts";
import {
  checkoutOrderNonce,
  createPaymentPayload,
  encodePaymentSignatureHeader,
  type PaymentRequired,
  type PaymentRequirements,
} from "@/lib/protocol/x402-evm";
import { resolveBuyerTarget } from "@/lib/agents/discover";
import { config, explorerTx, toAtomic, toPaymentAmount } from "@/lib/config";
import { ensureSettleLiquidity } from "@/lib/liquidity/route";
import { emit } from "@/lib/protocol/events";

const sameAddress = (a?: string, b?: string) =>
  !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Direct mode: payTo must be the locked merchant. Checkout mode: payTo must be
 * the trusted BorneoCheckout and the order nonce must bind the locked merchant,
 * token and amount, so the contract can only pay that merchant.
 */
function checkPayTo(
  accept: PaymentRequirements,
  expectedMerchant: string,
): { ok: true; viaCheckout: boolean } | { ok: false; reason: string } {
  if (accept.extra?.primaryType !== "ReceiveWithAuthorization") {
    return sameAddress(accept.payTo, expectedMerchant)
      ? { ok: true, viaCheckout: false }
      : {
          ok: false,
          reason: `402 payTo ${accept.payTo} does not match locked merchant ${expectedMerchant}`,
        };
  }
  const { checkout, merchant, orderKey, nonce } = accept.extra;
  if (!config.checkoutAddress || !sameAddress(accept.payTo, config.checkoutAddress)) {
    return {
      ok: false,
      reason: `402 payTo ${accept.payTo} is not the trusted BorneoCheckout ${config.checkoutAddress || "(unset)"}`,
    };
  }
  if (!sameAddress(checkout, accept.payTo)) {
    return { ok: false, reason: "402 extra.checkout does not match payTo" };
  }
  if (!sameAddress(merchant, expectedMerchant)) {
    return {
      ok: false,
      reason: `402 merchant ${merchant} does not match locked merchant ${expectedMerchant}`,
    };
  }
  if (!orderKey || !nonce) {
    return { ok: false, reason: "402 checkout requirement missing orderKey / nonce" };
  }
  const expectedNonce = checkoutOrderNonce({
    chainId: config.chainId,
    checkout: accept.payTo,
    orderKey,
    merchant: expectedMerchant,
    token: accept.asset,
    amount: accept.amount,
  });
  if (expectedNonce.toLowerCase() !== nonce.toLowerCase()) {
    return { ok: false, reason: "402 order nonce does not bind the locked merchant / amount" };
  }
  return { ok: true, viaCheckout: true };
}

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
 * Deterministic x402 handshake on Arbitrum (USDC).
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
    text: `Routing liquidity on Arbitrum (${settleSymbol} balance → Uniswap V3 if short)`,
  });
  let routeSwapTx: string | undefined;
  let routeSummary: string | undefined;
  try {
    const route = await ensureSettleLiquidity({
      price: expectedPrice,
      quantity: 1,
      execute: true,
      toTokenAddress: settleAsset,
      toSymbol: settleSymbol,
    });
    if (route.balances) {
      steps.push({
        type: "chain",
        text: `Wallet ${route.balances.address.slice(0, 8)}… · ${settleSymbol} ${route.balances.tokenHuman} · native ${route.balances.nativeHuman}`,
      });
    }
    if (route.quote) {
      routeSummary = route.quote.routeSummary;
      const label =
        route.quote.mode === "live"
          ? "Live route"
          : route.quote.mode === "mainnet-preview"
            ? "Live Uniswap V3 quote on Arbitrum One (quote only, not executed)"
            : "Plan only (no DEX liquidity on this network)";
      steps.push({
        type: route.quote.mode === "plan" ? "info" : "chain",
        text: `${label}: ${route.quote.fromAmountHuman} ${route.quote.fromSymbol} → ~${route.quote.toAmountHuman} ${route.quote.toSymbol}`,
      });
      if (route.quote.mode === "mainnet-preview") {
        steps.push({
          type: "info",
          text: `Settlement network: ${config.chainLabel} (${config.chainId})`,
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

  const payToCheck = checkPayTo(accept, expectedPayTo);
  if (!payToCheck.ok) {
    steps.push({ type: "error", text: `Capability check failed: ${payToCheck.reason}` });
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
    text: payToCheck.viaCheckout
      ? "Capability checks passed: BorneoCheckout order nonce binds merchant + amount to the locked quote"
      : "Capability checks passed: payTo + amount match locked quote",
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
      message: "402 unpaid: BUYER_PRIVATE_KEY missing, cannot sign on Arbitrum",
    });
    steps.push({
      type: "error",
      text: `402 is the challenge. Add BUYER_PRIVATE_KEY + funded ${config.tokenSymbol} on Arbitrum (${config.network}), then Buy again.`,
    });
    return { steps, receipt: challenge as BuyerReceipt };
  }

  const account = privateKeyToAccount(buyerKey);

  steps.push({
    type: "chain",
    text: `Signing ${String(accept.extra?.settleSymbol || config.tokenSymbol)} ${
      payToCheck.viaCheckout ? "ReceiveWithAuthorization" : "Payment"
    } ${accept.amount} atomic → ${accept.payTo} on ${config.network} (${account.address})`,
  });

  let paymentHeader: string;
  try {
    const payload = await createPaymentPayload(account, challenge);
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
