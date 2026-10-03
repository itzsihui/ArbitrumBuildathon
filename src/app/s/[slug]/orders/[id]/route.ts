import { handleOrder } from "@/lib/protocol/handlers";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string; id: string }> },
) {
  const { slug, id } = await context.params;
  return handleOrder(slug, id);
}
