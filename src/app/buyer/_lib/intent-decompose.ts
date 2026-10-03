export type DecomposedIntent = {
  category: string;
  itemHints: string[];
  budget?: string;
  compare: boolean;
  constraints: string[];
};

const FASHION_TOKENS =
  /\b(shirt|tee|t-shirt|cap|hat|apparel|wear|fashion|jacket|jeans|dress|bag|tote|pants|trousers|blouse|shorts|outfit|sneakers|shoes)\b/gi;

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Pull product-ish phrases from fashion buyer intents. */
export function extractItemHints(message: string): string[] {
  const cleaned = message.replace(/\/s\/[a-z0-9-]+/gi, " ").replace(/\s+/g, " ");
  const hints = new Set<string>();

  const patterns = [
    /buy\s+(?:an?\s+|the\s+|one\s+|1\s+)?(.+?)(?:\s+from|\s+at|\s+in|\s+on|\s+under|\s+vs|\s+versus|$)/i,
    /(?:want|get|purchase)\s+(?:an?\s+|the\s+|one\s+|1\s+)?(.+?)(?:\s+from|\s+at|\s+in|\s+under|\s+vs|$)/i,
    /compare\s+(.+?)(?:\s+under|$)/i,
  ];

  for (const re of patterns) {
    const match = cleaned.match(re);
    if (!match?.[1]) continue;
    const raw = normalize(match[1])
      .replace(/\b(hackathon|item|product|sku|please|black|white)\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!raw || raw.length < 2) continue;
    if (/^(something|anything|one|it|that|this)$/i.test(raw)) continue;
    // Split "shirt vs cap"
    for (const part of raw.split(/\s+(?:vs|versus|and|,)\s+/i)) {
      const p = part.trim();
      if (p.length >= 2) hints.add(p);
    }
  }

  const fashionHits = cleaned.match(FASHION_TOKENS) ?? [];
  for (const hit of fashionHits) {
    hints.add(normalize(hit));
  }

  return [...hints];
}

export function extractBudget(message: string): string | undefined {
  const match = message.match(
    /\b(?:under|below|max|budget)\s*([\d]+(?:\.\d+)?)\s*(xsgd|usd|sgd|rlusd)?/i,
  );
  if (!match) return undefined;
  const unit = (match[2] || "USDC").toUpperCase();
  return `${match[1]} ${unit}`;
}

export function decomposeIntent(
  message: string,
  opts?: {
    itemHints?: string[];
    occasion?: string;
    style?: string;
  },
): DecomposedIntent {
  const fromMessage = extractItemHints(message);
  // Prefer salesperson profile / searchQueries over weak token extract
  const itemHints =
    opts?.itemHints && opts.itemHints.length > 0
      ? opts.itemHints.map(normalize).filter(Boolean)
      : fromMessage;
  const budget = extractBudget(message);
  const compare = /\b(compare|vs|versus)\b/i.test(message);

  const constraints: string[] = ["Category: apparel / fashion"];
  if (opts?.occasion) {
    constraints.push(`Occasion: ${opts.occasion}`);
    if (
      opts.occasion === "work" ||
      /\b(present|interview|office|meeting|formal|work)\b/i.test(opts.occasion)
    ) {
      constraints.push(
        "Fit filter: prefer polished shirts/pants — exclude crop/tank/palm casual",
      );
    }
  }
  if (opts?.style) {
    constraints.push(`Style: ${opts.style}`);
  }
  if (itemHints.length) {
    constraints.push(`Looking for: ${itemHints.join(", ")}`);
  } else {
    constraints.push("No specific SKU named — will bias to apparel stores");
  }
  if (budget) constraints.push(`Budget: under ${budget}`);
  if (compare) constraints.push("Mode: compare options side-by-side");
  constraints.push("Discovery: /registry.json + store catalogs (no HTML scrape)");

  return {
    category: "fashion",
    itemHints,
    budget,
    compare,
    constraints,
  };
}
