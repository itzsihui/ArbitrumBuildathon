export type ChainNetwork = "eip155:1952" | "eip155:196";

/** X Layer Testnet USDT0 (EIP-3009) — from @okxweb3/x402-evm defaults. */
export const USDT0_TESTNET = "0x9e29b3aada05bf2d2c827af80bd28dc0b9b4fb0c";
/** X Layer Mainnet USDT0. */
export const USDT0_MAINNET = "0x779ded0c9e1022225f8e0630b35a9b54be713736";

function env(name: string, fallback: string) {
  return process.env[name] || fallback;
}

function normalizePrivateKey(
  raw: string | undefined,
): `0x${string}` | undefined {
  const trimmed = raw?.trim().replace(/^["']|["']$/g, "");
  if (!trimmed) return undefined;
  const hex = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(hex)) return undefined;
  return hex as `0x${string}`;
}

export const config = {
  rpcUrl: env("XLAYER_RPC_URL", "https://testrpc.xlayer.tech/terigon"),
  network: env("XLAYER_NETWORK", "eip155:1952") as ChainNetwork,
  /** CAIP-2 chain id number (1952 testnet / 196 mainnet). */
  get chainId() {
    const n = this.network.split(":")[1];
    return Number(n) || 1952;
  },
  tokenAddress: env("TOKEN_ADDRESS", USDT0_TESTNET),
  tokenSymbol: env("TOKEN_SYMBOL", "USDT0"),
  tokenDecimals: Number(env("TOKEN_DECIMALS", "6")),
  /**
   * Optional second settle asset for multi-merchant demos (full build).
   * Defaults to USDT0 so testnet demos still work; set ALT_SETTLE_TOKEN to a
   * different EIP-3009 ERC-20 when you have liquidity for that asset.
   */
  altSettleToken: env("ALT_SETTLE_TOKEN", USDT0_TESTNET),
  altSettleSymbol: env("ALT_SETTLE_SYMBOL", "USDT0"),
  /**
   * OKX DEX lists no USDT0 liquidity on X Layer Testnet (1952). When settling on
   * testnet, show a live quote from X Layer mainnet (196) instead. Quote only:
   * swaps are never broadcast from a mainnet preview. Set to 0 to disable.
   */
  get dexMainnetPreview() {
    return this.chainId !== 196 && process.env.OKX_DEX_MAINNET_PREVIEW !== "0";
  },
  dexPreviewChainIndex: "196",
  dexPreviewTokenAddress: USDT0_MAINNET,
  /** Demo unit price in USDT0 on X Layer. */
  demoUnitPriceXsgd: "0.01",
  merchantAddress: env(
    "MERCHANT_ADDRESS",
    "0x0000000000000000000000000000000000000001",
  ),
  /** Buyer EVM private key for server-side x402 settle. */
  get buyerPrivateKey() {
    return normalizePrivateKey(
      process.env.BUYER_PRIVATE_KEY || process.env.XLAYER_BUYER_PRIVATE_KEY,
    );
  },
  /** @deprecated Alias — prefer buyerPrivateKey. */
  get buyerSeed() {
    return this.buyerPrivateKey;
  },
  okxApiKey: env("OKX_API_KEY", ""),
  okxSecretKey: env("OKX_SECRET_KEY", ""),
  okxPassphrase: env("OKX_PASSPHRASE", ""),
  okxBaseUrl: env("OKX_BASE_URL", "https://web3.okx.com"),
  explorerBase: env(
    "EXPLORER_BASE",
    "https://www.okx.com/web3/explorer/xlayer-test",
  ),
  /** Optional legacy Card MCP URL — unused when empty; Visa rail uses local mandate. */
  straitsxMcpUrl: env("STRAITSX_MCP_URL", ""),
  get straitsxMcpToken() {
    return (
      process.env.STRAITSX_MCP_TOKEN?.trim() ||
      process.env.STRAITSX_API_KEY?.trim() ||
      undefined
    );
  },
  bedrockRegion: env("AWS_REGION", "ap-southeast-1"),
  bedrockModel: env(
    "BEDROCK_MODEL_ID",
    "anthropic.claude-3-haiku-20240307-v1:0",
  ),
  /** When set, buyer/card agents hit API Gateway instead of the Next origin. */
  get protocolBaseUrl() {
    return (
      process.env.PROTOCOL_BASE_URL?.trim() ||
      process.env.NEXT_PUBLIC_PROTOCOL_BASE_URL?.trim() ||
      undefined
    );
  },
  /**
   * Protocol micro-fee in basis points (app-layer XPoints accrual).
   * Merchant still receives full listed USDT0 via x402.
   */
  protocolFeeBps: Number(env("PROTOCOL_FEE_BPS", "50")),
  /** Optional treasury address for fee narrative / future on-chain splits. */
  treasuryAddress: env(
    "TREASURY_ADDRESS",
    "0x00000000000000000000000000000000000000fe",
  ),
};

export function explorerTx(hash: string) {
  const base = config.explorerBase.replace(/\/$/, "");
  return `${base}/tx/${hash}`;
}

/** Decimal USDT0 amount string for display / locked quotes. */
export function toPaymentAmount(price: string, quantity = 1) {
  const n = Number(price) * quantity;
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`Invalid price: ${price}`);
  }
  return n.toFixed(config.tokenDecimals).replace(/\.?0+$/, "") || n.toFixed(2);
}

/** Integer micro-units for x402 `amount` and order storage. */
export function toAtomic(price: string) {
  const n = Number(price);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`Invalid price: ${price}`);
  }
  return BigInt(Math.round(n * 10 ** config.tokenDecimals)).toString();
}

export function fromAtomic(atomic: string) {
  if (atomic.includes(".")) {
    return Number(atomic).toFixed(2);
  }
  const v = Number(atomic) / 10 ** config.tokenDecimals;
  return v.toFixed(2);
}
