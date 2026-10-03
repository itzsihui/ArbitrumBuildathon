import { handleCatalog } from "@/lib/protocol/handlers";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  return handleCatalog(slug, request);
}
