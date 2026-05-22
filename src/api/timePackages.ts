import { ITimePackage } from "@/types/sessions";
import { request } from "./client";

export interface CreateTimePackageBody {
  branch_id: number;
  name_en: string;
  name_ru: string;
  name_am: string;
  duration_minutes: number;
  price: number;
  is_active?: boolean;
  // Optional discount group — backend enforces "all four or none" via
  // `required_with` rules, so the form layer should keep the four
  // fields in lock-step (or omit them entirely).
  discount_price?: number | null;
  discount_start_time?: string | null;   // "HH:MM"
  discount_end_time?: string | null;
  discount_days_of_week?: number[] | null;
}

export interface UpdateTimePackageBody {
  name_en?: string;
  name_ru?: string;
  name_am?: string;
  duration_minutes?: number;
  price?: number;
  is_active?: boolean;
  // Discount stays an atomic group on update too. Clearing means
  // sending `discount_price: null` (the backend cascades the other
  // three columns to NULL automatically).
  discount_price?: number | null;
  discount_start_time?: string | null;
  discount_end_time?: string | null;
  discount_days_of_week?: number[] | null;
}

export const apiListPackagesForBranch = (branchId: number) =>
  request<{ data: ITimePackage[] }>("/time-packages", { params: { branch_id: branchId } });

export const apiCreatePackage = (body: CreateTimePackageBody) =>
  request<{ package: ITimePackage }>("/time-packages", { method: "POST", body });

export const apiUpdatePackage = (id: number, body: UpdateTimePackageBody) =>
  request<{ package: ITimePackage }>(`/time-packages/${id}`, { method: "PUT", body });

export const apiDeletePackage = (id: number) =>
  request<{ message: string }>(`/time-packages/${id}`, { method: "DELETE" });
