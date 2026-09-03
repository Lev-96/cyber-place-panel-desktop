import { IPcApi, ISessionApi, ITimePackage } from "@/types/sessions";
import { request } from "./client";

export interface StartSessionBody {
  branch_id: number;
  pc_id: number;
  mode?: "fixed" | "open";
  time_package_id?: number;
  hourly_rate?: number;
  user_display_name?: string;
}

export interface ExtendSessionBody {
  time_package_id: number;
}

/* When the backend's `/sessions`, `/pcs`, `/time-packages` migrations are
   not yet deployed, repositories return `[]` via api/fallback (orFallback). */

export const apiListActiveSessions = (branchId: number) =>
  request<{ data: ISessionApi[] }>("/sessions", { params: { branch_id: branchId, status: "active" } });

/**
 * Every session running right now, in every venue this account may see.
 *
 * The endpoint's `branch_id` is optional and its scope is applied server-side,
 * so leaving it out returns exactly the caller's own branches and nothing more.
 * Used by the console watcher, which has to know whether a console is
 * authorised to be awake whatever screen the panel happens to be showing.
 */
export const apiListAllActiveSessions = () =>
  request<{ data: ISessionApi[] }>("/sessions", { params: { status: "active" } });

export interface ListSessionsParams {
  branch_id?: number;
  pc_id?: number;
  status?: "active" | "stopped" | "expired";
  /** ISO date (YYYY-MM-DD); inclusive — backend expands to startOfDay. */
  from?: string;
  /** ISO date (YYYY-MM-DD); inclusive — backend expands to endOfDay. */
  to?: string;
  limit?: number;
}

export const apiListSessions = (params: ListSessionsParams) =>
  request<{ data: ISessionApi[] }>("/sessions", { params });

export const apiStartSession = (body: StartSessionBody) =>
  request<{ session: ISessionApi }>("/sessions", { method: "POST", body });

export const apiStopSession = (id: number) =>
  request<{ session: ISessionApi }>(`/sessions/${id}/stop`, { method: "POST" });

export const apiExtendSession = (id: number, body: ExtendSessionBody) =>
  request<{ session: ISessionApi }>(`/sessions/${id}/extend`, { method: "POST", body });

export interface ISessionItem {
  id: number;
  session_id: number;
  product_id: number | null;
  name: string;
  price: number | string;
  qty: number;
}

export interface IJoystickCharge {
  id: number;
  slot: number;
  hourly_rate: number;
  started_at: string;
  stopped_at: string | null;
  is_open: boolean;
  minutes: number;
  amount: number;
}

export interface IBillBreakdown {
  mode: "fixed" | "open";
  elapsed_minutes: number;
  time_cost: number;
  hourly_rate: number | null;
  package_name: string | null;
  items: Array<{ id: number; name: string; price: number; qty: number; line_total: number }>;
  items_total: number;
  /** What is actually owed. Zero for a waived session. */
  total: number;

  /* ---- added 2026-09-03; optional so an older backend still renders ---- */

  is_free?: boolean;
  is_unlimited?: boolean;
  /** One line per pad period — "Joystick #3, 15:00→16:00, 700". */
  joysticks?: IJoystickCharge[];
  joysticks_total?: number;
  /** Pads in play including the session's own. */
  joystick_count?: number;
  /** Time + joysticks + items, before the venue's rounding policy. */
  subtotal?: number;
  /** The rounded figure — what it would cost if it were not free. */
  gross_total?: number;
  /** 0 means the venue rounds nothing, which is the default. */
  rounding_step?: number;
  rounding_mode?: "up" | "nearest" | "down";
}

export interface AddItemBody {
  product_id?: number;
  name?: string;
  price?: number;
  qty?: number;
}

/**
 * A whole basket in one request.
 *
 * The dialog builds the selection locally and confirms it once, so this has to
 * be one call: sending N would give N ways to half-succeed, and a bill with the
 * middle line missing is one nobody chose. The backend applies the lot in a
 * transaction — all of it lands or none does.
 */
export interface AddItemsBody {
  items: AddItemBody[];
}

export const apiPreviewSession = (id: number) =>
  request<{ preview: IBillBreakdown }>(`/sessions/${id}/preview`);

