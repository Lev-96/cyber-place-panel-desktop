import { Translated } from "@/i18n/translated";

/**
 * A bar / POS item.
 *
 * `name` and `category` are auto-translated: staff type them once in their own
 * language and the backend fills every other locale into `i18n`. Render sites
 * must go through `tr(product, "name", lang)` — reading `.name` directly shows
 * every user the author's language.
 */
export interface IProduct extends Translated {
  id: number;
  branch_id: number;
  name: string;
  category?: string | null;
  price: number;
  is_active: boolean;
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
  payment_method: "cash" | "card" | "deposit";
  status: "paid" | "voided";
  created_at: string;
  items?: IOrderItem[];
  cashier?: IOrderCashier | null;
}

export interface CartLine {
  product: IProduct;
  quantity: number;
}
