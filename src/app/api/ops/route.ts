import { repo } from "@/lib/store/repo";

export const runtime = "nodejs";

export async function GET() {
  const [stores, orders, reviews] = await Promise.all([
    repo.listStores(),
    repo.listOrders(),
    repo.listReviews(),
  ]);
  return Response.json({
    stores,
    orders,
    reviews,
    aws: {
      table: process.env.AISLE_TABLE || null,
      protocolBase:
        process.env.PROTOCOL_BASE_URL ||
        process.env.NEXT_PUBLIC_PROTOCOL_BASE_URL ||
        null,
      region: process.env.AWS_REGION || null,
    },
  });
}