export const apiStopSessionWithBreakdown = (id: number) =>
  request<{ session: ISessionApi; breakdown: IBillBreakdown }>(`/sessions/${id}/stop`, { method: "POST" });

export const apiAddSessionItem = (id: number, body: AddItemBody) =>
  request<{ item: ISessionItem; session: ISessionApi }>(`/sessions/${id}/items`, { method: "POST", body });

export const apiAddSessionItems = (id: number, body: AddItemsBody) =>
  request<{ session: ISessionApi }>(`/sessions/${id}/items`, { method: "POST", body });

/**
 * Set the quantity of a line the session already has. `qty: 0` removes it —
 * the minus button walks a count to zero and a zero-quantity line on a bill is
 * not a thing that should exist, so the server deletes the row.
 */
export const apiSetSessionItemQty = (sessionId: number, itemId: number, qty: number) =>
  request<{ session: ISessionApi }>(`/sessions/${sessionId}/items/${itemId}`, {
    method: "PATCH",
    body: { qty },
  });

export const apiRemoveSessionItem = (sessionId: number, itemId: number) =>
  request<{ session: ISessionApi }>(`/sessions/${sessionId}/items/${itemId}`, { method: "DELETE" });

/* ── a live session's terms ───────────────────────────────────────────────
 *
 * Each of these returns the whole session, so the caller replaces its row
 * rather than patching a field it guessed at. The backend is the source of
 * truth for the joystick count and for whether a bill is waived; the card
 * never computes either.
 */

/** Put the next joystick into play. The server picks the slot and its price. */
export const apiAddSessionJoystick = (sessionId: number) =>
  request<{ joystick: { id: number; slot: number; hourly_rate: number; started_at: string }; session: ISessionApi }>(
    `/sessions/${sessionId}/joysticks`,
    { method: "POST" },
  );

/**
 * Take one out. Addressed by SLOT, not by row id: the cashier presses "remove
 * the third pad", and the slot is what the card shows them.
 */
export const apiRemoveSessionJoystick = (sessionId: number, slot: number) =>
  request<{ session: ISessionApi }>(`/sessions/${sessionId}/joysticks/${slot}`, { method: "DELETE" });

/** +10 / +30 / +60, priced at the tariff the player is already on. */
export const apiAddSessionTime = (sessionId: number, minutes: number) =>
  request<{ session: ISessionApi }>(`/sessions/${sessionId}/time`, { method: "POST", body: { minutes } });

/** Lift the ceiling. Refused (422, with a sentence) when the seat is booked. */
export const apiMakeSessionUnlimited = (sessionId: number) =>
  request<{ session: ISessionApi }>(`/sessions/${sessionId}/unlimited`, { method: "POST" });

/** Waive the bill, or put it back. Owner-level; the server enforces it. */
export const apiSetSessionFree = (sessionId: number, isFree: boolean) =>
  request<{ session: ISessionApi }>(`/sessions/${sessionId}/free`, {
    method: "POST",
    body: { is_free: isFree },
  });

/* ── the audit trail ─────────────────────────────────────────────────── */

export type SessionActionName =
  | "started"
  | "stopped"
  | "joystick_added"
  | "joystick_removed"
  | "time_added"
  | "made_unlimited"
  | "free_enabled"
  | "free_disabled";

export interface ISessionEvent {
  id: number;
  session_id: number;
  branch_id: number;
  action: SessionActionName;
  amount: number | null;
  meta: Record<string, unknown> | null;
  created_at: string;
  user?: { id: number; name: string; role: string } | null;
  pc_label?: string | null;
  place_name?: string | null;
}

export interface ListSessionEventsParams {
  branch_id?: number;
  session_id?: number;
  action?: SessionActionName;
  from?: string;
  to?: string;
  limit?: number;
}

export const apiListSessionEvents = (params: ListSessionEventsParams) =>
  request<{ data: ISessionEvent[] }>("/session-events", { params });

export const apiListEventsForSession = (sessionId: number) =>
  request<{ data: ISessionEvent[] }>(`/sessions/${sessionId}/events`);

export const apiListPcs = (branchId: number) =>
  request<{ data: IPcApi[] }>("/pcs", { params: { branch_id: branchId } });

export const apiListPackages = (branchId: number) =>
  request<{ data: ITimePackage[] }>("/time-packages", { params: { branch_id: branchId } });
