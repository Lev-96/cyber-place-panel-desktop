import { IBranchPlace, PaginatedList, PlaceType } from "@/types/api";
import { Lang } from "@/i18n/translations";
import { request } from "./client";

export interface GetPlacesParams {
  branch_id?: number;
  type?: PlaceType;
  platform?: string;
  per_page?: number;
  page?: number;
}

export interface CreatePlaceBody {
  branch_id: number;
  number: number;
  name?: string | null;
  // Dynamic: known pc/ps4/ps5 OR a custom branch platform slug.
  platform: string;
  hourly_rate?: number | null;
  /**
   * Per-place joystick policy. Null is INHERIT: the place falls back to the
   * branch's `joystick_included` / `joystick_price`, which is where the rule
   * lives for every seat that has no reason to differ.
   *
   * Sent for PlayStation places only. For anything else the panel sends null,
   * so a seat that stops being a PlayStation stops carrying an override for
   * one — the same thing `hourly_rate` does when a platform stops being custom.
   */
  joystick_included?: number | null;
  joystick_price?: number | null;
  /** Which extra pads this room charges for: "3", "4" or "3,4". Null inherits. */
  joystick_charged_slots?: string | null;
  /**
   * Display наименование for a brand-new custom platform's branch price. Only
   * meaningful when the platform is custom AND not yet priced; ignored
   * otherwise. Not a Place column — the backend forwards it to the price row.
   */
  platform_name?: string | null;
  type: PlaceType;
  game_ids?: number[];
  /**
   * Language the staff member typed `name` in. The backend treats this locale
   * as the source of truth and machine-translates the others — it never writes
   * back into it. Omitted by older panel builds, which the backend falls back
   * to its configured default for.
   */
  source_locale?: Lang;
}

export type UpdatePlaceBody = Partial<Omit<CreatePlaceBody, "branch_id">>;

export const apiGetPlaces = (params: GetPlacesParams = {}) =>
  request<PaginatedList<IBranchPlace>>("/places", { params });

export const apiGetPlaceById = (id: number) =>
  request<{ data: IBranchPlace }>(`/places/${id}`);

/**
 * The backend already returns the created row under `places` (the resource's
 * `$wrap`); it was simply not typed here. The panel needs its id to store the
 * per-language names right after the save.
 */
export const apiCreatePlace = (body: CreatePlaceBody) =>
  request<{ message: string; places?: IBranchPlace }>("/places", { method: "POST", body });

export const apiUpdatePlace = (id: number, body: UpdatePlaceBody) =>
  request<{ message: string }>(`/places/${id}`, { method: "PUT", body });

export const apiDeletePlace = (id: number) =>
  request<{ message: string } | void>(`/places/${id}`, { method: "DELETE" });

export const apiNextPlaceNumber = (branchId: number) =>
  request<{ next: number }>(`/branches/${branchId}/next-place-number`);
