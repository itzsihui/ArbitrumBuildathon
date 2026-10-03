import { bearerToken, verifyFirebaseIdToken } from "@/lib/firebase/verify-id-token";
import { repo } from "@/lib/store/repo";
import type { Review, ReviewRating } from "@/lib/store/types";

export const runtime = "nodejs";

const ALLOWED_TAGS = new Set([
  "fit_true",
  "fit_large",
  "fit_small",
  "quality_good",
  "quality_ok",
  "quality_poor",
  "as_described",
  "shipping_fast",
  "would_buy_again",
]);

function parseRating(raw: unknown): ReviewRating | null {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 5) return null;
  return n as ReviewRating;
}

export async function POST(request: Request) {
  try {
    const token = bearerToken(request);
    let buyerUid: string | null = null;

    if (token) {
      const verified = await verifyFirebaseIdToken(token);
      buyerUid = verified?.uid ?? null;
    }

    // Local demo without Firebase: accept explicit demo header
    if (!buyerUid) {
      const demo = request.headers.get("x-demo-buyer-uid")?.trim();
      if (demo && !process.env.AISLE_TABLE?.trim()) {
        buyerUid = demo;
      }
    }

    if (!buyerUid) {
      return Response.json(
        { error: "Sign in as a buyer to leave a verified review." },
        { status: 401 },
      );
    }

    const body = (await request.json()) as {
      orderId?: string;
      rating?: number;
      tags?: string[];
      comment?: string;
    };

    const orderId = String(body.orderId || "").trim();
    if (!orderId) {
      return Response.json({ error: "orderId required" }, { status: 400 });
    }

    const rating = parseRating(body.rating);
    if (!rating) {
      return Response.json(
        { error: "rating must be an integer 1–5" },
        { status: 400 },
      );
    }

    const order = await repo.getOrder(orderId);
    if (!order || order.status !== "paid") {
      return Response.json(
        { error: "Only paid purchases can be reviewed." },
        { status: 400 },
      );
    }

    if (order.buyerUid && order.buyerUid !== buyerUid) {
      return Response.json(
        { error: "This order belongs to another buyer." },
        { status: 403 },
      );
    }

    const existing = await repo.getReviewByOrderId(orderId);
    if (existing) {
      return Response.json(
        { error: "Already reviewed", review: existing },
        { status: 409 },
      );
    }

    const tags = Array.isArray(body.tags)
      ? [...new Set(body.tags.map(String).filter((t) => ALLOWED_TAGS.has(t)))]
          .slice(0, 6)
      : undefined;
    const comment = body.comment
      ? String(body.comment).trim().slice(0, 500) || undefined
      : undefined;

    const review: Review = {
      id: `review_${orderId}`,
      orderId,
      slug: order.slug,
      skuId: order.skuId,
      rating,
      tags: tags?.length ? tags : undefined,
      comment,
      buyerUid,
      createdAt: new Date().toISOString(),
    };

    await repo.putReview(review);

    // Backfill buyerUid on legacy orders
    if (!order.buyerUid) {
      await repo.putOrder({ ...order, buyerUid });
    }

    return Response.json({ review });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not save review";
    return Response.json({ error: message }, { status: 500 });
  }
}
