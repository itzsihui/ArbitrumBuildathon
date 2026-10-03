import { config } from "@/lib/config";
import {
  computeFeeAtomic,
  pointsFromFeeAtomic,
} from "@/lib/ownership-math";

export type OwnershipAccrual = {
  id: string;
  at: string;
  orderId?: string;
  points: number;
  feeAtomic: string;
  grossAtomic: string;
  reason: "purchase" | "friend_boost";
  storeSlug?: string;
  fromBuyer?: string;
};

export type OwnershipState = {
  /** Stable invite code for this buyer (shareable). */
  inviteCode: string;
  /** Code of the friend who invited this buyer. */
  referredBy?: string;
  balance: number;
  accruals: OwnershipAccrual[];
};

const OWNERSHIP_KEY = "borneo.buyer.ownership.v1";
const REF_COOKIE = "borneo.ref";

function canUseStorage() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function cryptoRandomId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id_${Date.now()}`;
}

export function makeInviteCode(seed?: string) {
  const base = (seed || cryptoRandomId()).replace(/[^a-zA-Z0-9]/g, "");
  return `BRN-${base.slice(0, 8).toUpperCase()}`;
}

export function emptyOwnership(seed?: string): OwnershipState {
  return {
    inviteCode: makeInviteCode(seed),
    balance: 0,
    accruals: [],
  };
}

export function readOwnership(): OwnershipState {
  if (!canUseStorage()) return emptyOwnership();
  try {
    const raw = localStorage.getItem(OWNERSHIP_KEY);
    if (!raw) {
      const fresh = emptyOwnership();
      localStorage.setItem(OWNERSHIP_KEY, JSON.stringify(fresh));
      return fresh;
    }
    const parsed = JSON.parse(raw) as Partial<OwnershipState>;
    return {
      inviteCode: String(parsed.inviteCode || makeInviteCode()),
      referredBy: parsed.referredBy ? String(parsed.referredBy) : undefined,
      balance: Number(parsed.balance) || 0,
      accruals: Array.isArray(parsed.accruals) ? parsed.accruals : [],
    };
  } catch {
    return emptyOwnership();
  }
}

export function writeOwnership(state: OwnershipState) {
  if (!canUseStorage()) return;
  try {
    localStorage.setItem(OWNERSHIP_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

/** Capture ?ref= from URL into ownership + session. */
export function captureInviteFromUrl() {
  if (typeof window === "undefined") return;
  try {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref")?.trim();
    if (!ref) return;
    const state = readOwnership();
    if (state.referredBy || ref.toUpperCase() === state.inviteCode.toUpperCase()) {
      return;
    }
    writeOwnership({ ...state, referredBy: ref.toUpperCase() });
    sessionStorage.setItem(REF_COOKIE, ref.toUpperCase());
  } catch {
    // ignore
  }
}

export function getActiveReferrerCode(): string | undefined {
  const state = readOwnership();
  if (state.referredBy) return state.referredBy;
  if (typeof sessionStorage === "undefined") return undefined;
  try {
    return sessionStorage.getItem(REF_COOKIE)?.trim() || undefined;
  } catch {
    return undefined;
  }
}

/** Points from protocol fee: ~ fee_human * 10_000, min 1. */
export { computeFeeAtomic, pointsFromFeeAtomic } from "@/lib/ownership-math";

/**
 * Accrue ownership after a purchase. Friend boost: +25% to buyer when referred;
 * referrer side is local-only demo (buyer records a friend_boost stub for themselves
 * when they share — full P2P needs a shared backend; we credit the purchaser).
 */
export function accrueOwnershipFromPurchase(args: {
  orderId?: string;
  grossAtomic: string;
  feeAtomic?: string;
  storeSlug?: string;
  protocolFeeBps?: number;
}): OwnershipState {
  const state = readOwnership();
  const feeAtomic =
    args.feeAtomic ||
    computeFeeAtomic(args.grossAtomic, args.protocolFeeBps ?? config.protocolFeeBps);
  let points = pointsFromFeeAtomic(feeAtomic);
  const referred = Boolean(state.referredBy);
  if (referred) {
    points = Math.max(1, Math.round(points * 1.25));
  }

  const accrual: OwnershipAccrual = {
    id: cryptoRandomId(),
    at: new Date().toISOString(),
    orderId: args.orderId,
    points,
    feeAtomic,
    grossAtomic: args.grossAtomic,
    reason: "purchase",
    storeSlug: args.storeSlug,
  };
  const accruals = [...state.accruals, accrual];
  let balance = state.balance + points;

  if (referred) {
    // Demo: show the friend-loop credit as a separate line on the buyer's ledger
    // (network narrative). Real multi-user referrer credit needs cloud sync.
    const boost: OwnershipAccrual = {
      id: cryptoRandomId(),
      at: new Date().toISOString(),
      orderId: args.orderId,
      points: Math.max(1, Math.round(points * 0.25)),
      feeAtomic,
      grossAtomic: args.grossAtomic,
      reason: "friend_boost",
      storeSlug: args.storeSlug,
      fromBuyer: "you (invited)",
    };
    accruals.push(boost);
    balance += boost.points;
  }

  const next = { ...state, balance, accruals };
  writeOwnership(next);
  return next;
}

export function ownershipInviteUrl(origin?: string) {
  const state = readOwnership();
  const base =
    origin ||
    (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/buyer?ref=${encodeURIComponent(state.inviteCode)}`;
}
