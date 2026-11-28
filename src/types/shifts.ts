/**
 * The cash shift as the backend reports it (2026-10-19). Every amount is a
 * decimal string ("1500.00") computed on the server; the panel shows it and
 * never recomputes it.
 */
export type Money = string;

export interface IShiftPerson {
  id: number;
  name: string;
}

export type DifferenceKind = "shortage" | "surplus" | "none";

export interface IShift {
  id: number;
  branch_id: number;
  status: "open" | "closed";
  opened_at: string;
  closed_at: string | null;
  opened_by: IShiftPerson | null;
  closed_by: IShiftPerson | null;
  opening_cash: Money;
  expected_cash: Money | null;
  counted_cash: Money | null;
  cash_difference: Money | null;
  difference_kind: DifferenceKind | null;
  notes: string | null;
  has_report: boolean;
  /** The branch, as staff know it: its address. */
  branch: { id: number; address: string | null; city: string | null } | null;
  /** What the shift took, from its frozen report; null while open or for a v1 shift. */
  revenue_total: Money | null;
  /**
   * Owner / admin only (2026-11-28): the goods short when the NEXT shift
   * accepted this one; null = none (not accepted yet, all matched, surplus
   * only, a first count). ABSENT for a manager and from an older backend.
   */
  stock_handover?: IStockHandoverSummary | null;
}

/** One shift's goods shortage, for its row in the history (the server's figures). */
export interface IStockHandoverSummary {
  products: number;
  units: number;
  value: Money;
  /** The biggest losses first, at most 5. */
  items: Array<{ name: string; diff: number; value: Money }>;
  items_total: number;
}

export interface IShiftStaff {
  id: number;
  name: string;
  role: string;
}

export interface ShiftHistoryFilters {
  branch_id?: number;
  staff_user_id?: number;
  date_from?: string;
  date_to?: string;
  status?: "open" | "closed";
  discrepancy?: "shortage" | "surplus" | "none" | "any";
  page?: number;
  per_page?: number;
}

/** One part of a line's payment (report v4, 2026-11-07); absent on older reports. */
export interface IShiftPaymentPart {
  method: string;
  amount: Money;
}

export interface IShiftPlaceLine {
  id: number;
  seat: string;
  platform: string;
  /** `split` (v4): paid in parts, see `payments`. */
  method: string;
  payments?: IShiftPaymentPart[];
  amount: Money;
  status: string;
  is_free: boolean;
  closed_at: string | null;
  /** v5 (2026-11-15): paid ahead on this place, the change given back, still owed at the hand-over; null: none. */
  prepaid?: Money | null;
  change?: Money | null;
  unpaid?: Money | null;
}

/** v5 (2026-11-15): one prepayment taken into this shift's drawer — never revenue. */
export interface IShiftPrepaymentLine {
  id: number;
  session_id: number;
  seat: string;
  amount: Money;
  /** `cash`, and since 2026-11-17 also `card` / `other` (a split is one line per part). */
  method: string;
  /** `start` (at the start / «На сумму») or `time` («+ Время» paid ahead). */
  kind: "start" | "time" | string;
  user_id: number | null;
  at: string | null;
}

export type ShiftWarning =
  | "places_method_unrecorded"
  | "tournaments_method_unrecorded"
  | "topups_outside_expected_cash"
  | "places_running"
  | "places_paused"
  | "bookings_open";

/** v3 (2026-10-26): one product at one price, from the lines it was sold on. */
export interface IShiftProductRow {
  product_id: number | null;
  name: string;
  unit_price: Money;
  quantity: number;
  total: Money;
}

/**
 * v6 (2026-11-16): one counted product's shelf over the shift, in PIECES (never
 * money). `start` / `remaining` null = not counted then. The server keeps
 * start + received − sold + returned + corrected = remaining; nothing is
 * summed here.
 */
export interface IShiftStockRow {
  product_id: number | null;
  name: string;
  start: number | null;
  received: number;
  sold: number;
  returned: number;
  sold_net: number;
  corrected: number;
  remaining: number | null;
}

export interface IShiftStock {
  rows: IShiftStockRow[];
  totals: { start: number; received: number; sold: number; returned: number; sold_net: number; corrected: number; remaining: number };
  count: number;
  negative_count: number;
}

/** v6: one movement of the shelf in the shift — what the stock totals were summed from. */
export interface IShiftStockLine {
  id: number;
  product_id: number | null;
  name: string;
  kind: "received" | "corrected" | "untracked" | "till_sale" | "till_void" | "seat_sale" | "seat_return" | string;
  via: string | null;
  delta: number;
  stock_before: number | null;
  stock_after: number | null;
  order_id: number | null;
  session_id: number | null;
  user_id: number | null;
  at: string | null;
}

export interface IShiftProductGroup {
  rows: IShiftProductRow[];
  units: number;
  total: Money;
}

