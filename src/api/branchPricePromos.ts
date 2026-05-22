import { IBranchPricePromo, PromoPlatform, PromoTier } from "@/types/promos";
import { request } from "./client";

export interface CreatePromoBody {
  branch_id: number;
  platform: PromoPlatform;
  tier: PromoTier;
  discounted_price: number;
  start_time: string;     // "HH:MM" — backend validates date_format:H:i
  end_time: string;
  days_of_week: number[]; // ISO 1..7
  is_active?: boolean;
}

export interface UpdatePromoBody {
  platform?: PromoPlatform;
  tier?: PromoTier;
  discounted_price?: number;
  start_time?: string;
  end_time?: string;
  days_of_week?: number[];
  is_active?: boolean;
}

export const apiListPromosForBranch = (branchId: number) =>
  request<{ data: IBranchPricePromo[] }>("/branch-price-promos", {
    params: { branch_id: branchId },
  });

export const apiCreatePromo = (body: CreatePromoBody) =>
  request<{ promo: IBranchPricePromo }>("/branch-price-promos", {
    method: "POST",
    body,
  });

export const apiUpdatePromo = (id: number, body: UpdatePromoBody) =>
  request<{ promo: IBranchPricePromo }>(`/branch-price-promos/${id}`, {
    method: "PUT",
    body,
  });

export const apiDeletePromo = (id: number) =>
  request<{ message: string }>(`/branch-price-promos/${id}`, {
    method: "DELETE",
  });
