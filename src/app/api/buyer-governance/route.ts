import {
  EMPTY_POLICY,
  formatPolicySummary,
  parseGovernanceText,
  type GovernancePolicy,
} from "@/lib/buyer-account";

export const runtime = "nodejs";

const SYSTEM = `You parse buyer spend-governance rules from natural language into JSON.
Only set fields you are confident about. Omit or null fields that were not mentioned.
Amounts are unitless demo currency (treat as USDC-equivalent numbers).
Respond ONLY with JSON:
{"summary":"short plain-English restatement","policy":{"maxPerTransaction":number|null,"maxPerDay":number|null,"maxPerWeek":number|null,"maxPurchasesPerHour":number|null,"maxPurchasesPerDay":number|null}}`;

type ParseResult = {
  summary: string;
  policy: Partial<GovernancePolicy>;
  llm: "openai" | "bedrock" | "deterministic";
};

function sanitizePolicy(raw: unknown): Partial<GovernancePolicy> {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const out: Partial<GovernancePolicy> = {};
  const keys: (keyof GovernancePolicy)[] = [
    "maxPerTransaction",
    "maxPerDay",
    "maxPerWeek",
    "maxPurchasesPerHour",
    "maxPurchasesPerDay",
  ];
  for (const k of keys) {
    const v = o[k];
    if (v == null) continue;
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) out[k] = n;
  }
  return out;
}

function parseModelJson(raw: string): ParseResult | null {
  const trimmed = raw.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fence?.[1]?.trim() || trimmed;
  try {
    const data = JSON.parse(body) as {
      summary?: string;
      policy?: unknown;
    };
    const policy = sanitizePolicy(data.policy);
    const bits = formatPolicySummary({ ...EMPTY_POLICY, ...policy }).filter(
      (l) => l !== "No spend limits set",
    );
    const summary =
      (data.summary && String(data.summary).trim()) ||
      (bits.length > 0 ? bits.join("; ") : "Could not extract spend limits");
    return { summary, policy, llm: "openai" };
  } catch {
    return null;
  }
}

async function runOpenAI(text: string): Promise<ParseResult | null> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: text },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;
    const parsed = parseModelJson(content);
    if (!parsed) return null;
    return { ...parsed, llm: "openai" };
  } catch {
    return null;
  }
}

async function runBedrock(text: string): Promise<ParseResult | null> {
  try {
    const { bedrockWanted } = await import("@/lib/bedrock/converse");
    if (!bedrockWanted()) return null;
    const {
      BedrockRuntimeClient,
      ConverseCommand,
    } = await import("@aws-sdk/client-bedrock-runtime");
    const { config } = await import("@/lib/config");
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();
    const client =
      accessKeyId && secretAccessKey
        ? new BedrockRuntimeClient({
            region: config.bedrockRegion,
            credentials: { accessKeyId, secretAccessKey },
          })
        : new BedrockRuntimeClient({ region: config.bedrockRegion });

    const response = await client.send(
      new ConverseCommand({
        modelId: config.bedrockModel,
        system: [{ text: SYSTEM }],
        messages: [{ role: "user", content: [{ text }] }],
        inferenceConfig: { maxTokens: 400, temperature: 0.1 },
      }),
    );
    const content = (response.output?.message?.content || [])
      .map((b) => b.text)
      .filter(Boolean)
      .join("\n")
      .trim();
    if (!content) return null;
    const parsed = parseModelJson(content);
    if (!parsed) return null;
    return { ...parsed, llm: "bedrock" };
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { text?: string };
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) {
      return Response.json(
        { error: "text is required", summary: "", policy: {} },
        { status: 400 },
      );
    }

    const openai = await runOpenAI(text);
    if (openai && Object.keys(openai.policy).length > 0) {
      return Response.json(openai);
    }

    const bedrock = await runBedrock(text);
    if (bedrock && Object.keys(bedrock.policy).length > 0) {
      return Response.json(bedrock);
    }

    const det = parseGovernanceText(text);
    return Response.json({
      summary: det.summary,
      policy: det.policy,
      llm: "deterministic" as const,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Governance parse failed";
    return Response.json(
      { error: message, summary: "", policy: {}, llm: "deterministic" },
      { status: 500 },
    );
  }
}
