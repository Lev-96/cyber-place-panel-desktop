import { IPcApi, ISessionApi, ITimePackage } from "@/types/sessions";
import { request } from "./client";

export interface StartSessionBody {
  branch_id: number;
  pc_id: number;
  mode?: "fixed" | "open";
  time_package_id?: number;
  hourly_rate?: number;
  user_display_name?: string;
  /**
   * Start it waived. Owner-level, and the SERVER is what enforces that — this
   * flag reaching it from a manager's panel is answered with a 403, not with a
   * free session. Omitted entirely unless the operator asked for one, so a
   * backend from before this release keeps working.
   */
  is_free?: boolean;
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

/**
 * One pad period on a bill.
 *
 * `amount` is `price` or zero and never anything between: the server owes the
 * whole fee once the period reaches its threshold and nothing before that.
 * `is_charged` says which of the two happened, so a line worth 0 can explain
 * itself instead of reading as a bug.
 */
export interface IJoystickCharge {
  id: number;
  slot: number;
  /** The flat fee for this use. Never divided, never multiplied. */
  price: number;
  started_at: string;
  stopped_at: string | null;
  is_open: boolean;
  minutes: number;
  seconds: number;
  amount: number;
  is_charged: boolean;
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
  /** One line per pad period — "Joystick #3, 15:00→15:20, 700". */
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

/**
 * Lift the ceiling, optionally at a new price. Refused (422, with a sentence)
 * when the seat is booked.
 *
 * The rate is omitted unless the operator actually named one: the server then
 * keeps the tariff's own, which is what every switch did before a price could
 * be sent. When it IS sent it means "from now on" — the server freezes what the
 * clock had earned first, so nothing already played is repriced.
 */
export const apiMakeSessionUnlimited = (sessionId: number, hourlyRate?: number) =>
  request<{ session: ISessionApi }>(`/sessions/${sessionId}/unlimited`, {
    method: "POST",
    body: hourlyRate === undefined ? {} : { hourly_rate: hourlyRate },
  });

/**
 * One seat the player could finish on instead.
 *
 * `hourly_rate` is what the SERVER resolved for that seat, not a number the
 * panel worked out — showing a different figure from the one that will be
 * charged is the bug this field exists to prevent.
 */
export interface IExtensionAlternative {
  place_id: number;
  pc_id: number;
  number: number | null;
  name: string | null;
  platform: string | null;
  type: string | null;
  hourly_rate: number;
  free_from: string;
  free_until: string;
}

/** What the server says about extending this session by N minutes. */
export interface IExtensionOptions {
  can_extend_here: boolean;
  /** `seat_reserved`, `seat_reserved_unlimited`, `unlimited`, or null. */
  reason: string | null;
  current: {
    session_id: number;
    place_id: number | null;
    place_number: number | null;
    place_name: string | null;
    platform: string | null;
    type: string | null;
    started_at: string | null;
    ends_at: string | null;
    is_unlimited: boolean;
  };
  requested_minutes: number;
  requested_end: string | null;
  latest_allowed_end: string | null;
  max_minutes_here: number | null;
  alternatives: IExtensionAlternative[];
}

/**
 * "Can this seat take +N, and if not, where could the player finish?"
 *
 * ⚠️ ADVICE. The list was true when it was drawn and a phone can reserve one of
 * those seats a second later — `apiTransferExtension` re-checks everything
 * under a row lock and may still refuse. Never treat this as a promise.
 */
export const apiSessionExtensionOptions = (sessionId: number, minutes: number) =>
  request<IExtensionOptions>(`/sessions/${sessionId}/extension-options?minutes=${minutes}`);

/**
 * Move the session to another seat and grant the time there — one atomic
 * operation on the server.
 *
 * The SAME session comes back: same id, same start, same bill, same products
 * and pads. Nothing is re-created, so nothing is charged twice.
 */
export const apiTransferExtension = (sessionId: number, placeId: number, minutes: number) =>
  request<{ session: ISessionApi }>(`/sessions/${sessionId}/transfer-extension`, {
    method: "POST",
    body: { place_id: placeId, minutes },
  });

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
  | "free_disabled"
  // ⚠️ The server has emitted this since seat migration shipped; the client
  // type never learned it, so every `moved` line arrived typed as something
  // it is not and the history could not branch on it.
  | "moved"
  // The bill's own lines, and the two refusals. A history of successes cannot
  // answer "why was this player moved" — the grant that was turned down is the
  // reason the move happened at all.
  | "item_added"
  | "item_removed"
  | "time_add_refused"
  | "move_failed";

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
