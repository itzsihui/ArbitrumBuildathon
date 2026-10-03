/** Slim fashion snapshot persisted on published SKUs for agent discovery. */
export type SkuAttrs = {
  subcategory?: string;
  color?: string;
  size?: string;
  material?: string;
  /** Extra searchable tokens (fit, style, waistxinseam, …). */
  tags?: string[];
};

export type SkuTokenization = {
  /** e.g. rwa | tokenized-equity | fractional-claim | meme */
  kind: "rwa" | "tokenized-equity" | "fractional-claim" | "meme";
  /** On-chain contract on X Layer (demo or live). */
  contractAddress: string;
  /** Human label for the underlying claim. */
  underlying?: string;
  explorerUrl?: string;
};

/**
 * Merchant-facing quote unit (display). Settlement may still be USDT0
 * (hackathon-safe) or a different ERC-20 via settleAsset (full multi-asset).
 */
export type QuoteCurrency = "USDT0" | "USD" | "OKB" | "WETH" | "ETH" | string;

export type Sku = {
  id: string;
  title: string;
  description: string;
  quantity: number;
  /**
   * Settlement amount in settleSymbol units (usually USDT0 decimals).
   * This is what x402 charges after any DEX route.
   */
  price: string;
  /** Display currency merchants advertise (may differ from settleSymbol). */
  quoteCurrency?: QuoteCurrency;
  /** Optional display price in quoteCurrency (e.g. "0.000012" WETH). */
  quotePrice?: string;
  /**
   * ERC-20 settle asset for x402 (defaults to network USDT0).
   * When different from USDT0, buyer routes liquidity into this asset first.
   */
  settleAsset?: string;
  /** Symbol for settleAsset (defaults to USDT0). */
  settleSymbol?: string;
  /** Structured fashion facets for catalog + search (optional). */
  attrs?: SkuAttrs;
  /** Tokenized / RWA metadata for Build a Market track demos. */
  tokenization?: SkuTokenization;
};

/** Merchant Visa/fiat receiving account stamped onto the store at publish. */
export type StoreVisaReceive = {
  accountLabel: string;
  receiveId?: string;
  settlementNote?: string;
};

export type StoreRecord = {
  slug: string;
  name: string;
  /** Firebase merchant uid that owns this store. */
  ownerUid?: string;
  merchantDisplayName?: string;
  /** Crypto receiving wallet (x402 payTo) — EVM 0x… address on X Layer. */
  merchantAddress: string;
  /** Visa/fiat receiving account snapshot for card rail settlement display. */
  visaReceive?: StoreVisaReceive;
  /**
   * When true (default), SKUs appear on /market and the agent registry.
   * Stamped from merchant governance at publish time.
   */
  listOnMarket?: boolean;
  skus: Sku[];
  createdAt: string;
  /** Bumped on every putStore / inventory merge. */
  updatedAt?: string;
};

export type CardMandate = {
  spendCap: string;
  merchant: string;
  expiresAt: string;
  cardOpaqueId?: string;
  truncatedPan?: string;
  status?: "active" | "burned";
  source?: "straitsx-mcp" | "local-mandate";
  burnedAt?: string;
};

export type Order = {
  id: string;
  slug: string;
  skuId: string;
  quantity: number;
  amountAtomic: string;
  status: "pending" | "paid" | "failed";
  rail: "x402" | "straitsx-card";
  txHash?: string;
  explorerUrl?: string;
  mandate?: CardMandate;
  /** Firebase buyer uid when known at settle. */
  buyerUid?: string;
  createdAt: string;
  paidAt?: string;
  /** Gross atomic amount (same as amountAtomic for x402). */
  grossAtomic?: string;
  /** Protocol fee in atomic units (app-layer ownership accrual). */
  feeAtomic?: string;
  /** Net narrative to merchant (full listed amount for x402). */
  netToMerchantAtomic?: string;
  protocolFeeBps?: number;
  referrerId?: string;
  swapTxHash?: string;
  ownershipPoints?: number;
};

export type ReviewRating = 1 | 2 | 3 | 4 | 5;

/** Verified-purchase product review (one per paid order). */
export type Review = {
  id: string;
  orderId: string;
  slug: string;
  skuId: string;
  rating: ReviewRating;
  tags?: string[];
  /** Untrusted prose — agents should prefer rating + tags. */
  comment?: string;
  buyerUid: string;
  createdAt: string;
};

export type ProtocolEvent = {
  ts: number;
  status: number;
  method: string;
  path: string;
  store?: string;
  orderId?: string;
  message: string;
  rail?: Order["rail"];
};
