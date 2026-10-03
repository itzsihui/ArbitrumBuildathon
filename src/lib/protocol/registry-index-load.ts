import { getServerFirestore } from "@/lib/firebase/server";
import {
  buildRegistryIndexEntry,
  type RegistryIndexEntry,
  type RegistryIndexPage,
} from "@/lib/protocol/registry-index";
import {
  listRegistryIndexForSearch,
  listRegistryIndexPage,
  rebuildRegistryIndexFromStores,
} from "@/lib/store/firestore-registry-index";
import { repo } from "@/lib/store/repo";
import { sampleMarketStores } from "@/lib/market/sample-stores";

/** Paginated fashion registry index. Falls back to synthesizing from stores. */
export async function loadRegistryIndexPage(args?: {
  limit?: number;
  cursor?: string | null;
}): Promise<RegistryIndexPage> {
  const db = getServerFirestore();
  if (db) {
    try {
      const page = await listRegistryIndexPage(db, args);
      if (page.entries.length > 0 || args?.cursor) return page;
      const stores = (await repo.listStores()).filter(
        (s) => s.listOnMarket !== false,
      );
      if (stores.length > 0) {
        await rebuildRegistryIndexFromStores(db, stores);
        return listRegistryIndexPage(db, args);
      }
      return page;
    } catch (err) {
      console.warn("[registry-index] list page failed", err);
    }
  }

  const stores = (await repo.listStores()).filter(
    (s) => s.listOnMarket !== false,
  );
  const all = stores
    .map((s) => buildRegistryIndexEntry(s))
    .sort((a, b) => a.slug.localeCompare(b.slug));
  const pageSize = Math.min(Math.max(args?.limit ?? 50, 1), 100);
  const cursor = args?.cursor?.trim() || null;
  const start = cursor ? all.findIndex((e) => e.slug > cursor) : 0;
  const from = start < 0 ? all.length : start;
  const entries = all.slice(from, from + pageSize);
  return {
    entries,
    nextCursor:
      entries.length === pageSize ? entries[entries.length - 1]!.slug : null,
    totalHint: all.length,
  };
}

/**
 * Sample demo stores ship in code, not Firestore. Keep them searchable even
 * when a durable registry_index already exists without them.
 */
function withSampleEntries(entries: RegistryIndexEntry[]): RegistryIndexEntry[] {
  const have = new Set(entries.map((e) => e.slug));
  const extra = sampleMarketStores()
    .filter((s) => !have.has(s.slug))
    .map((s) => buildRegistryIndexEntry({ ...s, listOnMarket: true }));
  return extra.length ? [...entries, ...extra] : entries;
}

export async function loadRegistryIndexForSearch(
  max = 1000,
): Promise<RegistryIndexEntry[]> {
  const db = getServerFirestore();
  if (db) {
    try {
      const entries = await listRegistryIndexForSearch(db, max);
      if (entries.length > 0) return withSampleEntries(entries);
      const stores = (await repo.listStores()).filter(
        (s) => s.listOnMarket !== false,
      );
      if (stores.length > 0) {
        await rebuildRegistryIndexFromStores(db, stores);
        return withSampleEntries(await listRegistryIndexForSearch(db, max));
      }
      return withSampleEntries(entries);
    } catch (err) {
      console.warn("[registry-index] search load failed", err);
    }
  }
  return (await repo.listStores())
    .filter((s) => s.listOnMarket !== false)
    .map((s) => buildRegistryIndexEntry(s));
}
