import {
  config,
  explorerTx,
  toAtomic,
} from "@/lib/config";
import {
  ArbitrumFacilitator,
  decodePaymentSignatureHeader,
  encodePaymentRequiredHeader,
  type PaymentPayload,
  type PaymentRequired,
  type PaymentRequirements,
} from "@/lib/protocol/x402-evm";
import type { Sku, StoreRecord } from "@/lib/store/types";

export type { PaymentRequired, PaymentRequirements, PaymentPayload };

export function buildPaymentRequired(
  store: StoreRecord,
  sku: Sku,
  origin: string,
  orderId: string,
  quantity: number,
): PaymentRequired {
  const amount = (
    BigInt(toAtomic(sku.price)) * BigInt(quantity)
  ).toString();
  const asset = (sku.settleAsset || config.tokenAddress).trim();
  const symbol = (sku.settleSymbol || config.tokenSymbol).trim();
  const isDefaultToken =
    asset.toLowerCase() === config.tokenAddress.toLowerCase();
  const accept: PaymentRequirements = {
    scheme: "exact",
    network: config.network,
    amount,
    asset,
    payTo: store.merchantAddress,
    maxTimeoutSeconds: 300,
    extra: {
      name: isDefaultToken ? config.tokenEip712Name : symbol,
      version: isDefaultToken ? config.tokenEip712Version : "1",
      orderId,
      quoteCurrency: sku.quoteCurrency || symbol,
      quotePrice: sku.quotePrice || sku.price,
    },
  };
  return {
    x402Version: 2,
    resource: {
      url: `${origin}/s/${store.slug}/buy`,
      description: `${sku.title} x${quantity}`,
      mimeType: "application/json",
    },
    accepts: [accept],
  };
}

/** Atomic amount for order records (micro-units). */
export function paymentAmountAtomic(
  store: StoreRecord,
  sku: Sku,
  quantity: number,
): string {
  return (
    BigInt(toAtomic(sku.price)) * BigInt(quantity)
  ).toString();
}

export function parsePaymentSignature(header: string): PaymentPayload | null {
  const raw = header.trim();
  if (!raw) return null;
  try {
    return decodePaymentSignatureHeader(raw);
  } catch {
    return null;
  }
}

let facilitatorInstance: ArbitrumFacilitator | null = null;

function facilitator(): ArbitrumFacilitator {
  if (facilitatorInstance) return facilitatorInstance;
  const key = config.facilitatorPrivateKey;
  if (!key) {
    throw new Error(
      "Facilitator key missing. Set FACILITATOR_PRIVATE_KEY (or BUYER_PRIVATE_KEY) with Arbitrum ETH for gas.",
    );
  }
  facilitatorInstance = new ArbitrumFacilitator({
    relayerKey: key,
    network: config.network,
    rpcUrl: config.rpcUrl,
  });
  return facilitatorInstance;
}

/**
 * Verify + settle a signed EIP-3009 payment on Arbitrum.
 */
export async function verifyAndSettle(args: {
  paymentHeader: string;
  paymentRequirements: PaymentRequirements;
  paymentPayload?: PaymentPayload | null;
}) {
  try {
    const payload =
      args.paymentPayload || parsePaymentSignature(args.paymentHeader);
    if (!payload) {
      return { ok: false as const, reason: "Invalid PAYMENT-SIGNATURE" };
    }

    const settled = await facilitator().settle(payload, args.paymentRequirements);
    if (!settled.success) {
      return { ok: false as const, reason: settled.errorReason };
    }

    return {
      ok: true as const,
      txHash: settled.transaction,
      explorerUrl: explorerTx(settled.transaction),
      payer: settled.payer,
    };
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : "verifyAndSettle failed";
    return { ok: false as const, reason };
  }
}

/** @deprecated Use verifyAndSettle — kept name alias for call-site clarity. */
export async function verifyTransfer(args: {
  paymentHeader: string;
  paymentRequirements: PaymentRequirements;
}) {
  return verifyAndSettle(args);
}

export function paymentRequiredHeaders(body: PaymentRequired) {
  return {
    "content-type": "application/json",
    "PAYMENT-REQUIRED": encodePaymentRequiredHeader(body),
    "cache-control": "no-store",
  };
}
