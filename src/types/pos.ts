import { Translated } from "@/i18n/translated";

/**
 * A bar / POS item.
 *
 * `name` and `category` are auto-translated: staff type them once in their own
 * language and the backend fills every other locale into `i18n`. Render sites
 * must go through `tr(product, "name", lang)` — reading `.name` directly shows
 * every user the author's language.
 */
/**
 * The catalogue category that makes a product POKER CHIPS.
 *
 * Mirrors `App\Models\Pos\Product::CATEGORY_CHIPS`. Chips are billed exactly
 * like every other line on a session — a name, a price and a quantity — and
 * what makes them different is only WHERE they may be sold.
 */
export const CHIPS_CATEGORY = "chips";

/** Is this catalogue entry poker chips? Matched on meaning, not on spelling. */
export const isChipsProduct = (product: { category?: string | null }): boolean =>
  (product.category ?? "").trim().toLowerCase() === CHIPS_CATEGORY;

/**
 * How a product is used (2026-09-27): `regular` is sold by the unit;
 * `additional` is handed out with the seat — chips, a cue, a racket — at most
 * one per session, on any seat. The server enforces it; absent means regular.
 */
export type ProductKind = "regular" | "additional";

export interface IProduct extends Translated {
  id: number;
  branch_id: number;
  name: string;
  /** The product's picture on the public disk (2026-11-25): the club menu in the player's app. Absent from an older server. */
  image_path?: string | null;
  category?: string | null;
  price: number;
  is_active: boolean;
  kind?: ProductKind;
  /**
   * Units on the shelf (2026-11-16) — the server's figure, never worked out
   * here. `null` (or absent, from an older backend) = not counted. May be
   * below zero: a sale is never refused for want of stock.
   */
  stock?: number | null;
  /**
   * How an ADDITIONAL item is priced (2026-11-17), the joysticks' two answers:
   * `fixed` adds its price once, `hourly` («Изменение тарифа») adds it to every
   * hour it is out. `null` / absent (every item before it, an older backend)
   * is fixed. A regular product never carries one.
   */
  pricing_mode?: AdditionalPricingMode | null;
  /**
   * «Быстрая Еда» (2026-11-18): a REGULAR product the club cooks or sells as
   * fast food. Sold exactly like any product; the flag only sorts it into its
   * own tab and into the sales figures. Absent (an older backend) = false.
   */
  is_fast_food?: boolean;
  /**
   * Whose fast food it is: a partner's id, or null for the club's own. The
   * owner's business (backend `partners.manage`); never sent by a manager.
   */
  partner_id?: number | null;
}

/** Fast food is a regular product with the flag on. */
export const isFastFoodProduct = (product: { kind?: string | null; is_fast_food?: boolean | null }): boolean =>
  !isAdditionalProduct(product) && product.is_fast_food === true;

export type AdditionalPricingMode = "fixed" | "hourly";

/** Handed out with the seat, once per session (an older backend sends no kind: regular). */
export const isAdditionalProduct = (product: { kind?: string | null }): boolean =>
  product.kind === "additional";

/** An additional item that changes the seat's hourly rate while it is out. */
export const isHourlyAdditional = (product: { kind?: string | null; pricing_mode?: string | null }): boolean =>
  isAdditionalProduct(product) && product.pricing_mode === "hourly";

/** Does this product count its stock? Absent (an older backend) reads as "not counted". */
export const countsStock = (product: { stock?: number | null }): boolean =>
  typeof product.stock === "number";

/**
 * A counted product a sale left below zero (2026-11-16): the sale went
 * through — this only says the count needs a look. `name` is the catalogue
 * name as stored; a screen shows the translated one when it has the product.
 */
export interface IStockWarning {
  product_id: number;
  name: string;
  stock: number;
}

/** `GET /products` → `meta.stock`: what the listed products hold, the server's sums. */
export interface IProductStockMeta {
  units: number;
  tracked: number;
  untracked: number;
  negative: number;
}

/** What one stock action did: the count before and after (null = not counted). */
export interface IStockChange {
  before: number | null;
  after: number | null;
  delta: number;
}

export interface IOrderItem {
  id: number;
  order_id: number;
  product_id?: number | null;
  product_name: string;
  unit_price: number;
  quantity: number;
  line_total: number;
}

export interface IOrderCashier {
  id: number;
  name: string;
  role: string;
}

export interface IOrder {
  id: number;
  branch_id: number;
  cashier_shift_id?: number | null;
  cashier_user_id?: number | null;
  member_id?: number | null;
  subtotal: number;
  total: number;
  /** The session's three (`PAYMENT_METHODS`), plus a member's `deposit` on older rows. */
  /** `split` (2026-11-07): paid in parts, see `payments`. */
  payment_method: "cash" | "card" | "other" | "deposit" | "split";
  /** The parts (2026-11-07); [] for a sale from before them. */
  payments?: { method: "cash" | "card" | "other" | "deposit"; amount: number | string; note?: string | null }[];
  /** What an `other` payment was; null otherwise. */
  payment_method_other?: string | null;
  status: "paid" | "voided";
  created_at: string;
  items?: IOrderItem[];
  cashier?: IOrderCashier | null;
  /** Cash handed over and the change given back (2026-10-25); null when not typed. */
  cash_received?: number | string | null;
  change?: number | null;
}

export interface CartLine {
  product: IProduct;
  quantity: number;
}
