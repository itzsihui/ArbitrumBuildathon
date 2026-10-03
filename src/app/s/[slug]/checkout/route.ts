import { handleCheckout } from "@/lib/protocol/handlers";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  return handleCheckout(slug, request);
}
