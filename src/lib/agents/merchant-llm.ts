import type { MerchantDraft } from "@/lib/inventory/parse";
import { config } from "@/lib/config";

export type MerchantLlmItem = {
  quantity: number;
  title: string;
  price?: string;
};

export type MerchantLlmResult = {
  intent: "add_inventory" | "advise" | "clarify";
  reply: string;
  items: MerchantLlmItem[];
};

function draftContext(draft: MerchantDraft | null) {
  if (!draft?.lines.length) return { skuCount: 0, lines: [] as unknown[] };
  return {
    skuCount: draft.lines.length,
    currency: config.tokenSymbol,
    lines: draft.lines.map((l, i) => ({
      row: i + 1,
      quantity: l.quantity,
      title: l.title,
      price: l.price ?? null,
      subcategory: l.fashion?.subcategory ?? null,
      color: l.fashion?.attrs?.color ?? null,
      size: l.fashion?.attrs?.size ?? null,
    })),
  };
}

function parseLlmJson(raw: string): MerchantLlmResult | null {
  try {
    const cleaned = raw.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    const data = JSON.parse(cleaned) as Partial<MerchantLlmResult>;
    const intent =
      data.intent === "add_inventory" ||
      data.intent === "advise" ||
      data.intent === "clarify"
        ? data.intent
        : "clarify";
    const reply = String(data.reply || "").trim();
    if (!reply) return null;
    const items: MerchantLlmItem[] = [];
    if (Array.isArray(data.items)) {
      for (const row of data.items) {
        const r = row as Record<string, unknown>;
        const title = String(r.title || "").trim();
        const quantity = Math.floor(Number(r.quantity));
        if (!title || !Number.isFinite(quantity) || quantity <= 0) continue;
        const price =
          r.price != null && String(r.price).trim()
            ? String(r.price).trim()
            : undefined;
        items.push({ quantity, title, price });
      }
    }
    return { intent: items.length ? "add_inventory" : intent, reply, items };
  } catch {
    return null;
  }
}

/**
 * OpenAI merchant turn: add SKUs to the sheet, advise on assortment, or clarify.
 * Falls back to null when OPENAI_API_KEY is missing / request fails.
 */
export async function runMerchantOpenAI(args: {
  message: string;
  draft: MerchantDraft | null;
}): Promise<MerchantLlmResult | null> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;

  const system = `You are Borneo's fashion merchant agent for a chat storefront.
Help the merchant build inventory (apparel, accessories, shoes). Prices are in ${config.tokenSymbol}.

Respond with JSON only:
{
  "intent": "add_inventory" | "advise" | "clarify",
  "reply": "short natural reply (1–4 sentences)",
  "items": [{ "quantity": number, "title": "product name", "price": "optional usdc string" }]
}

Rules:
- If they want to ADD products (caps, tees, jeans, "5 pants", "can I add caps?", etc.), use intent add_inventory and put new SKUs in items. Merge mindset: only NEW lines, not the whole existing sheet.
- If quantity missing, default to 5 and say so in reply.
- Product titles: short fashion nouns (caps, shorts, linen pants) — no full sentences.
- If they ask what else to stock / advice / questions about the sheet, use intent advise, items []. Be concrete for fashion retail.
- If unclear, intent clarify, items [].
- Never claim the store published. Mention confirming sizes/colors and ${config.tokenSymbol} prices in the inventory sheet when adding.
- Plain JSON only — no markdown fences.`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
        temperature: 0.35,
        response_format: { type: "json_object" },
        max_tokens: 500,
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: `Current sheet:\n${JSON.stringify(draftContext(args.draft))}\n\nMerchant message: ${args.message}`,
          },
        ],
      }),
    });
    if (!res.ok) {
      console.error("[merchant-llm] OpenAI HTTP", res.status);
      return null;
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;
    return parseLlmJson(content);
  } catch (err) {
    console.error("[merchant-llm]", err);
    return null;
  }
}
