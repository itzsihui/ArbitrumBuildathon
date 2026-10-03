import { runSalesperson, type ChatMessage } from "@/app/buyer/_lib/salesperson";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      messages?: ChatMessage[];
    };
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const result = await runSalesperson(messages);
    return Response.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Buyer chat failed";
    return Response.json(
      {
        reply: "Something went wrong — try again in a moment.",
        status: "clarifying",
        suggestions: ["I want a t-shirt", "Looking for a cap"],
        llm: "deterministic",
        error: message,
      },
      { status: 500 },
    );
  }
}
