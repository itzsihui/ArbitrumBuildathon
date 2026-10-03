import { sampleMarketStores } from "@/lib/market/sample-stores";
import type { StoreRepo } from "@/lib/store/types-repo";
import type { CardMandate, Order, Review, StoreRecord } from "@/lib/store/types";

type Db = {
  stores: Map<string, StoreRecord>;
  orders: Map<string, Order>;
  mandates: Map<string, CardMandate>;
  reviews: Map<string, Review>;
  /** orderId → reviewId for O(1) uniqueness checks */
  reviewsByOrder: Map<string, string>;
};

const globalForDb = globalThis as typeof globalThis & { __borneoDbV11?: Db };

function seed(): Db {
  const stores = new Map<string, StoreRecord>();
  const orders = new Map<string, Order>();
  const mandates = new Map<string, CardMandate>();
  const reviews = new Map<string, Review>();
  const reviewsByOrder = new Map<string, string>();
  for (const store of sampleMarketStores()) {
    stores.set(store.slug, store);
  }
  return { stores, orders, mandates, reviews, reviewsByOrder };
}

function db(): Db {
  if (!globalForDb.__borneoDbV11) {
    // Fresh catalog incl. weekend outfit stores (mixed quote + alt settle)
    const seeded = seed();
    const prev = (
      globalThis as typeof globalThis & {
        __borneoDbV10?: Omit<Db, "stores"> & { stores?: Map<string, StoreRecord> };
      }
    ).__borneoDbV10;
    if (prev) {
      globalForDb.__borneoDbV11 = {
        stores: seeded.stores,
        orders: prev.orders,
        mandates: prev.mandates ?? new Map(),
        reviews: prev.reviews ?? new Map(),
        reviewsByOrder: prev.reviewsByOrder ?? new Map(),
      };
    } else {
      globalForDb.__borneoDbV11 = seeded;
    }
  }
  const current = globalForDb.__borneoDbV11;
  if (!current.mandates) current.mandates = new Map();
  if (!current.reviews) current.reviews = new Map();
  if (!current.reviewsByOrder) current.reviewsByOrder = new Map();
  return current;
}

export const memoryRepo: StoreRepo = {
  async listStores() {
    return [...db().stores.values()];
  },
  async getStore(slug) {
    return db().stores.get(slug) ?? null;
  },
  async putStore(store) {
    db().stores.set(store.slug, store);
    return store;
  },
  async listOrders(slug) {
    const all = [...db().orders.values()].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
    return slug ? all.filter((o) => o.slug === slug) : all;
  },
  async getOrder(id) {
    return db().orders.get(id) ?? null;
  },
  async putOrder(order) {
    db().orders.set(order.id, order);
    return order;
  },
  async getMandate(cardOpaqueId) {
    return db().mandates.get(cardOpaqueId) ?? null;
  },
  async putMandate(mandate) {
    if (mandate.cardOpaqueId) {
      db().mandates.set(mandate.cardOpaqueId, mandate);
    }
    return mandate;
  },
  async burnMandate(cardOpaqueId) {
    const existing = db().mandates.get(cardOpaqueId);
    if (!existing) return null;
    const burned: CardMandate = {
      ...existing,
      status: "burned",
      burnedAt: new Date().toISOString(),
    };
    db().mandates.set(cardOpaqueId, burned);
    return burned;
  },
  async listReviews(slug) {
    const all = [...db().reviews.values()].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
    return slug ? all.filter((r) => r.slug === slug) : all;
  },
  async getReview(id) {
    return db().reviews.get(id) ?? null;
  },
  async getReviewByOrderId(orderId) {
    const reviewId = db().reviewsByOrder.get(orderId);
    if (!reviewId) return null;
    return db().reviews.get(reviewId) ?? null;
  },
  async putReview(review) {
    db().reviews.set(review.id, review);
    db().reviewsByOrder.set(review.orderId, review.id);
    return review;
  },
};
