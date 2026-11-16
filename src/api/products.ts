import { IProduct, IProductStockMeta, IStockChange, ProductKind } from "@/types/pos";
import { Lang } from "@/i18n/translations";
import { request } from "./client";

export interface CreateProductBody {
  branch_id: number;
  name: string;
  category?: string | null;
  price: number;
  is_active?: boolean;
  /** Sold by the unit, or handed out with a seat. Omitted: the server keeps/defaults `regular`. */
  kind?: ProductKind;
  /**
   * Language `name` / `category` were typed in. The backend treats that locale
   * as the source of truth and machine-translates the others — it never writes
   * back into it. Older panel builds omit this and the backend falls back to
   * its configured default.
   */
  source_locale?: Lang;
  /**
   * How many are on the shelf (2026-11-16). Sent only when the cashier typed
   * a quantity: then the server matches the name against the catalogue and
   * adds to the product already there (200 `merged`), creates a counted one
   * (201), or asks (409 `product_exists`). Omitted, the create is exactly
   * what it always was.
   */
  stock?: number;
  /** The answer to a 409: add to that product's stock, or add and change its price. */
  on_existing?: StockChoice;
  /** Which product the 409 answer is about (one of its `matches`). */
  existing_id?: number;
  /** One press of «Сохранить»: sent again, the server answers what it did. */
  client_request_id?: string;
}

export type UpdateProductBody = Partial<Omit<CreateProductBody, "branch_id" | "stock" | "on_existing" | "existing_id" | "client_request_id">>;

/** What a cashier may answer a 409 with (the server's `choices`). */
export type StockChoice = "add" | "add_and_reprice";

/** A product the typed name already means (409 `matches`). Price is the catalogue's decimal string. */
export interface IProductMatch {
  id: number;
  name: string;
  i18n?: IProduct["i18n"];
  category: string | null;
  price: string;
  stock: number | null;
  is_active: boolean;
}

/** The 409 body of `POST /products` with a quantity: nothing was written. */
export interface IProductExistsBody {
  message: string;
  code: "product_exists";
  name: string;
  matches: IProductMatch[];
  choices: StockChoice[];
}

/** `POST /products` answer: with a quantity it also says whether it landed on the product of that name. */
export interface ICreateProductAnswer {
  product: IProduct;
  /** Absent on a create without a quantity. */
  merged?: boolean;
  stock_change?: IStockChange;
}

/** `POST /products/{id}/stock`. `add`: goods received; `set`: a recount (or the first count); `untrack`: counting off. */
export type StockActionBody =
  | { action: "add"; qty: number; client_request_id?: string }
  | { action: "set"; stock: number; client_request_id?: string }
  | { action: "untrack"; client_request_id?: string };

export const apiListProducts = (branchId: number) =>
  request<{ data: IProduct[]; meta?: { stock?: IProductStockMeta } }>("/products", { params: { branch_id: branchId } });

export const apiCreateProduct = (body: CreateProductBody) =>
  request<ICreateProductAnswer>("/products", { method: "POST", body });

export const apiUpdateProduct = (id: number, body: UpdateProductBody) =>
  request<{ product: IProduct }>(`/products/${id}`, { method: "PUT", body });

export const apiDeleteProduct = (id: number) =>
  request<{ message: string }>(`/products/${id}`, { method: "DELETE" });

export const apiProductStock = (id: number, body: StockActionBody) =>
  request<{ product: IProduct; stock_change: IStockChange }>(`/products/${id}/stock`, { method: "POST", body });

/** Is this error the server's "that name is already in the catalogue" question? */
export const productExistsBody = (e: unknown): IProductExistsBody | null => {
  const err = e as { status?: number; body?: unknown } | null;
  const body = err?.body as Partial<IProductExistsBody> | undefined;
  return err?.status === 409 && body?.code === "product_exists" && Array.isArray(body.matches)
    ? (body as IProductExistsBody)
    : null;
};
