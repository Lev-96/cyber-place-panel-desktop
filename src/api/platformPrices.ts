import { IBranchPlatformPrice } from "@/types/api";
import { request } from "./client";

/**
 * Custom-platform prices. They are CREATED implicitly when the first place on a
 * custom platform is added (never by a manual "+ New" here) and REMOVED when
 * the last place is deleted. The panel only lists them and lets staff edit an
 * existing one's наименование / rate — editing a rate re-points every place +
 * billing device on that platform server-side.
 */
export interface UpdatePlatformPriceBody {
  name_en?: string;
  name_ru?: string;
  name_am?: string;
  price_standard?: number;
  price_vip?: number;
}

export const apiListPlatformPrices = (branchId: number) =>
  request<{ data: IBranchPlatformPrice[] }>("/branch-platform-prices", { params: { branch_id: branchId } });

export const apiUpdatePlatformPrice = (id: number, body: UpdatePlatformPriceBody) =>
  request<{ data: IBranchPlatformPrice }>(`/branch-platform-prices/${id}`, { method: "PUT", body });
