import { sampleMarketStores } from "@/lib/market/sample-stores";
import {
  getCatalogStore,
  listCatalogStores,
  putCatalogStore,
} from "@/lib/store/firestore-catalog";
import { putRegistryIndexEntry } from "@/lib/store/firestore-registry-index";
import { getServerFirestore } from "@/lib/firebase/server";
import type { StoreRepo } from "@/lib/store/types-repo";
import type { StoreRecord } from "@/lib/store/types";

/**
 * Durable catalog on Firestore `stores/{slug}`; orders/mandates/reviews stay
 * on the in-memory fallback (same process). Sample demo shops remain visible
 * unless a published store reuses their slug.
 *
 * Also maintains fashion `registry_index/{slug}` for paginated discovery.
 */
export function createFirestoreStoreRepo(fallback: StoreRepo): StoreRepo {
  async function mergeStoreMaps(
    cloud: StoreRecord[],
    local: StoreRecord[],
  ): Promise<StoreRecord[]> {
    const bySlug = new Map<string, StoreRecord>();
    for (const store of sampleMarketStores()) {
      bySlug.set(store.slug, { ...store, listOnMarket: true });
    }
    for (const store of local) {
      const prev = bySlug.get(store.slug);
      if (!prev || store.ownerUid || prev.ownerUid) {
        bySlug.set(store.slug, store);
      }
    }
    for (const store of cloud) {
      bySlug.set(store.slug, store);
    }
    return [...bySlug.values()];
  }

  return {
    async listStores() {
      const local = await fallback.listStores();
      const db = getServerFirestore();
      if (!db) return local;
      try {
        const cloud = await listCatalogStores(db);
        return mergeStoreMaps(cloud, local);
      } catch (err) {
        console.warn(
          "[firestore-catalog] listStores failed; using memory/samples",
          err,
        );
        return local;
      }
    },

    async getStore(slug) {
      const db = getServerFirestore();
      if (db) {
        try {
          const cloud = await getCatalogStore(db, slug);
          if (cloud) return cloud;
        } catch (err) {
          console.warn(
            `[firestore-catalog] getStore(${slug}) failed`,
            err,
          );
        }
      }
      const local = await fallback.getStore(slug);
      if (local) return local;
      return (
        sampleMarketStores().find((s) => s.slug === slug) ?? null
      );
    },

    async putStore(store) {
      const saved = await fallback.putStore(store);
      const db = getServerFirestore();
      if (db) {
        try {
          await putCatalogStore(db, saved);
          const reviews = await fallback.listReviews(saved.slug);
          let ratingAvg: number | null = null;
          let ratingCount = 0;
          if (reviews.length > 0) {
            ratingCount = reviews.length;
            ratingAvg =
              Math.round(
                (reviews.reduce((s, r) => s + r.rating, 0) / ratingCount) * 10,
              ) / 10;
          }
          await putRegistryIndexEntry(db, saved, { ratingAvg, ratingCount });
        } catch (err) {
          console.warn(
            `[firestore-catalog] putStore(${saved.slug}) failed — client publish will retry`,
            err,
          );
        }
      }
      return saved;
    },

    listOrders: (slug) => fallback.listOrders(slug),
    getOrder: (id) => fallback.getOrder(id),
    putOrder: (order) => fallback.putOrder(order),
    getMandate: (id) => fallback.getMandate(id),
    putMandate: (m) => fallback.putMandate(m),
    burnMandate: (id) => fallback.burnMandate(id),
    listReviews: (slug) => fallback.listReviews(slug),
    getReview: (id) => fallback.getReview(id),
    getReviewByOrderId: (orderId) => fallback.getReviewByOrderId(orderId),
    putReview: (review) => fallback.putReview(review),
  };
}
