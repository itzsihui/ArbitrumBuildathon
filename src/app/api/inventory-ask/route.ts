import { answerInventoryQuestion, type InventoryAskRow } from "@/lib/inventory/ask";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      question?: string;
      rows?: InventoryAskRow[];
    };
    const question = String(body.question || "").trim();
    const rows = Array.isArray(body.rows) ? body.rows : [];
    if (!question) {
      return Response.json({ reply: "Ask a question about this inventory." });
    }
    if (!rows.length) {
      return Response.json({
        reply: "The sheet is empty — add products in chat or Add row first.",
      });
    }

    const { reply, llm } = await answerInventoryQuestion(question, rows);
    return Response.json({ reply, llm });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Inventory ask failed";
    return Response.json({ reply: message }, { status: 200 });
  }
}
