import { config, fromAtomic } from "@/lib/config";

/** Protocol fee in atomic units from gross payment. */
export function computeFeeAtomic(
  grossAtomic: string,
  bps = config.protocolFeeBps,
) {
  const gross = BigInt(grossAtomic);
  const fee = (gross * BigInt(Math.max(0, bps))) / 10000n;
  return fee.toString();
}

/** Points from protocol fee: ~ fee_human * 10_000, min 1. */
export function pointsFromFeeAtomic(feeAtomic: string): number {
  const human = Number(fromAtomic(feeAtomic));
  if (!Number.isFinite(human) || human <= 0) return 1;
  return Math.max(1, Math.round(human * 10_000));
}
