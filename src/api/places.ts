import { IBranchPlace, PaginatedList, PlaceType, PlatformType } from "@/types/api";
import { request } from "./client";

export interface GetPlacesParams {
  branch_id?: number;
  type?: PlaceType;
  platform?: PlatformType;
  per_page?: number;
  page?: number;
}

export const apiGetPlaces = (params: GetPlacesParams = {}) =>
  request<PaginatedList<IBranchPlace>>("/places", { params });
