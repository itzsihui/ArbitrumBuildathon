import { config } from "@/lib/config";
import type { StoreRecord } from "@/lib/store/types";

export function renderCatalog(store: StoreRecord, origin: string) {
  return {
    protocol: "agentic-commerce-protocol",
    version: "2026-04-17-subset",
    merchant: {
      id: store.slug,
      name: store.name,
      url: `${origin}/s/${store.slug}/llms.txt`,
    },
    currency: config.tokenSymbol,
    network: config.network,
    rails: ["x402", "straitsx-virtual-card"],
    updatedAt: store.updatedAt || store.createdAt,
    products: store.skus.map((sku) => ({
      id: sku.id,
      title: sku.title,
      description: { type: "plain", content: sku.description },
      availability: sku.quantity > 0 ? "in_stock" : "out_of_stock",
      attributes: sku.attrs
        ? {
            subcategory: sku.attrs.subcategory,
            color: sku.attrs.color,
            size: sku.attrs.size,
            material: sku.attrs.material,
            tags: sku.attrs.tags,
          }
        : undefined,
      tokenization: sku.tokenization
        ? {
            kind: sku.tokenization.kind,
            contractAddress: sku.tokenization.contractAddress,
            underlying: sku.tokenization.underlying,
            explorerUrl: sku.tokenization.explorerUrl,
          }
        : undefined,
      quoteCurrency: sku.quoteCurrency,
      quotePrice: sku.quotePrice,
      settleAsset: sku.settleAsset,
      settleSymbol: sku.settleSymbol || config.tokenSymbol,
      variants: [
        {
          id: sku.id,
          title: sku.title,
          quantity: sku.quantity,
          price: `${sku.price} ${sku.settleSymbol || config.tokenSymbol}`,
          amount_atomic: String(
            Math.round(Number(sku.price) * 10 ** config.tokenDecimals),
          ),
          quote:
            sku.quoteCurrency && sku.quoteCurrency !== (sku.settleSymbol || config.tokenSymbol)
              ? `${sku.quotePrice || sku.price} ${sku.quoteCurrency}`
              : undefined,
        },
      ],
    })),
  };
}
