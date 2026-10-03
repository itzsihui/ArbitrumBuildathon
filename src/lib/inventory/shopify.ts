import { convertUsdToSgd, fetchUsdToSgdRate } from "@/lib/inventory/fx";
import {
  classifyFashionSubcategory,
  type FashionAxis,
} from "@/lib/inventory/fashion";
import type { MerchantDraft, MerchantDraftLine } from "@/lib/inventory/parse";
import { config } from "@/lib/config";

const PRODUCT_LIMIT = 25;
const MAX_REDIRECTS = 5;
const FETCH_TIMEOUT_MS = 12_000;

type ShopifyVariant = {
  price?: string;
  available?: boolean;
  title?: string;
  option1?: string | null;
  option2?: string | null;
  option3?: string | null;
};

type ShopifyProduct = {
  title?: string;
  body_html?: string | null;
  product_type?: string | null;
  variants?: ShopifyVariant[];
};

type ShopifyProductsResponse = {
  products?: ShopifyProduct[];
};

export type ShopifyImportResult =
  | {
      ok: true;
      draft: MerchantDraft;
      productCount: number;
      rate: number;
      rateSource: "frankfurter" | "env";
      storeHost: string;
    }
  | { ok: false; reason: string };

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function isPrivateHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (
    host === "localhost" ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host === "[::1]" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    return true;
  }
  // IPv4 literals
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (ipv4) {
    const parts = ipv4.slice(1).map(Number);
    if (parts.some((n) => n > 255)) return true;
    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  }
  // IPv6 literals (basic private/link-local)
  if (host.includes(":")) {
    if (
      host.startsWith("fc") ||
      host.startsWith("fd") ||
      host.startsWith("fe80") ||
      host === "::" ||
      host === "::1"
    ) {
      return true;
    }
  }
  return false;
}

export function normalizeStoreUrl(raw: string): URL | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (isPrivateHostname(url.hostname)) return null;
  return url;
}

function assertSafeUrl(url: URL): void {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http(s) URLs are allowed");
  }
  if (isPrivateHostname(url.hostname)) {
    throw new Error("That host is not allowed");
  }
}

async function fetchFollowingRedirects(
  start: URL,
  init?: RequestInit,
): Promise<{ response: Response; finalUrl: URL }> {
  let current = start;
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    assertSafeUrl(current);
    const response = await fetch(current.toString(), {
      ...init,
      redirect: "manual",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        accept: "application/json, text/html;q=0.8,*/*;q=0.5",
        "user-agent": "BorneoStoreImport/1.0",
        ...(init?.headers ?? {}),
      },
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        throw new Error("Redirect without Location header");
      }
      current = new URL(location, current);
      continue;
    }
    return { response, finalUrl: current };
  }
  throw new Error("Too many redirects");
}

function productsJsonUrls(input: URL, resolved: URL): URL[] {
  const urls: URL[] = [];
  const seen = new Set<string>();
  for (const base of [resolved, input]) {
    const u = new URL("/products.json", `${base.origin}/`);
    u.searchParams.set("limit", String(PRODUCT_LIMIT));
    const key = u.toString();
    if (!seen.has(key)) {
      seen.add(key);
      urls.push(u);
    }
  }
  return urls;
}

