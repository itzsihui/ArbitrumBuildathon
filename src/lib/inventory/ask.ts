import { config } from "@/lib/config";

export type InventoryAskRow = {
  title: string;
  quantity: number;
  price: string;
  subcategory?: string;
  color?: string;
  size?: string;
};

function parsePrice(raw: string): number | null {
  const n = Number(String(raw).replace(/[^\d.]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function formatLine(r: InventoryAskRow): string {
  const qty = Number(r.quantity) || 0;
  const title = (r.title || "Untitled").trim() || "Untitled";
  const price = parsePrice(r.price);
  if (price == null) return `${qty}× ${title} (price pending)`;
  return `${qty}× ${title} @ ${price.toFixed(2)} ${config.tokenSymbol}`;
}

function sheetStats(rows: InventoryAskRow[]) {
  const totalUnits = rows.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);
  let pricedValue = 0;
  let pricedSkus = 0;
  const incomplete: InventoryAskRow[] = [];

  for (const r of rows) {
    const price = parsePrice(r.price);
    const qty = Number(r.quantity) || 0;
    const titleOk = Boolean(r.title?.trim());
    if (!titleOk || !(qty > 0) || price == null) incomplete.push(r);
    if (price != null) {
      pricedSkus += 1;
      pricedValue += price * qty;
    }
  }

  return { totalUnits, pricedValue, pricedSkus, incomplete };
}

/** Template answers when OpenAI is unavailable — never fake 0.00 as list value. */
export function deterministicInventoryAnswer(
  question: string,
  rows: InventoryAskRow[],
): string {
  const q = question.toLowerCase();
  const { totalUnits, pricedValue, pricedSkus, incomplete } = sheetStats(rows);
  const preview = rows.slice(0, 6).map(formatLine).join("; ");
  const more = rows.length > 6 ? "…" : "";

  if (/how many|count|total\s*sku|sku\s*count|units?\s*(on hand|left|total)/.test(q)) {
    return `You have ${rows.length} SKU${rows.length === 1 ? "" : "s"} and ${totalUnits} units on hand.`;
  }

  if (/value|worth|total\s*(usdc|price)|revenue|list\s*value/.test(q)) {
    if (pricedSkus === 0) {
      return `No prices set yet — can't compute list value. Fill USDC on each row (${rows.length} SKU${rows.length === 1 ? "" : "s"}, ${totalUnits} units).`;
    }
    if (incomplete.length) {
      return `Priced list value: ${pricedValue.toFixed(2)} ${config.tokenSymbol} across ${pricedSkus}/${rows.length} SKUs (${totalUnits} units). ${incomplete.length} row(s) still need a price.`;
    }
    return `Catalog list value: ${pricedValue.toFixed(2)} ${config.tokenSymbol} (${rows.length} SKUs, ${totalUnits} units).`;
  }

  if (/missing|incomplete|empty|need|pending|unpriced/.test(q)) {
    if (!incomplete.length) {
      return `Every row has a title, qty, and ${config.tokenSymbol} price. Ready to publish.`;
    }
    const sample = incomplete
      .slice(0, 4)
      .map((r) => (r.title?.trim() || "Untitled"))
      .join(", ");
    return `${incomplete.length} row(s) still need title, qty, or price — e.g. ${sample}.`;
  }

  const colorMatch = q.match(
    /\b(navy|black|white|gray|grey|beige|indigo|red|green|blue|brown|ivory|natural)\b/,
  );
  if (colorMatch) {
    const color = colorMatch[1]!.replace("grey", "gray");
    const hits = rows.filter((r) =>
      `${r.title} ${r.color || ""}`.toLowerCase().includes(color),
    );
    if (!hits.length) return `No SKUs match “${color}”.`;
    const units = hits.reduce((s, r) => s + (Number(r.quantity) || 0), 0);
    return `${hits.length} SKU(s) match “${color}” (${units} units): ${hits
      .slice(0, 5)
      .map(formatLine)
      .join("; ")}${hits.length > 5 ? "…" : ""}`;
  }

  const titleHits = rows.filter((r) =>
    r.title
      .toLowerCase()
      .split(/\s+/)
      .some((w) => w.length > 3 && q.includes(w)),
  );
  if (titleHits.length && titleHits.length < rows.length) {
    return `Matched ${titleHits.length} SKU(s): ${titleHits
      .slice(0, 6)
      .map(formatLine)
      .join("; ")}`;
  }

  if (incomplete.length === rows.length) {
    return `${rows.length} SKU(s), ${totalUnits} units — prices still pending. ${preview}${more}`;
  }
  if (incomplete.length) {
    return `${rows.length} SKU(s), ${totalUnits} units. Priced value ${pricedValue.toFixed(2)} ${config.tokenSymbol} (${pricedSkus} priced); ${incomplete.length} still need a price. ${preview}${more}`;
  }
  return `${rows.length} SKU(s), ${totalUnits} units, ${pricedValue.toFixed(2)} ${config.tokenSymbol} list value. ${preview}${more}`;
}

function sheetContext(rows: InventoryAskRow[]) {
  const { totalUnits, pricedValue, pricedSkus, incomplete } = sheetStats(rows);
  return {
    currency: config.tokenSymbol,
    skuCount: rows.length,
    totalUnits,
    pricedSkuCount: pricedSkus,
    pricedListValue: Number(pricedValue.toFixed(2)),
    incompleteCount: incomplete.length,
    rows: rows.map((r, i) => ({
      index: i + 1,
      title: r.title || "Untitled",
      quantity: Number(r.quantity) || 0,
      price: parsePrice(r.price),
      pricePending: parsePrice(r.price) == null,
      subcategory: r.subcategory || null,
      color: r.color || null,
      size: r.size || null,
    })),
  };
}

async function runOpenAIInventoryAsk(
  question: string,
  rows: InventoryAskRow[],
): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;

  const system = `You are Borneo's inventory assistant for a merchant fashion sheet.
Answer ONLY from the JSON sheet context. Be concise (1–4 short sentences).
Never invent SKUs, quantities, or prices.
If price is null / pricePending, say "price pending" — never invent 0.00 or treat missing prices as zero list value.
Currency is ${config.tokenSymbol}. Help with counts, list value of priced rows, incompletes, filters (color/size/style), and restock notes from qty.
Plain text only — no markdown fences or JSON.`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
        temperature: 0.2,
        max_tokens: 320,
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: `Sheet:\n${JSON.stringify(sheetContext(rows))}\n\nQuestion: ${question}`,
          },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data.choices?.[0]?.message?.content?.trim();
    return text || null;
  } catch {
    return null;
  }
}

export async function answerInventoryQuestion(
  question: string,
  rows: InventoryAskRow[],
): Promise<{ reply: string; llm: "openai" | "deterministic" }> {
  const openai = await runOpenAIInventoryAsk(question, rows);
  if (openai) return { reply: openai, llm: "openai" };
  return {
    reply: deterministicInventoryAnswer(question, rows),
    llm: "deterministic",
  };
}