/** v3: one person's own part of the shift. The parts overlap by design and are never summed. */
export interface IShiftStaffPart {
  id: number;
  name: string;
  /** Paid till sales they made. */
  till: { count: number; units: number; total: Money };
  /** Places they started in the shift: launches, distinct seats, how those stand now. */
  started: { launches: number; seats: number; finished: number; running: number; /** v5: cash they took ahead. */ prepaid?: Money };
  /** Places billed in this shift that they had started. */
  started_billed: { count: number; total: Money };
  /** Places billed in this shift that they stopped — the money they took. */
  closed: { count: number; total: Money; cash: Money };
  /** Sales they voided during the shift. */
  voided: { count: number; total: Money };
}

export interface IShiftHandoverPlace {
  session_id: number;
  seat: string;
  platform: string;
  mode: string;
  is_free: boolean;
  paused: boolean;
  started_at: string | null;
  /** null: runs until someone stops it. */
  ends_at: string | null;
  started_by: IShiftPerson | null;
}

export type ShiftNotTracked = "customer_debts" | "cash_movements" | "topup_payment_method";

export interface IShiftReport {
  period: { opened_at: string; to: string; duration_seconds: number };
  places: {
    closed_count: number;
    free_count: number;
    expired_count: number;
    started_count: number;
    running_count: number;
    by_method: { cash: Money; card: Money; other: Money; unrecorded: Money; /** 2026-11-25 */ bonus?: Money };
    count_by_method: { cash: number; card: number; other: number; unrecorded: number; bonus?: number };
    total: Money;
    /** v2 (2026-10-19): absent from a report frozen before. */
    unique_seats?: number;
    by_platform?: Array<{ platform: string; count: number; total: Money }>;
    paused_count?: number;
    /** v5 (2026-11-15): places paid ahead, and places that ended owing something. */
    prepaid?: { count: number; amount: Money; settled: Money; change: Money; due: Money };
    unpaid?: { count: number; amount: Money };
  };
  till: {
    paid_count: number;
    by_method: { cash: Money; card: Money; deposit: Money; other: Money; /** 2026-11-25 */ bonus?: Money };
    count_by_method: { cash: number; card: number; deposit: number; other: number; bonus?: number };
    total: Money;
    voided_count: number;
    voided_total: Money;
  };
  tournaments: { count: number; total: Money };
  revenue_total: Money;
  /** Places and till together; `unrecorded` also holds tournament fees. Adds up to revenue_total. */
  /** Club Card bonuses spent (2026-11-25) are on their own line and NOT in revenue_total. */
  by_method: { cash: Money; card: Money; other: Money; deposit: Money; unrecorded: Money; bonus?: Money };
  cash: {
    opening: Money;
    places: Money;
    till: Money;
    /**
     * v5 (2026-11-15): cash paid ahead into this shift, the prepayments of the
     * places settled in it, and the change given back from those. expected =
     * opening + places + till + prepaid_in − prepaid_settled (the server's sum).
     */
    prepaid_in?: Money;
    /** 2026-11-17: everything paid ahead in the shift, by method (`prepaid_in` is its cash). */
    prepaid_in_by_method?: Partial<Record<"cash" | "card" | "other", Money>>;
    prepaid_settled?: Money;
    change?: Money;
    expected: Money;
    /** Present once closed. */
    counted?: Money;
    difference?: Money;
    difference_kind?: DifferenceKind;
  };
  member_topups: { count: number; total: Money };
  /** v2: bookings, counted by time (they carry no money). */
  bookings?: {
    created_count: number;
    cancelled_count: number;
    no_show_count: number;
    served_count: number;
    scheduled: { count: number; served: number; cancelled: number; open: number };
  };
  /** v2: the records each total was summed from. */
  lines?: {
    places: IShiftPlaceLine[];
    till: Array<{ id: number; method: string; amount: Money; status: string; at: string | null; payments?: IShiftPaymentPart[] }>;
    tournaments: Array<{ id: number; amount: Money; paid_at: string }>;
    member_topups: Array<{ id: number; amount: Money }>;
    /** v5 (2026-11-15). */
    prepaid?: IShiftPrepaymentLine[];
    /** v6 (2026-11-16). */
    stock?: IShiftStockLine[];
  };
  /** v3 (2026-10-26): absent from a report frozen before. */
  products?: {
    till: IShiftProductGroup;
    till_voided: IShiftProductGroup;
    /** Catalogue lines of places billed in the shift — inside the places' money, before rounding. */
    places: IShiftProductGroup;
    /** Lines of free places: they earned nothing. */
    places_free: IShiftProductGroup;
    units: number;
    total: Money;
  };
  /** v6 (2026-11-16): the shelf per counted product; absent from a report frozen before. */
  stock?: IShiftStock;
  /** 2026-11-18: the count the shift was accepted with; absent when none was taken. Blind for a manager. */
  acceptance_count?: IAcceptanceCount;
  staff?: IShiftStaffPart[];
  handover?: { count: number; places: IShiftHandoverPlace[] };
  voided_from_other_shifts?: {
    count: number;
    total: Money;
    lines: Array<{ id: number; amount: Money; method: string; shift_id: number | null; sold_at: string | null; voided_at: string | null; voided_by_id: number | null }>;
  };
  not_tracked?: ShiftNotTracked[];
  version?: number;
  warnings: ShiftWarning[];
  /** Present once closed. */
  closed?: { closed_at: string; closed_by: IShiftPerson; notes: string | null };
}

