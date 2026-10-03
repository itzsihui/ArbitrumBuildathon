export type ChainNetwork = "eip155:421614" | "eip155:42161";

/** Circle USDC (EIP-3009) on Arbitrum Sepolia. */
export const USDC_ARBITRUM_SEPOLIA = "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d";
/** Circle native USDC on Arbitrum One. */
export const USDC_ARBITRUM_ONE = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
/** Paxos Global Dollar (USDG, EIP-3009) on Arbitrum Sepolia. */
export const USDG_ARBITRUM_SEPOLIA = "0xFFC95faa3d63Cde504a05B567C600B78C0b41892";
/** Paxos Global Dollar (USDG, EIP-3009) on Arbitrum One. */
export const USDG_ARBITRUM_ONE = "0x004B506865409877C9fA29bfb1ebA929984B9bbC";

type ChainPreset = {
  label: string;
  rpcUrl: string;
  explorerBase: string;
  token: string;
  tokenSymbol: string;
  usdg: string;
  /** EIP-712 domain of the settle token — must match the contract's name()/version(). */
  tokenEip712Name: string;
  tokenEip712Version: string;
  nativeSymbol: string;
};

export const CHAIN_PRESETS: Record<ChainNetwork, ChainPreset> = {
  "eip155:421614": {
    label: "Arbitrum Sepolia",
    rpcUrl: "https://sepolia-rollup.arbitrum.io/rpc",
    explorerBase: "https://sepolia.arbiscan.io",
    token: USDC_ARBITRUM_SEPOLIA,
    tokenSymbol: "USDC",
    usdg: USDG_ARBITRUM_SEPOLIA,
    tokenEip712Name: "USD Coin",
    tokenEip712Version: "2",
    nativeSymbol: "ETH",
  },
  "eip155:42161": {
    label: "Arbitrum One",
    rpcUrl: "https://arb1.arbitrum.io/rpc",
    explorerBase: "https://arbiscan.io",
    token: USDC_ARBITRUM_ONE,
    tokenSymbol: "USDC",
    usdg: USDG_ARBITRUM_ONE,
    tokenEip712Name: "USD Coin",
    tokenEip712Version: "2",
    nativeSymbol: "ETH",
  },
};

function env(name: string, fallback: string) {
  return process.env[name] || fallback;
}

function resolveNetwork(): ChainNetwork {
  const raw = (
    process.env.CHAIN_NETWORK ||
    process.env.NEXT_PUBLIC_CHAIN_NETWORK ||
    "eip155:421614"
  ).trim() as ChainNetwork;
  return raw in CHAIN_PRESETS ? raw : "eip155:421614";
}

const network = resolveNetwork();
const preset = CHAIN_PRESETS[network];

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
  rpcUrl: env("RPC_URL", preset.rpcUrl),
  network,
  chainLabel: preset.label,
  nativeSymbol: preset.nativeSymbol,
  /** CAIP-2 chain id number (421614 Arbitrum Sepolia / 42161 Arbitrum One). */
  get chainId() {
    return Number(this.network.split(":")[1]);
  },
  get isTestnet() {
    return this.chainId === 421614;
  },
  tokenAddress: env("TOKEN_ADDRESS", preset.token),
  tokenSymbol: env("TOKEN_SYMBOL", preset.tokenSymbol),
  tokenDecimals: Number(env("TOKEN_DECIMALS", "6")),
  tokenEip712Name: env("TOKEN_EIP712_NAME", preset.tokenEip712Name),
  tokenEip712Version: env("TOKEN_EIP712_VERSION", preset.tokenEip712Version),
  /** Paxos USDG on the active chain (EIP-3009, domain "Global Dollar" / "1"). */
  usdgAddress: env("USDG_ADDRESS", preset.usdg),
  /**
   * Second settle asset for multi-asset SKUs. Defaults to Paxos USDG; set
   * ALT_SETTLE_TOKEN to any other EIP-3009 ERC-20 allowlisted on the checkout.
   */
  altSettleToken: env("ALT_SETTLE_TOKEN", preset.usdg),
  altSettleSymbol: env("ALT_SETTLE_SYMBOL", "USDG"),
  /**
   * BorneoCheckout contract. When set, x402 payments are settled through it
   * (order-bound ReceiveWithAuthorization, on-chain fee split and XPoints).
   * When empty, payments go straight to the merchant via transferWithAuthorization.
   */
  checkoutAddress: env("CHECKOUT_ADDRESS", "").trim(),
  /**
   * Uniswap has no real liquidity on Arbitrum Sepolia. When settling there,
   * show a live quote from Arbitrum One instead. Quote only: swaps are never
   * broadcast from a mainnet preview. Set DEX_MAINNET_PREVIEW=0 to disable.
   */
  get dexMainnetPreview() {
    return this.isTestnet && process.env.DEX_MAINNET_PREVIEW !== "0";
  },
  /**
   * Relayer that submits transferWithAuthorization on Arbitrum (pays gas in
   * ETH). Falls back to the buyer key so a single funded wallet can demo.
   */
  get facilitatorPrivateKey() {
    return (
      normalizePrivateKey(process.env.FACILITATOR_PRIVATE_KEY) ||
      this.buyerPrivateKey
    );
  },
  /** Demo unit price in the settle stablecoin. */
  demoUnitPriceXsgd: "0.01",
  merchantAddress: env(
    "MERCHANT_ADDRESS",
    "0x0000000000000000000000000000000000000001",
  ),
  /** Buyer EVM private key for server-side x402 settle. */
  get buyerPrivateKey() {
    return normalizePrivateKey(process.env.BUYER_PRIVATE_KEY);
  },
  /** @deprecated Alias — prefer buyerPrivateKey. */
  get buyerSeed() {
    return this.buyerPrivateKey;
  },
  explorerBase: env("EXPLORER_BASE", preset.explorerBase),
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
   * Merchant still receives the full listed amount via x402.
   */
  protocolFeeBps: Number(env("PROTOCOL_FEE_BPS", "50")),
  /** Optional treasury address for fee narrative / future on-chain splits. */
  treasuryAddress: env(
    "TREASURY_ADDRESS",
    "0x00000000000000000000000000000000000000fe",
  ),
};

/** EIP-712 domain name/version for an EIP-3009 settle token. */
export function eip712DomainFor(asset: string, symbol: string) {
  const a = asset.toLowerCase();
  if (a === config.tokenAddress.toLowerCase()) {
    return { name: config.tokenEip712Name, version: config.tokenEip712Version };
  }
  if (a === config.usdgAddress.toLowerCase()) {
    return { name: "Global Dollar", version: "1" };
  }
  return { name: symbol, version: "1" };
}

export function explorerAddress(address: string) {
  const base = config.explorerBase.replace(/\/$/, "");
  return `${base}/address/${address}`;
}

export function explorerTx(hash: string) {
  const base = config.explorerBase.replace(/\/$/, "");
  return `${base}/tx/${hash}`;
}

/** Decimal stablecoin amount string for display / locked quotes. */
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
