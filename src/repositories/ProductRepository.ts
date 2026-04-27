import {
  apiCreateProduct,
  apiDeleteProduct,
  apiListProducts,
  apiUpdateProduct,
  CreateProductBody,
  UpdateProductBody,
} from "@/api/products";
import { IProduct } from "@/types/pos";

export class ProductRepository {
  async listByBranch(branchId: number): Promise<IProduct[]> {
    return (await apiListProducts(branchId)).data;
  }
  async create(b: CreateProductBody): Promise<IProduct> { return (await apiCreateProduct(b)).product; }
  async update(id: number, b: UpdateProductBody): Promise<IProduct> { return (await apiUpdateProduct(id, b)).product; }
  async remove(id: number): Promise<void> { await apiDeleteProduct(id); }
}

export const productRepository = new ProductRepository();
