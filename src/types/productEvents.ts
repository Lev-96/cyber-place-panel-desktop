import type { Role } from "@/types/api";

/**
 * The product audit trail (2026-11-09) — mirrors the backend's
 * `App\Enums\ProductAction`. One row per changed field; a repeat that changes
 * nothing writes no row. Adding a case is a one-file edit here.
 */
export const PRODUCT_ACTIONS = [
  "created",
  "renamed",
  "category_changed",
  "price_set",
  "price_changed",
  "kind_changed",
  // An additional item moved between a fixed price and a rate (2026-11-17).
  "pricing_mode_changed",
  "activated",
  "deactivated",
  "deleted",
  "translation_changed",
  // Stock (2026-11-16): what staff did to a product's count.
  "stock_received",
  "stock_corrected",
  "stock_untracked",
] as const;

export type ProductAction = (typeof PRODUCT_ACTIONS)[number];

/** The dictionary key that names each action. */
export const PRODUCT_ACTION_KEY = {
  created: "productHistory.action.created",
  renamed: "productHistory.action.renamed",
  category_changed: "productHistory.action.category_changed",
  price_set: "productHistory.action.price_set",
  price_changed: "productHistory.action.price_changed",
  kind_changed: "productHistory.action.kind_changed",
  pricing_mode_changed: "productHistory.action.pricing_mode_changed",
  activated: "productHistory.action.activated",
  deactivated: "productHistory.action.deactivated",
  deleted: "productHistory.action.deleted",
  translation_changed: "productHistory.action.translation_changed",
  stock_received: "productHistory.action.stock_received",
  stock_corrected: "productHistory.action.stock_corrected",
  stock_untracked: "productHistory.action.stock_untracked",
} as const satisfies Record<ProductAction, string>;

/** The price actions carry `old_price` / `new_price`; the rest carry `before` / `after`. */
export const isPriceAction = (a: ProductAction): boolean => a === "price_set" || a === "price_changed";

/** The stock actions carry `old_stock` / `new_stock` / `stock_delta` (null stock = not counted). */
export const isStockAction = (a: ProductAction): boolean =>
  a === "stock_received" || a === "stock_corrected" || a === "stock_untracked";

/** A field snapshot as the server stored it (json column) — `{ name: "Tea" }`, `{ category: null }`. */
export type ProductEventValues = Record<string, string | number | boolean | null>;

/** Who did it, snapshotted at write time (the account may be gone since). */
export interface IProductEventActor {
  id: number | null;
  name: string;
  role: Role | null;
}

/** One row of `GET /product-events`. Money is the server's decimal string ("300.00"). */
export interface IProductEvent {
  id: number;
  action: ProductAction;
  /** Null once the product itself was deleted (nullOnDelete); the name stays. */
  product_id: number | null;
  product_name: string;
  branch_id: number;
  branch_name: string | null;
  actor: IProductEventActor;
  before: ProductEventValues | null;
  after: ProductEventValues | null;
  old_price: string | null;
  new_price: string | null;
  /** Stock actions only (absent on every other line): the count before / after, and the change. */
  old_stock?: number | null;
  new_stock?: number | null;
  stock_delta?: number | null;
  created_at: string;
}

/** An employee who appears in the trail — the history's employee filter. */
export interface IProductEventActorOption {
  id: number;
  name: string;
  role: Role | null;
}

/** Server filters; every one narrows the same request. Dates are "Y-m-d", venue-local. */
export interface ProductEventFilters {
  branch_id?: number;
  product_id?: number;
  user_id?: number;
  action?: ProductAction;
  from?: string;
  to?: string;
  page?: number;
  per_page?: number;
}
