import { IProduct } from "@/types/pos";
import { request } from "./client";

export interface CreateProductBody {
  branch_id: number;
  name: string;
  category?: string | null;
  price: number;
  is_active?: boolean;
}

export type UpdateProductBody = Partial<Omit<CreateProductBody, "branch_id">>;

export const apiListProducts = (branchId: number) =>
  request<{ data: IProduct[] }>("/products", { params: { branch_id: branchId } });

export const apiCreateProduct = (body: CreateProductBody) =>
  request<{ product: IProduct }>("/products", { method: "POST", body });

export const apiUpdateProduct = (id: number, body: UpdateProductBody) =>
  request<{ product: IProduct }>(`/products/${id}`, { method: "PUT", body });

export const apiDeleteProduct = (id: number) =>
  request<{ message: string }>(`/products/${id}`, { method: "DELETE" });
