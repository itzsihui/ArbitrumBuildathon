import { emit } from "@/lib/protocol/events";

export const runtime = "nodejs";

/**
 * Demo report sink for quarantined injection-shaped catalog listings.
 * Logs structured fields only — never treats title text as instructions.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      storeSlug?: string;
      skuId?: string;
      flags?: string[];
      intentSnippet?: string;
    };

    const storeSlug = String(body.storeSlug || "").trim();
    const skuId = String(body.skuId || "").trim();
    const flags = Array.isArray(body.flags)
      ? body.flags.map(String).slice(0, 12)
      : [];
    const intentSnippet = String(body.intentSnippet || "")
      .trim()
      .slice(0, 160);

    if (!storeSlug || !skuId) {
      return Response.json(
        { ok: false, error: "storeSlug and skuId required" },
        { status: 400 },
      );
    }

    const reportId = `rpt_${Date.now().toString(36)}`;
    console.info("[catalog-report]", {
      reportId,
      storeSlug,
      skuId,
      flags,
      intentSnippet,
    });

    emit({
      status: 200,
      method: "POST",
      path: "/api/catalog-report",
      store: storeSlug,
      message: `quarantine report ${skuId} flags=${flags.join(",") || "none"} id=${reportId}`,
    });

    return Response.json({
      ok: true,
      reportId,
      storeSlug,
      skuId,
      flags,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Report failed";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
