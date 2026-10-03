import { ensureUsdt0Liquidity } from "@/lib/liquidity/route";
import {
  cartSettlementTotal,
  groupBySettleAsset,
  toSettleLine,
} from "@/lib/outfit-settle";

export const runtime = "nodejs";

type OutfitLineBody = {
  storeSlug: string;
  storeName?: string;
  skuId: string;
  title?: string;
  quantity?: number;
  price: string;
  quoteCurrency?: string;
  quotePrice?: string;
  settleAsset?: string;
  settleSymbol?: string;
};

/**
 * Preview or execute X Layer liquidity routing (native → settle token) before x402.
 * GET/POST ?price=0.06&execute=0|1&toToken=&toSymbol=
 * POST with `lines` returns an outfit settle plan (hackathon mixed quotes + full multi-asset).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const price = url.searchParams.get("price") || "0.01";
  const quantity = Number(url.searchParams.get("quantity") || "1");
  const execute = url.searchParams.get("execute") === "1";
  const toTokenAddress = url.searchParams.get("toToken") || undefined;
  const toSymbol = url.searchParams.get("toSymbol") || undefined;
  try {
    const result = await ensureUsdt0Liquidity({
      price,
      quantity,
      execute,
      toTokenAddress,
      toSymbol,
    });
    return Response.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "liquidity route failed";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      price?: string;
      quantity?: number;
      execute?: boolean;
      toTokenAddress?: string;
      toSymbol?: string;
      lines?: OutfitLineBody[];
    };

    if (body.lines?.length) {
      const settleLines = body.lines.map((line) =>
        toSettleLine({
          storeSlug: line.storeSlug,
          storeName: line.storeName,
          quantity: line.quantity,
          sku: {
            id: line.skuId,
            title: line.title || line.skuId,
            price: line.price,
            quoteCurrency: line.quoteCurrency,
            quotePrice: line.quotePrice,
            settleAsset: line.settleAsset,
            settleSymbol: line.settleSymbol,
          },
        }),
      );
      const totals = cartSettlementTotal(settleLines);
      const groups = groupBySettleAsset(settleLines);
      const execute = Boolean(body.execute);
      const routes = [];
      for (const g of groups) {
        const route = await ensureUsdt0Liquidity({
          price: String(Math.max(g.total, 0.01)),
          quantity: 1,
          execute,
          toTokenAddress: g.asset,
          toSymbol: g.symbol,
        });
        routes.push({
          asset: g.asset,
          symbol: g.symbol,
          total: g.total,
          lineCount: g.lines.length,
          ...route,
        });
      }
      const primary = routes[0] || null;
      return Response.json({
        ...(primary || {
          needed: false,
          balances: null,
          quote: null,
          executed: false,
          message: "empty outfit",
        }),
        outfit: {
          totals,
          groups: groups.map((g) => ({
            asset: g.asset,
            symbol: g.symbol,
            total: g.total,
            lines: g.lines.map((l) => ({
              storeSlug: l.storeSlug,
              skuId: l.skuId,
              quoteCurrency: l.quoteCurrency,
              quotePrice: l.quotePrice,
              settleSymbol: l.settleSymbol,
              price: l.price,
              quantity: l.quantity,
              converts: l.converts,
              multiAsset: l.multiAsset,
            })),
          })),
          routes,
        },
      });
    }

    const result = await ensureUsdt0Liquidity({
      price: body.price || "0.01",
      quantity: body.quantity,
      execute: Boolean(body.execute),
      toTokenAddress: body.toTokenAddress,
      toSymbol: body.toSymbol,
    });
    return Response.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "liquidity route failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
