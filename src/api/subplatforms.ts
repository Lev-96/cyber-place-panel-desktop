import { IBranchSubplatform } from "@/types/api";
import { request } from "./client";

/**
 * Subplatforms — the named, separately-priced sub-categories of a platform.
 *
 * Unlike platform prices, these are created DELIBERATELY by the operator (from
 * the "Other" tab of the place form, or from Branch Prices) rather than
 * appearing as a side effect of adding a place. So this module has the full
 * create/update/delete surface, not just list+update.
 *
 * Listing one platform also materialises its Default row server-side — that is
 * how "Default always exists" stays true for a platform invented a minute ago.
 */

export interface CreateSubplatformBody {
  branch_id: number;
  /** Parent platform slug. The server derives the subplatform slug from name_en. */
  platform: string;
  name_en: string;
  name_ru?: string;
  name_am?: string;
  /** Omit or null to inherit the platform's rate for that tier. */
  price_standard?: number | null;
  price_vip?: number | null;
}

export interface UpdateSubplatformBody {
  name_en?: string;
  name_ru?: string;
  name_am?: string;
  price_standard?: number | null;
  price_vip?: number | null;
}

/** All subplatforms of one platform, ranked default-first then most-used. */
export const apiListSubplatforms = (branchId: number, platform?: string) =>
  request<{ data: IBranchSubplatform[] }>("/branch-subplatforms", {
    params: platform ? { branch_id: branchId, platform } : { branch_id: branchId },
  });

export const apiCreateSubplatform = (body: CreateSubplatformBody) =>
  request<{ data: IBranchSubplatform }>("/branch-subplatforms", { method: "POST", body });

export const apiUpdateSubplatform = (id: number, body: UpdateSubplatformBody) =>
  request<{ data: IBranchSubplatform }>(`/branch-subplatforms/${id}`, { method: "PUT", body });
