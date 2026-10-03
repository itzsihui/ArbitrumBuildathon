"use client";

import { useEffect, useState } from "react";
import { Terminal } from "@/components/ui/terminal";
import { cn } from "@/lib/utils";

type DiscoveryTab = "llms.txt" | "agent.json" | "catalog.json";

export function DiscoveryPane({
  slug,
  refreshKey,
  className,
}: {
  slug: string | null;
  refreshKey: number;
  className?: string;
}) {
  const [tab, setTab] = useState<DiscoveryTab>("llms.txt");
  const [body, setBody] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      setBody("");
      setError(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const path =
          tab === "llms.txt"
            ? `/s/${slug}/llms.txt`
            : tab === "agent.json"
              ? `/s/${slug}/agent.json`
              : `/s/${slug}/catalog.json`;
        const res = await fetch(path, { cache: "no-store" });
        const text = await res.text();
        if (cancelled) return;
        if (!res.ok) {
          setError(text || `HTTP ${res.status}`);
          setBody("");
        } else {
          setBody(text);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Fetch failed");
          setBody("");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, tab, refreshKey]);

  const tabs: DiscoveryTab[] = ["llms.txt", "agent.json", "catalog.json"];

  if (!slug) {
    return (
      <section
        className={cn(
          "flex min-h-0 flex-col overflow-hidden border border-border bg-background",
          className,
        )}
      >
        <div className="shrink-0 border-b border-border px-4 py-3">
          <p className="font-[family-name:var(--font-syne)] text-sm font-semibold tracking-tight">
            Agent discovery
          </p>
          <p className="mt-0.5 text-xs text-foreground/55">
            Live after publish — buyers read these files, not HTML
          </p>
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-[#0f1419] p-3 [&_.no-visible-scrollbar]:!h-44">
          <Terminal
            username="borneo"
            enableSound={false}
            typingSpeed={28}
            delayBetweenCommands={600}
            initialDelay={300}
            className="max-w-none px-0"
            commands={[
              "curl /s/your-store/llms.txt",
              "curl /s/your-store/agent.json",
              "curl /s/your-store/catalog.json",
            ]}
            outputs={{
              0: [
                "# Your store · agent-readable",
                "> Publish on the left to generate these endpoints.",
              ],
              1: ['{ "name": "…", "skills": ["x402-checkout"] }'],
              2: ['{ "products": [ /* SKUs */ ] }'],
            }}
          />
        </div>
      </section>
    );
  }

  return (
    <section
      className={cn(
        "flex min-h-0 flex-col overflow-hidden border border-border bg-background",
        className,
      )}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div>
          <p className="font-[family-name:var(--font-syne)] text-sm font-semibold tracking-tight">
            Agent discovery
          </p>
          <p className="mt-0.5 font-mono text-[11px] text-foreground/55">
            /s/{slug}
          </p>
        </div>
        <div className="flex gap-1">
          {tabs.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTab(item)}
              className={cn(
                "rounded-full px-2.5 py-1 font-mono text-[11px] transition-colors",
                tab === item
                  ? "bg-foreground text-background"
                  : "text-foreground/55 hover:bg-muted hover:text-foreground",
              )}
            >
              {item}
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto bg-[#0f1419] text-[#c8d0d8]">
        <pre className="whitespace-pre-wrap p-4 font-mono text-[11px] leading-relaxed">
          {loading ? "// Loading…" : error ? `// ${error}` : body}
        </pre>
      </div>
    </section>
  );
}

type TestResult = {
  status: number;
  body: string;
} | null;

export function EndpointLab({
  slug,
  refreshKey,
  className,
}: {
  slug: string | null;
  refreshKey: number;
  className?: string;
}) {
  const [result, setResult] = useState<TestResult>(null);
  const [busy, setBusy] = useState(false);
  const [skuId, setSkuId] = useState<string | null>(null);

  useEffect(() => {
    setResult(null);
    if (!slug) {
      setSkuId(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/s/${slug}/catalog.json`, {
          cache: "no-store",
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          products?: Array<{
            id?: string;
            variants?: Array<{ id?: string }>;
          }>;
        };
        const first =
          data.products?.[0]?.variants?.[0]?.id ||
          data.products?.[0]?.id ||
          null;
        if (!cancelled) setSkuId(first);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, refreshKey]);

  async function testBuy() {
    if (!slug) return;
    setBusy(true);
    try {
      const res = await fetch(`/s/${slug}/buy`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          skuId: skuId || undefined,
          quantity: 1,
        }),
      });
      const text = await res.text();
      setResult({ status: res.status, body: text });
    } catch (err) {
      setResult({
        status: 0,
        body: err instanceof Error ? err.message : "Request failed",
      });
    } finally {
      setBusy(false);
    }
  }

  const base = slug ? `/s/${slug}` : null;
  const endpoints = base
    ? [
        { method: "GET", path: `${base}/llms.txt` },
        { method: "GET", path: `${base}/agent.json` },
        { method: "GET", path: `${base}/catalog.json` },
        { method: "POST", path: `${base}/buy`, testable: true },
        { method: "POST", path: `${base}/checkout` },
      ]
    : [];

  return (
    <section
      className={cn(
        "flex min-h-0 flex-col overflow-hidden border border-border bg-background",
        className,
      )}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div>
          <p className="font-[family-name:var(--font-syne)] text-sm font-semibold tracking-tight">
            x402 endpoints
          </p>
          <p className="mt-0.5 text-xs text-foreground/55">
            {slug
              ? "Expect HTTP 402 Payment Required on /buy"
              : "Waiting for publish…"}
          </p>
        </div>
        <button
          type="button"
          disabled={!slug || busy}
          onClick={testBuy}
          className="inline-flex h-8 items-center rounded-full border border-border px-3 text-xs font-medium transition-colors hover:bg-muted disabled:opacity-40"
        >
          {busy ? "Testing…" : "Test x402"}
        </button>
      </div>
      <div className="grid min-h-0 flex-1 grid-rows-[auto_1fr]">
        <ul className="space-y-1.5 border-b border-border px-4 py-3 font-mono text-[11px]">
          {!slug ? (
            <li className="text-foreground/45">Waiting for publish…</li>
          ) : (
            endpoints.map((ep) => (
              <li key={ep.path} className="flex gap-2 text-foreground/75">
                <span className="w-10 shrink-0 text-foreground/45">
                  {ep.method}
                </span>
                <span>{ep.path}</span>
              </li>
            ))
          )}
        </ul>
        <div className="min-h-0 overflow-y-auto bg-[#0f1419]">
          <pre
            className={cn(
              "whitespace-pre-wrap p-4 font-mono text-[11px] leading-relaxed",
              result?.status === 402 || result?.status === 200
                ? "text-[#7dcea0]"
                : result &&
                    (result.status === 0 || result.status >= 400)
                  ? "text-[#f0a0a0]"
                  : "text-[#c8d0d8]",
            )}
          >
            {!result
              ? "// Press Test x402 — expect HTTP 402 Payment Required\n// (payment challenge JSON, no signature yet)."
              : `// HTTP ${result.status}\n${result.body}`}
          </pre>
        </div>
      </div>
    </section>
  );
}
