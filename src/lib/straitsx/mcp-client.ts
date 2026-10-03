import { emit } from "@/lib/protocol/events";

type JsonRpcId = number;
type JsonRpcMessage = {
  jsonrpc: "2.0";
  id?: JsonRpcId;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { code: number; message: string };
};

function originOf(mcpSseUrl: string) {
  const u = new URL(mcpSseUrl);
  return `${u.protocol}//${u.host}`;
}

/**
 * Minimal MCP-over-SSE client for StraitsX Card MCP.
 * GET /sandbox/sse → endpoint event → POST /sandbox/messages?sessionId=…
 */
export async function callCardMcpTool<T = unknown>(args: {
  mcpSseUrl: string;
  toolName: string;
  toolArgs: Record<string, unknown>;
  timeoutMs?: number;
}): Promise<T> {
  const timeoutMs = args.timeoutMs ?? 20_000;
  const origin = originOf(args.mcpSseUrl);
  const replies = new Map<JsonRpcId, JsonRpcMessage>();
  let messageUrl: string | null = null;
  let nextId = 1;
  let settle!: () => void;
  let fail!: (error: Error) => void;
  const ready = new Promise<void>((resolve, reject) => {
    settle = resolve;
    fail = reject;
  });

  const ac = new AbortController();
  const timer = setTimeout(() => {
    ac.abort();
    fail(new Error("Card MCP session timed out"));
  }, timeoutMs);

  const sse = fetch(args.mcpSseUrl, {
    headers: { accept: "text/event-stream" },
    signal: ac.signal,
  })
    .then(async (res) => {
      if (!res.ok || !res.body) {
        throw new Error(`Card MCP SSE HTTP ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let eventType = "message";
      let dataLines: string[] = [];

      const flush = () => {
        const data = dataLines.join("\n");
        dataLines = [];
        if (!data) return;
        if (eventType === "endpoint") {
          messageUrl = data.startsWith("http") ? data : `${origin}${data}`;
          settle();
          return;
        }
        if (eventType === "message") {
          try {
            const msg = JSON.parse(data) as JsonRpcMessage;
            if (typeof msg.id === "number") replies.set(msg.id, msg);
          } catch {
            /* ignore non-json */
          }
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n");
        buffer = parts.pop() ?? "";
        for (const line of parts) {
          if (line.startsWith("event:")) {
            eventType = line.slice(6).trim();
          } else if (line.startsWith("data:")) {
            dataLines.push(line.slice(5).trimStart());
          } else if (line === "") {
            flush();
            eventType = "message";
          }
        }
      }
    })
    .catch((error: unknown) => {
      if (!ac.signal.aborted) {
        fail(error instanceof Error ? error : new Error(String(error)));
      }
    });

  try {
    await ready;
    if (!messageUrl) throw new Error("Card MCP did not publish a message endpoint");

    const post = async (body: JsonRpcMessage) => {
      const res = await fetch(messageUrl!, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
        },
        body: JSON.stringify(body),
        signal: ac.signal,
      });
      if (!res.ok && res.status !== 202) {
        throw new Error(`Card MCP POST ${res.status}`);
      }
    };

    const waitFor = async (id: JsonRpcId) => {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        const msg = replies.get(id);
        if (msg) return msg;
        await new Promise((r) => setTimeout(r, 50));
      }
      throw new Error(`Card MCP no reply for id ${id}`);
    };

    const initId = nextId++;
    await post({
      jsonrpc: "2.0",
      id: initId,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "borneo", version: "0.1.0" },
      },
    });
    await waitFor(initId);
    await post({ jsonrpc: "2.0", method: "notifications/initialized" });

    const callId = nextId++;
    emit({
      status: 200,
      method: "POST",
      path: "straitsx-mcp",
      rail: "straitsx-card",
      message: `tools/call ${args.toolName}`,
    });
    await post({
      jsonrpc: "2.0",
      id: callId,
      method: "tools/call",
      params: { name: args.toolName, arguments: args.toolArgs },
    });
    const reply = await waitFor(callId);
    if (reply.error) {
      throw new Error(reply.error.message);
    }
    const result = reply.result as {
      isError?: boolean;
      content?: Array<{ type: string; text?: string }>;
    };
    if (result?.isError) {
      throw new Error(result.content?.[0]?.text || "Card MCP tool error");
    }
    const text = result?.content?.find((c) => c.type === "text")?.text;
    if (!text) throw new Error("Card MCP empty tool result");
    try {
      return JSON.parse(text) as T;
    } catch {
      return text as T;
    }
  } finally {
    clearTimeout(timer);
    ac.abort();
    await sse.catch(() => undefined);
  }
}
