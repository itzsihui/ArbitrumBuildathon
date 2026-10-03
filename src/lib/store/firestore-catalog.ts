import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  type Firestore,
} from "firebase/firestore";
import type { StoreRecord, StoreVisaReceive } from "@/lib/store/types";

export const STORES_COLLECTION = "stores";

function stripUndefined<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function asEvmAddress(value: unknown): string | null {
  const s = String(value || "").trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(s)) return null;
  return s;
}

function normalizeVisa(raw: unknown): StoreVisaReceive | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const v = raw as Record<string, unknown>;
  const accountLabel = String(v.accountLabel || "").trim();
  if (!accountLabel) return undefined;
  return {
    accountLabel,
    receiveId: v.receiveId ? String(v.receiveId) : undefined,
    settlementNote: v.settlementNote ? String(v.settlementNote) : undefined,
  };
}

/** Normalize a Firestore / JSON blob into a StoreRecord. */
export function normalizeStoreRecord(raw: unknown): StoreRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  const slug = String(data.slug || "").trim();
  const name = String(data.name || "").trim();
  const merchantAddress = asEvmAddress(data.merchantAddress);
  if (!slug || !name || !merchantAddress) return null;
  if (!Array.isArray(data.skus) || data.skus.length === 0) return null;

  const skus = data.skus
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const sku = item as Record<string, unknown>;
      const title = String(sku.title || "").trim();
      const quantity = Number(sku.quantity);
      const priceNum = Number(sku.price);
      if (!title || !Number.isFinite(quantity) || quantity <= 0) return null;
      if (!Number.isFinite(priceNum) || priceNum <= 0) return null;
      let attrs: StoreRecord["skus"][number]["attrs"];
      if (sku.attrs && typeof sku.attrs === "object") {
        const a = sku.attrs as Record<string, unknown>;
        const tags = Array.isArray(a.tags)
          ? a.tags.map((t) => String(t || "").trim()).filter(Boolean)
          : undefined;
        attrs = {
          subcategory: a.subcategory ? String(a.subcategory) : undefined,
          color: a.color ? String(a.color) : undefined,
          size: a.size ? String(a.size) : undefined,
          material: a.material ? String(a.material) : undefined,
          tags: tags?.length ? tags : undefined,
        };
      }
      return {
        id: String(sku.id || `sku-${index + 1}`),
        title,
        description: String(sku.description || title),
        quantity,
        price: priceNum.toFixed(2),
        quoteCurrency: sku.quoteCurrency
          ? String(sku.quoteCurrency).trim()
          : undefined,
        quotePrice: sku.quotePrice ? String(sku.quotePrice).trim() : undefined,
        settleAsset: asEvmAddress(sku.settleAsset) || undefined,
        settleSymbol: sku.settleSymbol
          ? String(sku.settleSymbol).trim()
          : undefined,
        attrs,
        tokenization:
          sku.tokenization && typeof sku.tokenization === "object"
            ? (() => {
                const t = sku.tokenization as Record<string, unknown>;
                const kind = String(t.kind || "").trim();
                const contractAddress = asEvmAddress(t.contractAddress);
                if (
                  !contractAddress ||
                  !["rwa", "tokenized-equity", "fractional-claim", "meme"].includes(
                    kind,
                  )
                ) {
                  return undefined;
                }
                return {
                  kind: kind as
                    | "rwa"
                    | "tokenized-equity"
                    | "fractional-claim"
                    | "meme",
                  contractAddress,
                  underlying: t.underlying
                    ? String(t.underlying)
                    : undefined,
                  explorerUrl: t.explorerUrl
                    ? String(t.explorerUrl)
                    : undefined,
                };
              })()
            : undefined,
      };
    })
    .filter((s): s is NonNullable<typeof s> => Boolean(s));

  if (skus.length === 0) return null;

  return {
    slug,
    name,
    ownerUid: data.ownerUid ? String(data.ownerUid) : undefined,
    merchantDisplayName: data.merchantDisplayName
      ? String(data.merchantDisplayName)
      : undefined,
    merchantAddress,
    visaReceive: normalizeVisa(data.visaReceive),
    listOnMarket: data.listOnMarket !== false,
    skus,
    createdAt: String(data.createdAt || new Date().toISOString()),
    updatedAt: data.updatedAt
      ? String(data.updatedAt)
      : String(data.createdAt || new Date().toISOString()),
  };
}

export async function listCatalogStores(
  db: Firestore,
): Promise<StoreRecord[]> {
  const snap = await getDocs(collection(db, STORES_COLLECTION));
  const stores: StoreRecord[] = [];
  for (const docSnap of snap.docs) {
    const store = normalizeStoreRecord({ slug: docSnap.id, ...docSnap.data() });
    if (store) stores.push(store);
  }
  return stores;
}

export async function getCatalogStore(
  db: Firestore,
  slug: string,
): Promise<StoreRecord | null> {
  const key = slug.trim();
  if (!key) return null;
  const snap = await getDoc(doc(db, STORES_COLLECTION, key));
  if (!snap.exists()) return null;
  return normalizeStoreRecord({ slug: key, ...snap.data() });
}

export async function putCatalogStore(
  db: Firestore,
  store: StoreRecord,
): Promise<StoreRecord> {
  const payload = stripUndefined({
    ...store,
    listOnMarket: store.listOnMarket !== false,
    updatedAt: new Date().toISOString(),
  });
  await setDoc(doc(db, STORES_COLLECTION, store.slug), payload, { merge: true });
  return store;
}
