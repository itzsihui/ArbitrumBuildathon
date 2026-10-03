import {
  OKXFacilitatorClient,
} from "@okxweb3/x402-core";
import {
  encodePaymentRequiredHeader,
  decodePaymentSignatureHeader,
} from "@okxweb3/x402-core/http";
import type {
  PaymentPayload,
  PaymentRequired,
  PaymentRequirements,
} from "@okxweb3/x402-core/types";
import {
  config,
  explorerTx,
  toAtomic,
} from "@/lib/config";
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
  const accept: PaymentRequirements = {
    scheme: "exact",
    network: config.network,
    amount,
    asset,
    payTo: store.merchantAddress,
    maxTimeoutSeconds: 300,
    extra: {
      name: symbol === "USDT0" ? "USD₮0" : symbol,
      version: "1",
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
    try {
      const decoded = JSON.parse(
        Buffer.from(raw, "base64").toString("utf8"),
      ) as PaymentPayload;
      if (decoded?.x402Version && decoded?.payload && decoded?.accepted) {
        return decoded;
      }
    } catch {
      return null;
    }
  }
  return null;
}

function hasOkxCredentials() {
  return Boolean(
    config.okxApiKey && config.okxSecretKey && config.okxPassphrase,
  );
}

function facilitator() {
  if (!hasOkxCredentials()) {
    throw new Error(
      "OKX facilitator credentials missing. Set OKX_API_KEY, OKX_SECRET_KEY, OKX_PASSPHRASE.",
    );
  }
  return new OKXFacilitatorClient({
    apiKey: config.okxApiKey,
    secretKey: config.okxSecretKey,
    passphrase: config.okxPassphrase,
    baseUrl: config.okxBaseUrl,
    syncSettle: true,
  });
}

/**
 * Verify + settle a signed EVM payment via the OKX facilitator.
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

    const client = facilitator();
    const verified = await client.verify(payload, args.paymentRequirements);
    if (!verified.isValid) {
      return {
        ok: false as const,
        reason:
          verified.invalidReason ||
          verified.invalidMessage ||
          "Facilitator rejected payment",
      };
    }

    const settled = await client.settle(payload, args.paymentRequirements);
    if (!settled.success || !settled.transaction) {
      return {
        ok: false as const,
        reason:
          settled.errorReason ||
          settled.errorMessage ||
          "Facilitator settle failed",
      };
    }

    return {
      ok: true as const,
      txHash: settled.transaction,
      explorerUrl: explorerTx(settled.transaction),
      payer: settled.payer || undefined,
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
