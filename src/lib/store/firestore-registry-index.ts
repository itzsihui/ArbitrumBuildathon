import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit as fsLimit,
  orderBy,
  query,
  setDoc,
  startAfter,
  type Firestore,
} from "firebase/firestore";
import {
  buildRegistryIndexEntry,
  normalizeRegistryIndexEntry,
  type RegistryIndexEntry,
  type RegistryIndexPage,
} from "@/lib/protocol/registry-index";
import type { StoreRecord } from "@/lib/store/types";

export const REGISTRY_INDEX_COLLECTION = "registry_index";

function stripUndefined<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export async function putRegistryIndexEntry(
  db: Firestore,
  store: StoreRecord,
  reviewAgg?: { ratingAvg: number | null; ratingCount: number },
): Promise<RegistryIndexEntry | null> {
  const entry = buildRegistryIndexEntry(store, reviewAgg);
  if (!entry.listOnMarket) {
    await deleteDoc(doc(db, REGISTRY_INDEX_COLLECTION, store.slug));
    return null;
  }
  await setDoc(
    doc(db, REGISTRY_INDEX_COLLECTION, store.slug),
    stripUndefined(entry),
    { merge: true },
  );
  return entry;
}

export async function deleteRegistryIndexEntry(
  db: Firestore,
  slug: string,
): Promise<void> {
  const key = slug.trim();
  if (!key) return;
  await deleteDoc(doc(db, REGISTRY_INDEX_COLLECTION, key));
}

export async function getRegistryIndexEntry(
  db: Firestore,
  slug: string,
): Promise<RegistryIndexEntry | null> {
  const key = slug.trim();
  if (!key) return null;
  const snap = await getDoc(doc(db, REGISTRY_INDEX_COLLECTION, key));
  if (!snap.exists()) return null;
  return normalizeRegistryIndexEntry({ slug: key, ...snap.data() });
}

/**
 * Paginated registry index (listed stores only — unlist removes the doc).
 * Cursor is the last `slug` from the previous page.
 */
export async function listRegistryIndexPage(
  db: Firestore,
  args?: { limit?: number; cursor?: string | null },
): Promise<RegistryIndexPage> {
  const pageSize = Math.min(Math.max(args?.limit ?? 50, 1), 100);
  const cursor = args?.cursor?.trim() || null;

  let q = query(
    collection(db, REGISTRY_INDEX_COLLECTION),
    orderBy("slug"),
    fsLimit(pageSize),
  );
  if (cursor) {
    q = query(
      collection(db, REGISTRY_INDEX_COLLECTION),
      orderBy("slug"),
      startAfter(cursor),
      fsLimit(pageSize),
    );
  }

  const snap = await getDocs(q);
  const entries: RegistryIndexEntry[] = [];
  for (const docSnap of snap.docs) {
    const entry = normalizeRegistryIndexEntry({
      slug: docSnap.id,
      ...docSnap.data(),
    });
    if (entry && entry.listOnMarket) entries.push(entry);
  }

  const nextCursor =
    entries.length === pageSize ? entries[entries.length - 1]!.slug : null;

  return {
    entries,
    nextCursor,
    totalHint: null,
  };
}

/** Load up to `max` index rows for search shortlist (ordered by slug). */
export async function listRegistryIndexForSearch(
  db: Firestore,
  max = 1000,
): Promise<RegistryIndexEntry[]> {
  const snap = await getDocs(
    query(
      collection(db, REGISTRY_INDEX_COLLECTION),
      orderBy("slug"),
      fsLimit(Math.min(Math.max(max, 1), 1000)),
    ),
  );
  const entries: RegistryIndexEntry[] = [];
  for (const docSnap of snap.docs) {
    const entry = normalizeRegistryIndexEntry({
      slug: docSnap.id,
      ...docSnap.data(),
    });
    if (entry && entry.listOnMarket) entries.push(entry);
  }
  return entries;
}

/** Backfill index docs from full store catalogs. */
export async function rebuildRegistryIndexFromStores(
  db: Firestore,
  stores: StoreRecord[],
): Promise<number> {
  let n = 0;
  for (const store of stores) {
    await putRegistryIndexEntry(db, store);
    n += 1;
  }
  return n;
}
