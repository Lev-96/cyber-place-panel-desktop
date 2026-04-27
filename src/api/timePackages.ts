import { ITimePackage } from "@/types/sessions";
import { request } from "./client";

export interface CreateTimePackageBody {
  branch_id: number;
  name: string;
  duration_minutes: number;
  price: number;
  is_active?: boolean;
}

export interface UpdateTimePackageBody {
  name?: string;
  duration_minutes?: number;
  price?: number;
  is_active?: boolean;
}

export const apiListPackagesForBranch = (branchId: number) =>
  request<{ data: ITimePackage[] }>("/time-packages", { params: { branch_id: branchId } });

export const apiCreatePackage = (body: CreateTimePackageBody) =>
  request<{ package: ITimePackage }>("/time-packages", { method: "POST", body });

export const apiUpdatePackage = (id: number, body: UpdateTimePackageBody) =>
  request<{ package: ITimePackage }>(`/time-packages/${id}`, { method: "PUT", body });

export const apiDeletePackage = (id: number) =>
  request<{ message: string }>(`/time-packages/${id}`, { method: "DELETE" });
