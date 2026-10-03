import { handleAgentJson } from "@/lib/protocol/handlers";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  return handleAgentJson(slug, request);
}
