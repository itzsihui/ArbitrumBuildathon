import { depositEth, type BridgeRole } from "@/lib/bridge/arbitrum";

export const runtime = "nodejs";

/** POST { role: "buyer" | "facilitator", amountEth: "0.01" } */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    role?: string;
    amountEth?: string | number;
  };
  const role: BridgeRole = body.role === "buyer" ? "buyer" : "facilitator";
  const amountEth = String(body.amountEth ?? "").trim();
  if (!/^\d+(\.\d{1,18})?$/.test(amountEth)) {
    return Response.json(
      { error: "amountEth must be a decimal ETH string, e.g. 0.01" },
      { status: 400 },
    );
  }

  try {
    const result = await depositEth({ role, amountEth });
    return Response.json({ role, amountEth, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "deposit failed";
    return Response.json({ error: message }, { status: 400 });
  }
}
