import { request } from "./client";

/**
 * The PSN accounts seen on each PlayStation place's console (2026-11-23;
 * several per console since 2026-11-24): the player messages go to the one
 * online on a PlayStation when the session starts, and only to that player.
 * Owner-level on the backend. `enabled` mirrors the backend's
 * PSN_PLACE_MESSAGES: while false nothing is sent and the panel says so.
 */
export interface IPsnPlaces {
  enabled: boolean;
  data: { place_id: number; online_ids: string[] }[];
}

export const apiListPsnPlaces = (branchId: number) =>
  request<IPsnPlaces>(`/branches/${branchId}/psn-places`, { noCache: true });

/**
 * Replace a place's accounts (empty clears). The server checks new names with
 * Sony: 422 `psn_unknown_online_ids` names the unknown ones in `unknown`;
 * 422 `psn_sender_is_console` when the club's own sender is listed.
 * `checked: false` when Sony could not be asked (saved anyway).
 */
export const apiSetPlacePsnAccounts = (placeId: number, onlineIds: string[]) =>
  request<{ data: { place_id: number; online_ids: string[]; checked: boolean } }>(`/places/${placeId}/psn-accounts`, {
    method: "PUT",
    body: { online_ids: onlineIds },
  });

/** At most this many per console, as the server allows. */
export const MAX_PSN_ACCOUNTS_PER_PLACE = 8;

/** The names out of what was typed: split on commas, semicolons and spaces, empty ones dropped. */
export const parseOnlineIds = (typed: string): string[] => typed.split(/[\s,;]+/).map((s) => s.trim()).filter((s) => s !== "");