function pickVariantPrice(product: ShopifyProduct): number | null {
  const variants = product.variants ?? [];
  const available = variants.find(
    (v) => v.available !== false && Number(v.price) > 0,
  );
  const any = variants.find((v) => Number(v.price) > 0);
  const chosen = available ?? any ?? variants[0];
  const n = Number(chosen?.price);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function pickVariant(product: ShopifyProduct): ShopifyVariant | undefined {
  const variants = product.variants ?? [];
  return (
    variants.find((v) => v.available !== false && Number(v.price) > 0) ??
    variants.find((v) => Number(v.price) > 0) ??
    variants[0]
  );
}

const SIZE_LIKE =
  /^(xxs|xs|s|m|l|xl|xxl|xxxl|2xl|3xl|one size|os|osfa|s\/m|m\/l|\d+(\.\d+)?)$/i;

function normalizeDemoSize(raw: string): string {
  const v = raw.trim();
  if (/^one size/i.test(v)) return "OSFA";
  if (SIZE_LIKE.test(v)) return v.toUpperCase();
  return v;
}

/** Map Shopify variant options → fashion attrs when obvious. */
export function variantFashionHints(
  variant?: ShopifyVariant,
): Partial<Record<FashionAxis, string>> {
  if (!variant) return {};
  const opts = [variant.option1, variant.option2, variant.option3]
    .map((o) => String(o ?? "").trim())
    .filter(Boolean);
  const attrs: Partial<Record<FashionAxis, string>> = {};

  for (const part of opts) {
    if (SIZE_LIKE.test(part) || /^one size/i.test(part)) {
      if (!attrs.size) attrs.size = normalizeDemoSize(part);
      continue;
    }
    if (!attrs.color) {
      attrs.color = part.split("/")[0]?.trim() || part;
      continue;
    }
    if (!attrs.size) attrs.size = normalizeDemoSize(part);
  }

  return attrs;
}

function storeNameFromHost(host: string): string {
  const base = host
    .replace(/^www\./i, "")
    .replace(/\.myshopify\.com$/i, "")
    .split(".")[0]
    .replace(/[-_]+/g, " ")
    .trim();
  if (!base) return "Shopify Store";
  return base.replace(/\b\w/g, (c) => c.toUpperCase());
}

function slugFromHost(host: string): string {
  return (
    host
      .replace(/^www\./i, "")
      .replace(/\.myshopify\.com$/i, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 48) || "shopify-store"
  );
}

export async function importShopifyStore(
  rawUrl: string,
): Promise<ShopifyImportResult> {
  const input = normalizeStoreUrl(rawUrl);
  if (!input) {
    return {
      ok: false,
      reason:
        "That doesn’t look like a valid store URL. Paste a Shopify storefront (e.g. your-store.myshopify.com).",
    };
  }

  let resolved: URL;
  try {
    const probe = await fetchFollowingRedirects(input, { method: "GET" });
    resolved = probe.finalUrl;
    // Drain body so the socket can close; we only needed redirects / Shopify headers.
    void probe.response.arrayBuffer().catch(() => undefined);
  } catch {
    resolved = input;
  }

  const candidates = productsJsonUrls(input, resolved);
  let products: ShopifyProduct[] | null = null;
  let storeHost = resolved.hostname;

  for (const candidate of candidates) {
    try {
      const { response, finalUrl } = await fetchFollowingRedirects(candidate);
      if (!response.ok) continue;
      const data = (await response.json()) as ShopifyProductsResponse;
      if (!Array.isArray(data.products)) continue;
      products = data.products.slice(0, PRODUCT_LIMIT);
      storeHost = finalUrl.hostname;
      break;
    } catch {
      // try next candidate
    }
  }

  if (!products) {
    return {
      ok: false,
      reason:
        "Couldn’t read a Shopify product catalog from that URL. Use a Shopify storefront (*.myshopify.com or custom domain), or import CSV / describe products in chat.",
    };
  }

  if (products.length === 0) {
    return {
      ok: false,
      reason: "That Shopify store returned no products.",
    };
  }

  let rate: number;
  let rateSource: "frankfurter" | "env";
  try {
    const fx = await fetchUsdToSgdRate();
    rate = fx.rate;
    rateSource = fx.source;
  } catch {
    return {
      ok: false,
      reason:
        "Imported products but couldn’t fetch a USD→SGD rate. Set USD_SGD_RATE in env and try again.",
    };
  }

  const lines: MerchantDraftLine[] = [];
  for (const product of products) {
    const title = String(product.title || "").trim();
    if (!title) continue;
    const variant = pickVariant(product);
    const usd = variant ? Number(variant.price) : pickVariantPrice(product);
    const retailSgd = usd !== null && Number.isFinite(usd) ? convertUsdToSgd(usd, rate) : undefined;
    const body = product.body_html ? stripHtml(product.body_html).slice(0, 500) : "";
    const typeHint = String(product.product_type || "").trim();
    const description = [body, typeHint ? `Type: ${typeHint}` : ""]
      .filter(Boolean)
      .join(" — ");
    const variantAttrs = variantFashionHints(variant);
    const fashionSub = classifyFashionSubcategory(title, description);
    lines.push({
      quantity: 100,
      title,
      name: title,
      description:
        description ||
        (retailSgd
          ? `Retail ~${retailSgd} SGD (USD→SGD); demo price ${config.demoUnitPriceXsgd} USDC`
          : undefined),
      price: config.demoUnitPriceXsgd,
      fashion: Object.keys(variantAttrs).length
        ? { subcategory: fashionSub, style: title, attrs: variantAttrs }
        : undefined,
    });
  }

  if (lines.length === 0) {
    return {
      ok: false,
      reason: "No usable product titles in that Shopify catalog.",
    };
  }

  return {
    ok: true,
    draft: {
      name: storeNameFromHost(storeHost),
      slug: slugFromHost(storeHost),
      lines,
    },
    productCount: lines.length,
    rate,
    rateSource,
    storeHost,
  };
}
