import {
  filterMarketProducts,
  type MarketProduct,
} from "@/lib/protocol/registry";

const EMBED_MODEL = "text-embedding-3-small";
const DEFAULT_LIMIT = 8;
const MIN_SCORE = 0.28;
/** Out-of-stock still returned but heavily demoted. */
const OOS_MULTIPLIER = 0.2;
/** Cap so reviews cannot flip a weak semantic match. */
const MAX_REVIEW_BOOST = 0.08;

export type ScoreBreakdown = {
  semantic: number;
  stock: number;
  reviews: number;
  final: number;
};

export type SearchHit = MarketProduct & {
  score: number;
  scoreBreakdown: ScoreBreakdown;
  buyX402: string;
  catalog: string;
};

export type SemanticSearchResult = {
  query: string;
  mode: "semantic" | "keyword";
  model: string | null;
  productCount: number;
  products: SearchHit[];
};

/** Per-SKU review aggregates for commerce re-rank. */
export type ReviewSignal = {
  avg: number;
  n: number;
};

type CacheEntry = {
  fingerprint: string;
  vectors: Float32Array[];
  texts: string[];
};

let catalogCache: CacheEntry | null = null;

function openaiKey() {
  return process.env.OPENAI_API_KEY?.trim() || "";
}

function productText(p: MarketProduct) {
  const a = p.attrs;
  const t = p.tokenization;
  return [
    p.title,
    p.description,
    p.storeName,
    p.id,
    a?.subcategory,
    a?.color,
    a?.size,
    a?.material,
    ...(a?.tags ?? []),
    t?.kind,
    t?.underlying,
    t?.kind === "rwa" ? "tokenized real-world asset RWA" : "",
    t?.kind === "tokenized-equity" ? "tokenized equity ownership units" : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

function catalogFingerprint(products: MarketProduct[]) {
  return products
    .map(
      (p) =>
        `${p.storeSlug}:${p.id}:${p.title}:${p.attrs?.color || ""}:${p.attrs?.size || ""}`,
    )
    .join("|");
}

function cosine(a: Float32Array, b: Float32Array) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/**
 * Wilson lower bound for star ratings (1–5), mapped to ~0–1 then capped.
 * Cold-start (n=0) → 0 boost (neutral, not a penalty).
 */
export function reviewBoost(signal?: ReviewSignal | null): number {
  if (!signal || signal.n <= 0 || !Number.isFinite(signal.avg)) return 0;
  const n = signal.n;
  // Normalize stars to [0,1]
  const p = Math.min(1, Math.max(0, (signal.avg - 1) / 4));
  const z = 1.96;
  const denom = 1 + (z * z) / n;
  const centre = p + (z * z) / (2 * n);
  const margin = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n);
  const lower = (centre - margin) / denom;
  return Math.min(MAX_REVIEW_BOOST, Math.max(0, lower) * MAX_REVIEW_BOOST * 1.25);
}

export function applyCommerceRank(
  semantic: number,
  product: MarketProduct,
  reviews?: Map<string, ReviewSignal> | null,
): ScoreBreakdown {
  const inStock = product.quantity > 0;
  const stockMult = inStock ? 1 : OOS_MULTIPLIER;
  const key = `${product.storeSlug}:${product.id}`;
  const rev = reviewBoost(reviews?.get(key));
  const afterStock = semantic * stockMult;
  const final = afterStock + rev;
  return {
    semantic: Math.round(semantic * 1000) / 1000,
    stock: Math.round(stockMult * 1000) / 1000,
    reviews: Math.round(rev * 1000) / 1000,
    final: Math.round(final * 1000) / 1000,
  };
}

async function embedBatch(texts: string[]): Promise<Float32Array[] | null> {
  const key = openaiKey();
  if (!key || texts.length === 0) return null;

  try {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: EMBED_MODEL,
        input: texts,
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      data?: { embedding: number[]; index: number }[];
    };
    if (!data.data?.length) return null;
    const sorted = [...data.data].sort((a, b) => a.index - b.index);
    return sorted.map((row) => Float32Array.from(row.embedding));
  } catch {
    return null;
  }
}

async function ensureCatalogVectors(products: MarketProduct[]) {
  const fingerprint = catalogFingerprint(products);
  if (catalogCache?.fingerprint === fingerprint) return catalogCache;

  const texts = products.map(productText);
  const vectors = await embedBatch(texts);
  if (!vectors || vectors.length !== products.length) return null;

  catalogCache = { fingerprint, vectors, texts };
  return catalogCache;
}

function pinHighestPriced(
  result: SemanticSearchResult,
  catalog: MarketProduct[],
  origin: string,
  reviews: Map<string, ReviewSignal> | null,
  limit: number,
  enabled?: boolean,
): SemanticSearchResult {
  if (!enabled || catalog.length === 0) return result;
  const top = catalog.reduce((best, p) =>
    Number(p.price) > Number(best.price) ? p : best,
  );
  const [hit] = toHits([{ product: top, semantic: 1 }], origin, reviews);
  if (!hit) return result;
  const rest = result.products.filter(
    (p) => p.storeSlug !== top.storeSlug || p.id !== top.id,
  );
  const products = [hit, ...rest].slice(0, limit);
  return { ...result, products, productCount: products.length };
}

