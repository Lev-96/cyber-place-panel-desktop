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
   * WHICH joystick strategy this seat runs on.
   *
   * Sent only when the club allows both and the cashier picked one; the server
   * fills it in itself when the club permits a single strategy, so a client
   * that omits it is not making a decision by accident. The server refuses a
   * strategy the club does not allow.
   */
  joystick_strategy?: "fixed" | "hourly";
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
 * `is_hourly` says what `price` MEANS, and therefore what `amount` is:
 *
 *  - fee strategy: `price` is a one-off charge, and `amount` is that whole fee
 *    or zero and never anything between. `is_charged` says which of the two
 *    happened, so a line worth 0 can explain itself instead of reading as a bug.
 *  - hourly strategy: `price` is a rate per hour, and `amount` is this period's
 *    own share of it. A fraction is the normal case, not an edge one.
 *
 * `amount` is the server's figure under both. Nothing on this side multiplies
 * or divides a `price`.
 */
export interface IJoystickCharge {
  id: number;
  slot: number;
  /** A fee or a rate per hour. `is_hourly` below says which. */
  price: number;
  started_at: string;
  stopped_at: string | null;
  is_open: boolean;
  minutes: number;
  seconds: number;
  amount: number;
  is_charged: boolean;
  /** Which strategy priced this period, frozen on the row when it opened. */
  is_hourly?: boolean;
}

