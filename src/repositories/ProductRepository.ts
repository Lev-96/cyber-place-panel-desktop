import {
  apiCreateProduct, apiDeleteProduct, apiListProducts, apiUpdateProduct,
  CreateProductBody, UpdateProductBody,
} from "@/api/products";
import { friendlyMutation, orFallback } from "@/api/fallback";
import { withToast } from "@/ui/notify";
import { IProduct } from "@/types/pos";

export class ProductRepository {
  async listByBranch(branchId: number): Promise<IProduct[]> {
    return orFallback(apiListProducts(branchId).then((r) => r.data), []);
  }
  async create(b: CreateProductBody): Promise<IProduct> { return withToast("product", "created", () => friendlyMutation(apiCreateProduct(b).then((r) => r.product))); }
  async update(id: number, b: UpdateProductBody): Promise<IProduct> { return withToast("product", "updated", () => friendlyMutation(apiUpdateProduct(id, b).then((r) => r.product))); }
  async remove(id: number): Promise<void> { await withToast("product", "deleted", () => friendlyMutation(apiDeleteProduct(id))); }
}

export const productRepository = new ProductRepository();
