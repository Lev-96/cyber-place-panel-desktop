import { IBranchPlace, PaginatedList, PlaceType, PlatformType } from "@/types/api";
import { request } from "./client";

export interface GetPlacesParams {
  branch_id?: number;
  type?: PlaceType;
  platform?: PlatformType;
  per_page?: number;
  page?: number;
}

export interface CreatePlaceBody {
  branch_id: number;
  number: number;
  type: PlaceType;
  platform: PlatformType;
  game_ids: number[];
}

export type UpdatePlaceBody = Partial<Omit<CreatePlaceBody, "branch_id">>;

export const apiGetPlaces = (params: GetPlacesParams = {}) =>
  request<PaginatedList<IBranchPlace>>("/places", { params });

export const apiGetPlaceById = (id: number) =>
  request<{ data: IBranchPlace }>(`/places/${id}`);

export const apiCreatePlace = (body: CreatePlaceBody) =>
  request<{ message: string }>("/places", { method: "POST", body });

export const apiUpdatePlace = (id: number, body: UpdatePlaceBody) =>
  request<{ message: string }>(`/places/${id}`, { method: "PUT", body });

export const apiDeletePlace = (id: number) =>
  request<{ message: string } | void>(`/places/${id}`, { method: "DELETE" });

export const apiNextPlaceNumber = (branchId: number) =>
  request<{ next: number }>(`/branches/${branchId}/next-place-number`);
