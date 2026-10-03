import { emit } from "@/lib/protocol/events";
import { originFromRequest } from "@/lib/protocol/llms-txt";
import { renderRootLlmsTxt } from "@/lib/protocol/registry";
import { repo } from "@/lib/store/repo";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const stores = (await repo.listStores()).filter(
    (s) => s.listOnMarket !== false,
  );
  const origin = originFromRequest(request);
  const body = renderRootLlmsTxt(stores, origin);
  emit({
    status: 200,
    method: "GET",
    path: "/llms.txt",
    message: `network llms.txt · ${stores.length} store(s)`,
  });
  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