export interface IBillBreakdown {
  mode: "fixed" | "open";
  elapsed_minutes: number;
  time_cost: number;
  hourly_rate: number | null;
  package_name: string | null;
  items: Array<{
    id: number;
    name: string;
    price: number;
    qty: number;
    line_total: number;
    /**
     * The room's own extra, RENTED by the hour: `price` is then a rate and
     * `line_total` is what the server has counted for it so far.
     *
     * Optional, so a bill from an older backend still renders as the drinks
     * it used to be.
     */
    is_hourly?: boolean;
    minutes?: number | null;
    /** When it was handed back. Null is "still out, still on the clock". */
    returned_at?: string | null;
  }>;
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
  /**
   * The ROOM's own extra: chips, a cue, darts.
   *
   * Carries a count and nothing else. The name and the price come from the
   * place, which is why the server refuses `name`, `price` and `product_id`
   * beside it rather than ignoring them — and also why a manager may sell one
   * without the right to type prices onto a bill.
   */
  extra?: true;
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

/** How the money was taken. `other` is the only one that carries free text. */
export type PaymentMethod = "cash" | "card" | "other";

export interface StopSessionBody {
  payment_method?: PaymentMethod;
  /** Required by the server ONLY when the method is `other`. */
  payment_method_other?: string;
}

export const apiStopSessionWithBreakdown = (id: number, body?: StopSessionBody) =>
  request<{ session: ISessionApi; breakdown: IBillBreakdown }>(`/sessions/${id}/stop`, {
    method: "POST",
    body,
  });

export const apiAddSessionItem = (id: number, body: AddItemBody) =>
  request<{ item: ISessionItem; session: ISessionApi }>(`/sessions/${id}/items`, { method: "POST", body });

export const apiAddSessionItems = (id: number, body: AddItemsBody) =>
  request<{ session: ISessionApi }>(`/sessions/${id}/items`, { method: "POST", body });

/**
 * What the server made of a line (2026-09-25). Absent on a backend from before
 * it, where `error === null` still means "matched".
 */
export type ResolvedLineStatus = "matched" | "ambiguous" | "unmatched" | "invalid";

/** One product an ambiguous line could mean — the server's, priced by it. */
export interface IResolvedOption {
  product_id: number;
  name: string;
  price: number;
  /** price × the line's quantity, as the server computed it. */
  line_total: number | null;
}

/**
 * The operator's pick for an ambiguous line: which line (by index and by its
 * text, so a pick never lands on a line that changed) and which product. The
 * server applies it only if that product is one of THAT line's options.
 */
export interface IItemChoice {
  line: number;
  raw: string;
  product_id: number;
}

/** One typed line, as the server read it: a priced product, or a refusal. */
export interface IResolvedItemLine {
  /** Exactly what the cashier typed, so an error can point at the line. */
  raw: string;
  product_id: number | null;
  name: string | null;
  price: number | null;
  qty: number | null;
  line_total: number | null;
  /** The server's own sentence. Null when the line resolved. */
  error: string | null;
  /** Names worth trying, when the word matched nothing or matched two things. */
  candidates: string[];
  status?: ResolvedLineStatus;
  /**
   * The products an ambiguous line could mean (and, once one was picked, the
   * same list, so the pick can be changed). Empty otherwise.
   */
  options?: IResolvedOption[];
}

export interface IResolvedItems {
  lines: IResolvedItemLine[];
  /** What to send to `apiAddSessionItems`. Empty unless every line resolved. */
  items: Array<{ product_id: number; qty: number }>;
  total: number;
  ok: boolean;
}

/**
 * Reads the quick-entry box WITHOUT touching the bill.
 *
 * The server owns the matching rules — which product a word is, and whether it
 * is sure enough to say so — because the till and the mobile app would
 * otherwise each grow their own answer to the same question. What comes back is
 * a preview plus, when every line resolved, the exact `items` the existing add
 * endpoint expects. Confirming goes through THAT endpoint: this one never
 * writes.
 */
export const apiResolveSessionItemsText = (id: number, text: string, choices?: IItemChoice[]) =>
  request<{ resolved: IResolvedItems }>(`/sessions/${id}/items/resolve`, {
    method: "POST",
    // `choices` only when there are some: the body of an ordinary read stays
    // exactly what it always was.
    body: choices && choices.length > 0 ? { text, choices } : { text },
  });

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

/**
 * Hand an HOURLY extra back: the clock stops, the charge stays.
 *
 * The same endpoint a quantity correction uses, because it is the same kind
 * of thing — a change to a line already on the bill. Removing the line is
 * still `apiRemoveSessionItem` and still means "this was never sold".
 */
export const apiReturnSessionItem = (sessionId: number, itemId: number) =>
  request<{ session: ISessionApi }>(`/sessions/${sessionId}/items/${itemId}`, {
    method: "PATCH",
    body: { returned: true },
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

/**
 * Put one joystick into play.
 *
 * The SLOT is the cashier naming which pad they are handing over, which a venue
 * that prices the third and the fourth apart needs them to be able to say.
 * Omitting it is "the next one", which is what this call always did and what
 * the server still does when nothing is named.
 *
 * No price travels here in either case. What a pad costs is resolved on the
 * server from the venue's own rule on every add; a figure sent from this side
 * would be a figure nobody at the venue agreed to.
 */
export const apiAddSessionJoystick = (sessionId: number, slot?: number) =>
  request<{ joystick: { id: number; slot: number; hourly_rate: number; started_at: string }; session: ISessionApi }>(
    `/sessions/${sessionId}/joysticks`,
    { method: "POST", body: slot === undefined ? undefined : { slot } },
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

/**
 * One seat a running session could move to right now — «Переместить игрока».
 *
 * Every figure is the SERVER's: `hourly_rate` is what that seat would bill,
 * `same_rate` compares it with the session's current effective rate, and
 * `free_until` is the start of a reservation that would cut the session short
 * (null when none does). `free_minutes` is counted from when the list was drawn.
 */
export interface IRelocationPlace {
  place_id: number;
  number: number | null;
  name: string | null;
  platform: string | null;
  type: string | null;
  hourly_rate: number;
  same_rate: boolean;
  free_until: string | null;
  free_minutes: number | null;
}

export interface IRelocationOptions {
  current: {
    place_id: number | null;
    number: number | null;
    name: string | null;
    platform: string | null;
    type: string | null;
    hourly_rate: number | null;
    ends_at: string | null;
    paused: boolean;
  };
  /** Same-rate seats first, then the rest; unlimited before limited in each. */
  places: IRelocationPlace[];
}

/** ⚠️ ADVICE, like `apiSessionExtensionOptions`: `apiRelocateSession` re-checks. */
export const apiRelocationOptions = (sessionId: number) =>
  request<IRelocationOptions>(`/sessions/${sessionId}/relocation-options`);

export interface RelocateSessionBody {
  place_id: number;
  /** Only when the operator changed the price; omitted = the seat's own rate. */
  hourly_rate?: number;
  /** The reservation limit the operator saw and accepted, echoed back verbatim. */
  until?: string;
}

/**
 * Move the running session to another seat. The SAME session comes back; the
 * time already played keeps its price and only what follows runs at the new
 * rate. A seat taken, reserved, or limited differently since the list was drawn
 * is refused (409) — pick again.
 */
export const apiRelocateSession = (sessionId: number, body: RelocateSessionBody) =>
  request<{ session: ISessionApi }>(`/sessions/${sessionId}/relocate`, { method: "POST", body });

/** Waive the bill, or put it back. Owner-level; the server enforces it. */
export const apiSetSessionFree = (sessionId: number, isFree: boolean) =>
  request<{ session: ISessionApi }>(`/sessions/${sessionId}/free`, {
    method: "POST",
    body: { is_free: isFree },
  });

/**
 * Stop / restart a running session's clock. The seat stays taken and the
 * session stays `active`; the server answers with the whole row, `paused_at`
 * and `pauses` included, and refuses a wrong state with a sentence (409).
 */
export const apiPauseSession = (sessionId: number) =>
  request<{ session: ISessionApi }>(`/sessions/${sessionId}/pause`, { method: "POST" });

export const apiResumeSession = (sessionId: number) =>
  request<{ session: ISessionApi }>(`/sessions/${sessionId}/resume`, { method: "POST" });

/* ── the audit trail ─────────────────────────────────────────────────── */

export type SessionActionName =
  | "started"
  | "stopped"
  | "joystick_added"
  | "joystick_removed"
  | "time_added"
  | "made_unlimited"
  // The clock stopped and started again; `resumed` carries how long.
  | "paused"
  | "resumed"
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
  // An hourly extra handed back: the clock stopped, the charge stayed.
  | "item_returned"
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
