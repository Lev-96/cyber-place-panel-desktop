import {
  apiCreateProduct, apiDeleteProduct, apiListProducts, apiProductStock, apiUpdateProduct,
  CreateProductBody, ICreateProductAnswer, StockActionBody, UpdateProductBody,
} from "@/api/products";
import { friendlyMutation, orFallback } from "@/api/fallback";
import { withToast } from "@/ui/notify";
import { IProduct, IProductStockMeta, IStockChange, ProductKind } from "@/types/pos";

/** The toast speaks of what it is: a product, or an additional item (chips, a cue). */
const entityOf = (kind?: ProductKind): string => (kind === "additional" ? "additionalItem" : "product");

export class ProductRepository {
  async listByBranch(branchId: number): Promise<IProduct[]> {
    return orFallback(apiListProducts(branchId).then((r) => r.data), []);
  }
  /**
   * The catalogue with the server's stock total (2026-11-16). `stock` is null
   * from a backend that does not count yet: the screen then shows no total.
   */
  async listWithStock(branchId: number): Promise<{ products: IProduct[]; stock: IProductStockMeta | null }> {
    return orFallback(
      apiListProducts(branchId).then((r) => ({ products: r.data, stock: r.meta?.stock ?? null })),
      { products: [], stock: null },
    );
  }
  async create(b: CreateProductBody): Promise<IProduct> { return withToast(entityOf(b.kind), "created", () => friendlyMutation(apiCreateProduct(b).then((r) => r.product))); }
  /**
   * A create WITH a quantity (2026-11-16): the whole answer, because it may be
   * a merge into the product of that name, and a 409 is a question the form
   * answers. No generic toast here: the form says what happened.
   */
  async createCounted(b: CreateProductBody & { stock: number }): Promise<ICreateProductAnswer> {
    return friendlyMutation(apiCreateProduct(b));
  }
  /** `kind` names what is being edited, for its toast; the body's own `kind` wins when sent. */
  async update(id: number, b: UpdateProductBody, kind?: ProductKind): Promise<IProduct> { return withToast(entityOf(b.kind ?? kind), "updated", () => friendlyMutation(apiUpdateProduct(id, b).then((r) => r.product))); }
  async remove(id: number, kind?: ProductKind): Promise<void> { await withToast(entityOf(kind), "deleted", () => friendlyMutation(apiDeleteProduct(id))); }
  /** Goods received, a recount, or counting switched off. The dialog says the outcome itself. */
  async stock(id: number, body: StockActionBody): Promise<{ product: IProduct; change: IStockChange }> {
    return friendlyMutation(apiProductStock(id, body).then((r) => ({ product: r.product, change: r.stock_change })));
  }
}

export const productRepository = new ProductRepository();