export interface IShiftWithReport {
  shift: IShift;
  /** null only for a shift closed before reports were kept. */
  report: IShiftReport | null;
  /**
   * Owner / admin only (2026-11-28): how THIS shift handed the goods over —
   * the count the next shift was accepted with, read live beside the frozen
   * report. null = no shift accepted after it with a count yet. ABSENT for a
   * manager and from an older backend.
   */
  stock_handover?: IStockHandover | null;
}

/** The next shift's acceptance count, read from the shift that handed it over. */
export type IStockHandover = IAcceptanceCountFull & {
  accepted_by_shift: { id: number; opened_at: string | null; opened_by: IShiftPerson | null };
};

/**
 * «Приём смены» (2026-11-18): one product the manager coming on must count.
 * Names only: the count is BLIND, so the server never sends what it expects.
 */
export interface IAcceptanceProduct {
  product_id: number;
  name: string;
  category: string | null;
  /** false = hidden from sale, still on the shelf, still counted. */
  is_active: boolean;
}

/** One counted product as `POST /shifts/open` takes it. */
export interface IStockCountEntry {
  product_id: number;
  counted: number;
}

/** What a shift is opened with: every field the new panel always sends. */
export interface OpenShiftBody {
  branch_id: number;
  opening_cash: string;
  client_request_id: string;
  /** Empty when the branch counts nothing; never omitted by this build. */
  stock_counts: IStockCountEntry[];
}

/** 422 `stock_count_required`: the open was refused, these were not counted. */
export interface IStockCountRequiredBody {
  code: "stock_count_required";
  message: string;
  missing: Array<{ product_id: number; name: string }>;
}

/** What one product's count came to (backend `App\Enums\StockCountOutcome`). */
export type StockCountOutcome = "shortage" | "surplus" | "none" | "baseline";

export const STOCK_COUNT_OUTCOME = {
  shortage: "shortage",
  surplus: "surplus",
  none: "none",
  baseline: "baseline",
} as const satisfies Record<StockCountOutcome, StockCountOutcome>;

/** The manager's view of a count, and the open's answer: what was counted, nothing else. */
export interface IAcceptanceCountBlind {
  blind: true;
  counted_at: string | null;
  counted_by: IShiftPerson | null;
  rows: Array<{ product_id: number | null; name: string; counted: number }>;
  count: number;
}

/** One product of the owner's view: the books, the count and what the difference is worth. */
export interface IAcceptanceCountRow {
  product_id: number | null;
  name: string;
  unit_price: Money;
  expected: number;
  counted: number;
  diff: number;
  value: Money;
  outcome: StockCountOutcome;
  is_baseline: boolean;
  last_movement_at: string | null;
  last_sale_at: string | null;
  /**
   * How the books got to `expected` (owner/admin only): what the previous
   * shift counted, then what the program recorded since. When `accepted` is
   * not null the server keeps accepted + received − sold + returned +
   * corrected = expected; nothing is added up here. null/absent: not known.
   */
  flow?: IAcceptanceFlow | null;
}

export interface IAcceptanceFlow {
  /** null: this product was not counted at the previous acceptance. */
  accepted: number | null;
  received: number;
  sold: number;
  returned: number;
  corrected: number;
}

/** The owner's / admin's view (`report.acceptance_count`, no `blind` key). */
export interface IAcceptanceCountFull {
  blind?: false;
  counted_at: string | null;
  counted_by: IShiftPerson | null;
  previous_shift: {
    id: number;
    opened_at: string | null;
    closed_at: string | null;
    opened_by: IShiftPerson | null;
    closed_by: IShiftPerson | null;
  } | null;
  /** Whose shelf it was: the previous shift's opener. */
  blamed_user: IShiftPerson | null;
  window: { from: string | null; to: string | null } | null;
  /** The time between the previous close and this count; `notable` = over 30 min. */
  gap: { from: string; to: string; seconds: number; notable: boolean } | null;
  rows: IAcceptanceCountRow[];
  totals: {
    products: number;
    baseline_products: number;
    shortage_products: number;
    shortage_units: number;
    shortage_value: Money;
    surplus_products: number;
    surplus_units: number;
    surplus_value: Money;
  };
}

export type IAcceptanceCount = IAcceptanceCountBlind | IAcceptanceCountFull;

export const isBlindCount = (c: IAcceptanceCount): c is IAcceptanceCountBlind => c.blind === true;

/** The open's answer: the shift, and the blind count when one was taken. */
export interface IOpenShiftResult {
  shift: IShift;
  acceptance_count?: IAcceptanceCountBlind;
  /** The same press again: the server answered with the shift it already opened. */
  replayed?: boolean;
}
