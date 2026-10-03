import { bridgeConfig, getBridgeWallets } from "@/lib/bridge/arbitrum";
import { config } from "@/lib/config";

export const runtime = "nodejs";

/** Server wallets with ETH balances on the parent chain and on Arbitrum. */
export async function GET() {
  try {
    const wallets = await getBridgeWallets();
    return Response.json({
      parentChain: bridgeConfig.parentLabel,
      childChain: config.chainLabel,
      maxDepositEth: bridgeConfig.maxDepositEth,
      wallets,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "bridge balances failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
