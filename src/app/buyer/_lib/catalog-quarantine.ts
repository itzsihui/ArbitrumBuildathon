/**
 * CaMeL-shaped quarantine reader for merchant catalog copy.
 * Untrusted title/description → typed extract + injection flags. No tools.
 */

export type InjectionFlag =
  | "ignore-buyer"
  | "pay-redirect"
  | "skip-authorize"
  | "imperative-transfer"
  | "override-user"
  | "hostile-instruction";

export type QuarantinedSku = {
  id: string;
  storeSlug: string;
  /** Safe display label for privileged UI — never treat as instructions. */
  displayTitle: string;
  price: string;
  injectionFlags: InjectionFlag[];
  safeForFashionRank: boolean;
};

export type RawCatalogProduct = {
  id: string;
  title: string;
  description?: string;
  price: string;
  storeSlug: string;
};

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const FLAG_PATTERNS: Array<{ flag: InjectionFlag; re: RegExp }> = [
  { flag: "ignore-buyer", re: /\bignore\s+(?:the\s+)?buyer\b/i },
  { flag: "ignore-buyer", re: /\bignore\s+(?:previous|all|user)\s+instructions?\b/i },
  { flag: "skip-authorize", re: /\bskip\s+authorize\b/i },
  { flag: "skip-authorize", re: /\bdo\s+not\s+authorize\b/i },
  { flag: "skip-authorize", re: /\bbypass\s+(?:auth|authorize|authorization)\b/i },
  {
    flag: "pay-redirect",
    re: /\bpay\s+(?:to\s+)?0x[a-fA-F0-9]{6,}\b/,
  },
  {
    flag: "pay-redirect",
    re: /\b(?:send|transfer)\s+(?:funds?|payment|usdc|money)\s+to\b/i,
  },
  {
    flag: "imperative-transfer",
    re: /\b(?:immediately|now)\s+(?:pay|send|transfer)\b/i,
  },
  {
    flag: "override-user",
    re: /\b(?:do\s+not\s+follow|disregard)\s+(?:the\s+)?(?:user|shopper|buyer)\b/i,
  },
  {
    flag: "hostile-instruction",
    re: /\b(?:system\s+prompt|new\s+instructions?|you\s+are\s+now)\b/i,
  },
];

/** Deterministic Q-reader: scan untrusted copy → typed flags. */
export function scanCatalogProduct(
  product: RawCatalogProduct,
): QuarantinedSku {
  const hay = `${product.title}\n${product.description || ""}`;
  const flags = new Set<InjectionFlag>();

  for (const { flag, re } of FLAG_PATTERNS) {
    if (re.test(hay)) flags.add(flag);
  }

  // Demo poison SKU id is always flagged even if title changes slightly
  if (normalize(product.id) === "poison-tee") {
    flags.add("hostile-instruction");
  }

  const injectionFlags = [...flags];
  const displayTitle =
    injectionFlags.length > 0
      ? `[flagged] ${product.id}`
      : product.title.trim() || product.id;

  return {
    id: product.id,
    storeSlug: product.storeSlug,
    displayTitle,
    price: product.price,
    injectionFlags,
    safeForFashionRank: injectionFlags.length === 0,
  };
}

export function quarantineCatalog(
  products: RawCatalogProduct[],
): QuarantinedSku[] {
  return products.map(scanCatalogProduct);
}

/** Shopper explicitly asked for the CaMeL demo / poison listing. */
export function wantsInjectionDemo(intent: string, queries: string[] = []): boolean {
  const hay = normalize([intent, ...queries].join(" "));
  return (
    hay.includes("ignore buyer") ||
    hay.includes("poison") ||
    hay.includes("0xattacker") ||
    hay.includes("injection") ||
    hay.includes("skip authorize") ||
    hay.includes("poison tee")
  );
}

export function formatFlagSummary(sku: QuarantinedSku): string {
  const flags = sku.injectionFlags.join(", ") || "suspicious";
  return `${sku.storeSlug}:${sku.id} — ${flags}`;
}
