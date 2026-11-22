import { request } from "./client";

/**
 * A club's TV that shows a place's player messages (2026-11-23).
 *
 * The TV itself talks to the backend (`/tv/pair`, `/tv/state`); the panel
 * only pairs it to a place by the six-digit code on its screen, moves it,
 * renames it or unpairs it. Owner-level on the backend (`places.manage`),
 * branch scoped. Nothing here touches the LAN, the consoles or sessions.
 */
export interface ITvScreen {
  id: number;
  branch_id: number;
  /** null when its place was removed: the TV then shows nothing. */
  place_id: number | null;
  place_name: string | null;
  place_number: number | null;
  name: string | null;
  paired_at: string | null;
  last_seen_at: string | null;
  /** Read its state within the last 90 seconds. */
  online: boolean;
}

export const apiListTvScreens = (branchId: number) =>
  request<{ data: ITvScreen[] }>(`/branches/${branchId}/tv-screens`, { noCache: true }).then((r) => r.data);

export const apiPairTvScreen = (branchId: number, body: { code: string; place_id: number; name?: string | null }) =>
  request<{ data: ITvScreen }>(`/branches/${branchId}/tv-screens`, { method: "POST", body }).then((r) => r.data);

export const apiUpdateTvScreen = (id: number, body: { place_id?: number; name?: string | null }) =>
  request<{ data: ITvScreen }>(`/tv-screens/${id}`, { method: "PATCH", body }).then((r) => r.data);

export const apiUnpairTvScreen = (id: number) => request<null>(`/tv-screens/${id}`, { method: "DELETE" });

/** Six digits, as the TV shows them; spaces and dashes a person types are dropped. */
export const normalizeTvCode = (raw: string): string => raw.replace(/[\s-]/g, "");

export const isTvCode = (code: string): boolean => /^\d{6}$/.test(code);
