const SESSION_KEY = "borneo.demo.session.v2";

export type SessionStoreRef = {
  slug: string;
  name: string;
  productHint: string;
};

export type OnboardSession = {
  message: string;
  lines: Array<{ role: "merchant" | "borneo"; text: string; llm?: string }>;
  draft: {
    name?: string;
    lines: Array<{ quantity: number; title: string; price?: string }>;
  } | null;
  prices: string[];
  quantities?: string[];
  slug: string | null;
  merchantAddress?: string | null;
  merchantAuth?: {
    address: string;
    publicKey?: string;
    message: string;
    signature: string;
    network?: string;
    chainId?: number;
    authenticatedAt: string;
  } | null;
};

export type BuyerSession = {
  input: string;
  lines: Array<{ role: string; text: string }>;
};

export type BorneoDemoSession = {
  lastStore?: SessionStoreRef;
  onboard?: OnboardSession;
  buyer?: BuyerSession;
};

function canUseSession() {
  return typeof window !== "undefined" && typeof sessionStorage !== "undefined";
}

export function readDemoSession(): BorneoDemoSession {
  if (!canUseSession()) return {};
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as BorneoDemoSession;
  } catch {
    return {};
  }
}

export function writeDemoSession(patch: Partial<BorneoDemoSession>) {
  if (!canUseSession()) return;
  try {
    const next = { ...readDemoSession(), ...patch };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
  } catch {
    // quota / private mode — ignore
  }
}

/** Clears fashion-buyer chat only; leaves merchant onboard / lastStore. */
export function clearBuyerShopSession() {
  if (!canUseSession()) return;
  try {
    const session = readDemoSession();
    const { buyer: _drop, ...rest } = session;
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(rest));
  } catch {
    // ignore
  }
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem("borneo.buyer.chats.v1");
    }
  } catch {
    // ignore
  }
}

/**
 * Clears merchant publish draft / chat from local session so a fresh login
 * always opens with 0 SKUs (cloud draft is cleared separately on sign-in).
 */
export function clearMerchantOnboardSession() {
  if (!canUseSession()) return;
  try {
    const session = readDemoSession();
    const { onboard: _drop, ...rest } = session;
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(rest));
  } catch {
    // ignore
  }
}

/** "iphones" → "iphone", "jeans" → "jeans" */
export function singularProductHint(title: string) {
  const t = title.trim().toLowerCase().replace(/\s+/g, " ");
  if (!t) return "item";
  if (t.endsWith("ies") && t.length > 4) return `${t.slice(0, -3)}y`;
  if (t.endsWith("sses")) return t.slice(0, -2);
  if (t.endsWith("s") && !t.endsWith("ss") && t.length > 3) return t.slice(0, -1);
  return t;
}

export function storeRefFromPublish(store: {
  slug: string;
  name?: string;
  skus?: Array<{ title: string }>;
}): SessionStoreRef {
  const first = store.skus?.[0]?.title || store.name || "item";
  return {
    slug: store.slug,
    name: store.name || store.slug,
    productHint: singularProductHint(first),
  };
}

export function defaultBuyerPrompt(store?: SessionStoreRef | null) {
  if (!store?.slug) {
    return "Agent, buy a tote bag.";
  }
  const product = store.productHint || "item";
  const article = /^[aeiou]/i.test(product) ? "an" : "a";
  return `Agent, go to /s/${store.slug} and buy ${article} ${product}.`;
}

export const DEFAULT_ONBOARD_MESSAGE = "";

export const DEFAULT_ONBOARD_LINES: OnboardSession["lines"] = [
  {
    role: "borneo",
    text: "I'm your merchant agent — tell me what fashion inventory you're stocking, or pick a chip below to import CSV / Shopify / X Layer wallet.",
  },
];

export const DEFAULT_BUYER_LINES: BuyerSession["lines"] = [
  {
    role: "agent",
    text: "Buyer agent ready. I read /llms.txt + /registry.json (and store catalogs) — not HTML. You can name a product without a slug.",
  },
];
