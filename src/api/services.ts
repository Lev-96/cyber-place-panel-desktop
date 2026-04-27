import { IBranchService, PaginatedList } from "@/types/api";
import { request } from "./client";

export interface GetServicesParams {
  branch_id?: number;
  per_page?: number;
  page?: number;
}

export const apiGetServices = (params: GetServicesParams = {}) =>
  request<PaginatedList<IBranchService>>("/services", { params });
