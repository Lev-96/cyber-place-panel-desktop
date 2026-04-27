import { IBranchApi, PaginatedList } from "@/types/api";
import { request } from "./client";

export interface GetBranchesParams {
  company_id?: number;
  city?: string;
  country?: string;
  per_page?: number;
  page?: number;
}

export const apiGetBranches = (params: GetBranchesParams = {}) =>
  request<PaginatedList<IBranchApi>>("/branches", { params });

export const apiGetBranchById = (id: number) =>
  request<{ branch: IBranchApi }>(`/branches/${id}`);
