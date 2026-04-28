import {
  apiCreateProduct, apiDeleteProduct, apiListProducts, apiUpdateProduct,
  CreateProductBody, UpdateProductBody,
} from "@/api/products";
import { friendlyMutation, orFallback } from "@/api/fallback";
import { IProduct } from "@/types/pos";

export class ProductRepository {
  async listByBranch(branchId: number): Promise<IProduct[]> {
    return orFallback(apiListProducts(branchId).then((r) => r.data), []);
  }
  async create(b: CreateProductBody): Promise<IProduct> { return friendlyMutation(apiCreateProduct(b).then((r) => r.product)); }
  async update(id: number, b: UpdateProductBody): Promise<IProduct> { return friendlyMutation(apiUpdateProduct(id, b).then((r) => r.product)); }
  async remove(id: number): Promise<void> { await friendlyMutation(apiDeleteProduct(id)); }
}

export const productRepository = new ProductRepository();
