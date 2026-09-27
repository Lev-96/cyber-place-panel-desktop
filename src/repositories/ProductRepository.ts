import {
  apiCreateProduct, apiDeleteProduct, apiListProducts, apiUpdateProduct,
  CreateProductBody, UpdateProductBody,
} from "@/api/products";
import { friendlyMutation, orFallback } from "@/api/fallback";
import { withToast } from "@/ui/notify";
import { IProduct, ProductKind } from "@/types/pos";

/** The toast speaks of what it is: a product, or an additional item (chips, a cue). */
const entityOf = (kind?: ProductKind): string => (kind === "additional" ? "additionalItem" : "product");

export class ProductRepository {
  async listByBranch(branchId: number): Promise<IProduct[]> {
    return orFallback(apiListProducts(branchId).then((r) => r.data), []);
  }
  async create(b: CreateProductBody): Promise<IProduct> { return withToast(entityOf(b.kind), "created", () => friendlyMutation(apiCreateProduct(b).then((r) => r.product))); }
  /** `kind` names what is being edited, for its toast; the body's own `kind` wins when sent. */
  async update(id: number, b: UpdateProductBody, kind?: ProductKind): Promise<IProduct> { return withToast(entityOf(b.kind ?? kind), "updated", () => friendlyMutation(apiUpdateProduct(id, b).then((r) => r.product))); }
  async remove(id: number, kind?: ProductKind): Promise<void> { await withToast(entityOf(kind), "deleted", () => friendlyMutation(apiDeleteProduct(id))); }
}

export const productRepository = new ProductRepository();
