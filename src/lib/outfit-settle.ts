/**
 * Outfit / multi-merchant settle helpers.
 * Hackathon-safe: merchants quote in mixed units; settle in USDT0 after one DEX route.
 * Full build: per-SKU settleAsset can target ALT_SETTLE_TOKEN (or any EIP-3009 ERC-20).
 */

import { config } from "@/lib/config";
import {
  computeFeeAtomic,
  pointsFromFeeAtomic,
} from "@/lib/ownership-math";
import type { Sku } from "@/lib/store/types";

export type SettleLine = {
  storeSlug: string;
  storeName?: string;
  skuId: string;
  title?: string;
  quantity: number;
  /** Settlement amount (usually USDT0 human). */
  price: string;
  quoteCurrency: string;
  quotePrice: string;
  settleAsset: string;
  settleSymbol: string;
  /** True when quote currency differs from settle symbol. */
  converts: boolean;
  /** True when settle asset differs from default USDT0. */
  multiAsset: boolean;
};

export function resolveSettleAsset(sku: Pick<Sku, "settleAsset" | "settleSymbol">) {
  const settleAsset = (sku.settleAsset || config.tokenAddress).trim();
  const settleSymbol = (sku.settleSymbol || config.tokenSymbol).trim();
  return { settleAsset, settleSymbol };
}

export function toSettleLine(args: {
  storeSlug: string;
  storeName?: string;
  sku: Pick<
    Sku,
    | "id"
    | "title"
    | "price"
    | "quoteCurrency"
    | "quotePrice"
    | "settleAsset"
    | "settleSymbol"
  >;
  quantity?: number;
}): SettleLine {
  const quantity = Math.max(1, args.quantity ?? 1);
  const { settleAsset, settleSymbol } = resolveSettleAsset(args.sku);
  const quoteCurrency = (args.sku.quoteCurrency || settleSymbol).trim();
  const quotePrice = (args.sku.quotePrice || args.sku.price).trim();
  return {
    storeSlug: args.storeSlug,
    storeName: args.storeName,
    skuId: args.sku.id,
    title: args.sku.title,
    quantity,
    price: args.sku.price,
    quoteCurrency,
    quotePrice,
    settleAsset,
    settleSymbol,
    converts: quoteCurrency.toUpperCase() !== settleSymbol.toUpperCase(),
    multiAsset:
      settleAsset.toLowerCase() !== config.tokenAddress.toLowerCase(),
  };
}

export function cartSettlementTotal(lines: SettleLine[]): {
  total: number;
  totalLabel: string;
  byAsset: Array<{ symbol: string; asset: string; total: number }>;
} {
  const byAssetMap = new Map<string, { symbol: string; asset: string; total: number }>();
  let usdtTotal = 0;
  for (const line of lines) {
    const lineTotal = Number(line.price) * line.quantity;
    if (Number.isFinite(lineTotal)) {
      usdtTotal += lineTotal;
      const key = line.settleAsset.toLowerCase();
      const prev = byAssetMap.get(key) || {
        symbol: line.settleSymbol,
        asset: line.settleAsset,
        total: 0,
      };
      prev.total += lineTotal;
      byAssetMap.set(key, prev);
    }
  }
  return {
    total: usdtTotal,
    totalLabel: `${usdtTotal.toFixed(2)} USDT0-eq`,
    byAsset: [...byAssetMap.values()],
  };
}

export function estimateOwnershipPoints(totalHuman: number): number {
  try {
    const grossAtomic = BigInt(
      Math.round(totalHuman * 10 ** config.tokenDecimals),
    ).toString();
    const fee = computeFeeAtomic(grossAtomic);
    return pointsFromFeeAtomic(fee);
  } catch {
    return 1;
  }
}

/** Group settle lines that share the same settle asset (one DEX route each). */
export function groupBySettleAsset(lines: SettleLine[]) {
  const groups = new Map<string, SettleLine[]>();
  for (const line of lines) {
    const key = line.settleAsset.toLowerCase();
    const list = groups.get(key) || [];
    list.push(line);
    groups.set(key, list);
  }
  return [...groups.entries()].map(([asset, items]) => ({
    asset,
    symbol: items[0]?.settleSymbol || config.tokenSymbol,
    lines: items,
    total: items.reduce((s, l) => s + Number(l.price) * l.quantity, 0),
  }));
}
