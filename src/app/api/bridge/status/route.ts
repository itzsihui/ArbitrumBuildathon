import { getDepositStatus } from "@/lib/bridge/arbitrum";

export const runtime = "nodejs";

/** GET ?tx=0x… — parent deposit tx hash. */
export async function GET(request: Request) {
  const tx = new URL(request.url).searchParams.get("tx")?.trim() ?? "";
  if (!/^0x[0-9a-fA-F]{64}$/.test(tx)) {
    return Response.json({ error: "tx must be a 0x… tx hash" }, { status: 400 });
  }
  try {
    return Response.json(await getDepositStatus(tx));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "deposit status failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
