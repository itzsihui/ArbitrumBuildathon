import type {
  CardMandate,
  Order,
  Review,
  StoreRecord,
} from "@/lib/store/types";

export type StoreRepo = {
  listStores(): Promise<StoreRecord[]>;
  getStore(slug: string): Promise<StoreRecord | null>;
  putStore(store: StoreRecord): Promise<StoreRecord>;
  listOrders(slug?: string): Promise<Order[]>;
  getOrder(id: string): Promise<Order | null>;
  putOrder(order: Order): Promise<Order>;
  getMandate(cardOpaqueId: string): Promise<CardMandate | null>;
  putMandate(mandate: CardMandate): Promise<CardMandate>;
  burnMandate(cardOpaqueId: string): Promise<CardMandate | null>;
  listReviews(slug?: string): Promise<Review[]>;
  getReview(id: string): Promise<Review | null>;
  getReviewByOrderId(orderId: string): Promise<Review | null>;
  putReview(review: Review): Promise<Review>;
};
