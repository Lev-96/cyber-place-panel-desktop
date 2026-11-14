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
  "activated",
  "deactivated",
  "deleted",
  "translation_changed",
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
  activated: "productHistory.action.activated",
  deactivated: "productHistory.action.deactivated",
  deleted: "productHistory.action.deleted",
  translation_changed: "productHistory.action.translation_changed",
} as const satisfies Record<ProductAction, string>;

/** The price actions carry `old_price` / `new_price`; the rest carry `before` / `after`. */
export const isPriceAction = (a: ProductAction): boolean => a === "price_set" || a === "price_changed";

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
