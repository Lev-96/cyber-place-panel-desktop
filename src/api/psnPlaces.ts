import { request } from "./client";

/**
 * The PSN account each PlayStation place's console is signed in with
 * (2026-11-23): where that place's player messages go when its TV cannot
 * show them (Hisense VIDAA, Samsung, LG). Owner-level on the backend.
 * `enabled` mirrors the backend's PSN_PLACE_MESSAGES: while false nothing
 * is sent, and the panel does not offer the setting.
 */
export interface IPsnPlaces {
  enabled: boolean;
  data: { place_id: number; online_id: string }[];
}

export const apiListPsnPlaces = (branchId: number) =>
  request<IPsnPlaces>(`/branches/${branchId}/psn-places`, { noCache: true });

export const apiSetPlacePsnAccount = (placeId: number, onlineId: string) =>
  request<{ data: { place_id: number; online_id: string } }>(`/places/${placeId}/psn-account`, { method: "PUT", body: { online_id: onlineId } });

export const apiRemovePlacePsnAccount = (placeId: number) =>
  request<null>(`/places/${placeId}/psn-account`, { method: "DELETE" });