function toHits(
  rows: Array<{ product: MarketProduct; semantic: number }>,
  origin: string,
  reviews?: Map<string, ReviewSignal> | null,
): SearchHit[] {
  return rows
    .map(({ product, semantic }) => {
      const breakdown = applyCommerceRank(semantic, product, reviews);
      return {
        ...product,
        score: breakdown.final,
        scoreBreakdown: breakdown,
        buyX402: `${origin}/s/${product.storeSlug}/buy`,
        catalog: `${origin}/s/${product.storeSlug}/catalog.json`,
      };
    })
    .sort((a, b) => b.score - a.score);
}

function keywordHits(
  products: MarketProduct[],
  query: string,
  origin: string,
  limit: number,
  reviews?: Map<string, ReviewSignal> | null,
): SemanticSearchResult {
  const filtered = filterMarketProducts(products, query);
  const rows = filtered.map((product, i) => ({
    product,
    semantic: 1 - i * 0.05,
  }));
  const productsOut = toHits(rows, origin, reviews).slice(0, limit);
  return {
    query,
    mode: "keyword",
    model: null,
    productCount: productsOut.length,
    products: productsOut,
  };
}

/**
 * Intent search over the live market catalog.
 * Prefer passing a pre-shortlisted product set (fashion registry index → full catalogs).
 * Embeds at most `embedCap` products (after keyword prefilter).
 * Re-ranks with stock + verified-purchase review signals.
 */
export async function semanticSearchMarket(args: {
  products: MarketProduct[];
  query: string;
  queries?: string[];
  origin: string;
  limit?: number;
  /** Max products to embed (after keyword shortlist). */
  embedCap?: number;
  /** Map of `storeSlug:skuId` → review aggregate. */
  reviews?: Map<string, ReviewSignal> | null;
  /** Most-expensive / premium hunts: pin the highest-priced SKU first. */
  preferHighestPrice?: boolean;
}): Promise<SemanticSearchResult> {
  const queries = (
    args.queries?.length ? args.queries : [args.query]
  )
    .map((q) => q.trim())
    .filter(Boolean);
  const query = queries.join(" · ") || args.query.trim();
  const limit = Math.min(Math.max(args.limit ?? DEFAULT_LIMIT, 1), 24);
  const embedCap = Math.min(Math.max(args.embedCap ?? 200, 24), 400);
  const reviews = args.reviews ?? null;
  const origin = args.origin;
  const finalize = (result: SemanticSearchResult) =>
    pinHighestPriced(
      result,
      args.products,
      origin,
      reviews,
      limit,
      args.preferHighestPrice,
    );

  if (!query) {
    return finalize({
      query: "",
      mode: "keyword",
      model: null,
      productCount: 0,
      products: [],
    });
  }
  if (args.products.length === 0) {
    return finalize({
      query,
      mode: "keyword",
      model: null,
      productCount: 0,
      products: [],
    });
  }

  let pool = args.products;
  if (pool.length > embedCap && !args.preferHighestPrice) {
    const byKey = new Map<string, MarketProduct>();
    for (const q of queries) {
      for (const p of filterMarketProducts(pool, q)) {
        byKey.set(`${p.storeSlug}:${p.id}`, p);
      }
    }
    const short = [...byKey.values()];
    pool = (short.length > 0 ? short : pool).slice(0, embedCap);
  }

  const cache = await ensureCatalogVectors(pool);
  const queryVecs = (await embedBatch(queries)) ?? [];

  if (!cache || queryVecs.length === 0) {
    const byKey = new Map<string, { product: MarketProduct; semantic: number }>();
    for (const q of queries) {
      const hits = filterMarketProducts(args.products, q);
      hits.forEach((p, i) => {
        const key = `${p.storeSlug}:${p.id}`;
        const semantic = 1 - i * 0.05;
        const prev = byKey.get(key);
        if (!prev || semantic > prev.semantic) {
          byKey.set(key, { product: p, semantic });
        }
      });
    }
    const merged = [...byKey.values()];
    if (merged.length === 0) {
      return finalize(
        keywordHits(args.products, query, origin, limit, reviews),
      );
    }
    const productsOut = toHits(merged, origin, reviews).slice(0, limit);
    return finalize({
      query,
      mode: "keyword",
      model: null,
      productCount: productsOut.length,
      products: productsOut,
    });
  }

  const scored = pool
    .map((product, i) => {
      let best = 0;
      for (const qv of queryVecs) {
        best = Math.max(best, cosine(qv, cache.vectors[i]!));
      }
      return { product, semantic: best };
    })
    .filter((row) =>
      args.preferHighestPrice ? true : row.semantic >= MIN_SCORE,
    );

  if (scored.length === 0) {
    return finalize(
      keywordHits(args.products, queries[0] || query, origin, limit, reviews),
    );
  }

  const productsOut = toHits(scored, origin, reviews).slice(0, limit);
  return finalize({
    query,
    mode: "semantic",
    model: EMBED_MODEL,
    productCount: productsOut.length,
    products: productsOut,
  });
}
