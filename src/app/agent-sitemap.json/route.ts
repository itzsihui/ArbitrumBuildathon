import { emit } from "@/lib/protocol/events";
import { originFromRequest } from "@/lib/protocol/llms-txt";
import { loadRegistryIndexForSearch } from "@/lib/protocol/registry-index-load";

export const runtime = "nodejs";

/**
 * Agent crawl map (sitemap analogue).
 * GET /agent-sitemap.json
 *
 * Lists every market-listed store with protocol URLs + updatedAt so agents
 * can refresh catalogs without scraping HTML or paging the full registry.
 */
export async function GET(request: Request) {
  const origin = originFromRequest(request);
  const entries = (await loadRegistryIndexForSearch(5000)).filter(
    (e) => e.listOnMarket,
  );

  const stores = entries
    .slice()
    .sort((a, b) => a.slug.localeCompare(b.slug))
    .map((e) => {
      const base = `${origin}/s/${e.slug}`;
      return {
        slug: e.slug,
        name: e.name,
        updatedAt: e.updatedAt,
        skuCount: e.skuCount,
        inStockCount: e.inStockCount,
        ratingAvg: e.ratingAvg,
        ratingCount: e.ratingCount,
        llmsTxt: `${base}/llms.txt`,
        catalog: `${base}/catalog.json`,
        agentCard: `${base}/agent.json`,
        reviews: `${base}/reviews.json`,
        buyX402: `${base}/buy`,
      };
    });

  emit({
    status: 200,
    method: "GET",
    path: "/agent-sitemap.json",
    message: `agent-sitemap · ${stores.length} store(s)`,
  });

  return Response.json(
    {
      protocol: "borneo-agentic-storefront",
      version: "1.2",
      description:
        "Agent sitemap — crawl these catalogs. Prefer /api/search for intent queries. Do not scrape HTML.",
      storeCount: stores.length,
      endpoints: {
        llmsTxt: `${origin}/llms.txt`,
        registry: `${origin}/registry.json`,
        search: `${origin}/api/search`,
        marketApi: `${origin}/api/market`,
      },
      stores,
    },
    {
      headers: {
        "cache-control": "public, max-age=15, stale-while-revalidate=60",
      },
    },
  );
}
