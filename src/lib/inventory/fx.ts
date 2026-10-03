/** USD → SGD (used as XSGD suggestion; 1 SGD ≈ 1 XSGD for this product). */

const FRANKFURTER_URL =
  "https://api.frankfurter.app/latest?from=USD&to=SGD";

function envFallbackRate(): number | null {
  const raw = process.env.USD_SGD_RATE?.trim();
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export async function fetchUsdToSgdRate(): Promise<{
  rate: number;
  source: "frankfurter" | "env";
}> {
  const fallback = envFallbackRate();
  try {
    const res = await fetch(FRANKFURTER_URL, {
      signal: AbortSignal.timeout(8000),
      headers: { accept: "application/json" },
    });
    if (!res.ok) {
      throw new Error(`Frankfurter HTTP ${res.status}`);
    }
    const data = (await res.json()) as { rates?: { SGD?: number } };
    const rate = data.rates?.SGD;
    if (!Number.isFinite(rate) || !rate || rate <= 0) {
      throw new Error("Frankfurter returned no SGD rate");
    }
    return { rate, source: "frankfurter" };
  } catch (error) {
    if (fallback !== null) {
      return { rate: fallback, source: "env" };
    }
    throw error instanceof Error
      ? error
      : new Error("Could not fetch USD→SGD rate");
  }
}

export function convertUsdToSgd(usd: number, rate: number): string {
  if (!Number.isFinite(usd) || usd < 0 || !Number.isFinite(rate) || rate <= 0) {
    return "";
  }
  return (usd * rate).toFixed(2);
}
