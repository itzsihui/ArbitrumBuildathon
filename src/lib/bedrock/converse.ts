import {
  BedrockRuntimeClient,
  ConverseCommand,
  type ContentBlock,
  type Message,
  type Tool,
  type ToolResultContentBlock,
} from "@aws-sdk/client-bedrock-runtime";
import { config } from "@/lib/config";

export type ToolHandler = (
  input: Record<string, unknown>,
) => Promise<Record<string, unknown>>;

export function bedrockWanted() {
  const flag = process.env.BEDROCK_ENABLED?.trim().toLowerCase();
  if (flag === "0" || flag === "false" || flag === "off") return false;
  // Default on — always fall back if Converse fails (no creds / no model access).
  return true;
}

function client() {
  const token = process.env.AWS_BEARER_TOKEN_BEDROCK?.trim();
  if (token) {
    return new BedrockRuntimeClient({
      region: config.bedrockRegion,
      authSchemePreference: ["httpBearerAuth"],
      token: async () => ({ token }),
    });
  }

  const accessKeyId =
    process.env.AWS_ACCESS_KEY_ID?.trim() ||
    process.env.BEDROCK_AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey =
    process.env.AWS_SECRET_ACCESS_KEY?.trim() ||
    process.env.BEDROCK_AWS_SECRET_ACCESS_KEY?.trim();

  if (accessKeyId?.includes("/")) {
    return new BedrockRuntimeClient({ region: config.bedrockRegion });
  }

  if (accessKeyId && secretAccessKey) {
    return new BedrockRuntimeClient({
      region: config.bedrockRegion,
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  return new BedrockRuntimeClient({ region: config.bedrockRegion });
}

export async function converseWithTools(args: {
  system: string;
  userMessage: string;
  tools: Tool[];
  handlers: Record<string, ToolHandler>;
  maxRounds?: number;
}): Promise<{
  ok: true;
  text: string;
  toolNames: string[];
  results: Record<string, unknown>[];
} | { ok: false; reason: string }> {
  if (!bedrockWanted()) {
    return { ok: false, reason: "BEDROCK_ENABLED=false" };
  }

  const messages: Message[] = [
    {
      role: "user",
      content: [{ text: args.userMessage }],
    },
  ];
  const toolNames: string[] = [];
  const results: Record<string, unknown>[] = [];
  const maxRounds = args.maxRounds ?? 6;

  try {
    for (let round = 0; round < maxRounds; round++) {
      const response = await client().send(
        new ConverseCommand({
          modelId: config.bedrockModel,
          system: [{ text: args.system }],
          messages,
          toolConfig: {
            tools: args.tools,
          },
          inferenceConfig: {
            maxTokens: 1024,
            temperature: 0,
          },
        }),
      );

      const output = response.output?.message;
      if (!output?.content) {
        return { ok: false, reason: "empty Bedrock output" };
      }

      messages.push({
        role: "assistant",
        content: output.content,
      });

      const toolUses = output.content.filter(
        (block): block is ContentBlock & {
          toolUse: NonNullable<ContentBlock["toolUse"]>;
        } => Boolean(block.toolUse),
      );

      if (toolUses.length === 0) {
        const text = output.content
          .map((b) => b.text)
          .filter(Boolean)
          .join("\n")
          .trim();
        return { ok: true, text, toolNames, results };
      }

      const toolResultContent: ContentBlock[] = [];
      for (const block of toolUses) {
        const name = block.toolUse.name || "unknown";
        const toolUseId = block.toolUse.toolUseId || `tool_${round}`;
        const input = (block.toolUse.input || {}) as Record<string, unknown>;
        toolNames.push(name);
        const handler = args.handlers[name];
        let body: Record<string, unknown>;
        if (!handler) {
          body = { error: `unknown tool ${name}` };
        } else {
          try {
            body = await handler(input);
            results.push({ tool: name, ...body });
          } catch (error) {
            body = {
              error: error instanceof Error ? error.message : "tool failed",
            };
          }
        }
        const resultBlock: ToolResultContentBlock = {
          text: JSON.stringify(body),
        };
        toolResultContent.push({
          toolResult: {
            toolUseId,
            content: [resultBlock],
            status: body.error ? "error" : "success",
          },
        });
      }

      messages.push({
        role: "user",
        content: toolResultContent,
      });
    }
    return { ok: false, reason: "Bedrock tool loop exceeded max rounds" };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "Bedrock Converse failed",
    };
  }
}

export function toolSpec(
  name: string,
  description: string,
  properties: Record<string, unknown>,
  required: string[] = [],
): Tool {
  return {
    toolSpec: {
      name,
      description,
      inputSchema: {
        // Bedrock DocumentType is a wide recursive union; nested tool schemas need a cast.
        json: {
          type: "object",
          properties,
          required,
        } as never,
      },
    },
  };
}
