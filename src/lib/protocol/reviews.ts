import type { Review } from "@/lib/store/types";

export type PublicReview = {
  skuId: string;
  rating: number;
  tags?: string[];
  comment?: string;
  createdAt: string;
  verifiedPurchase: true;
};

export type ReviewsPayload = {
  slug: string;
  aggregate: {
    ratingAvg: number | null;
    ratingCount: number;
    bySku: Record<string, { avg: number; n: number }>;
  };
  reviews: PublicReview[];
};

export function renderReviews(slug: string, reviews: Review[]): ReviewsPayload {
  const bySkuAccum = new Map<string, { sum: number; n: number }>();
  let sum = 0;
  for (const r of reviews) {
    sum += r.rating;
    const cur = bySkuAccum.get(r.skuId) ?? { sum: 0, n: 0 };
    cur.sum += r.rating;
    cur.n += 1;
    bySkuAccum.set(r.skuId, cur);
  }

  const bySku: Record<string, { avg: number; n: number }> = {};
  for (const [skuId, v] of bySkuAccum) {
    bySku[skuId] = {
      avg: Math.round((v.sum / v.n) * 10) / 10,
      n: v.n,
    };
  }

  const ratingCount = reviews.length;
  return {
    slug,
    aggregate: {
      ratingAvg:
        ratingCount > 0
          ? Math.round((sum / ratingCount) * 10) / 10
          : null,
      ratingCount,
      bySku,
    },
    reviews: reviews.map((r) => ({
      skuId: r.skuId,
      rating: r.rating,
      tags: r.tags,
      comment: r.comment,
      createdAt: r.createdAt,
      verifiedPurchase: true as const,
    })),
  };
}
