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

export interface IShiftPlaceLine {
  id: number;
  seat: string;
  platform: string;
  method: string;
  amount: Money;
  status: string;
  is_free: boolean;
  closed_at: string | null;
}

export type ShiftWarning =
  | "places_method_unrecorded"
  | "tournaments_method_unrecorded"
  | "topups_outside_expected_cash"
  | "places_running"
  | "places_paused"
  | "bookings_open";

export interface IShiftReport {
  period: { opened_at: string; to: string; duration_seconds: number };
  places: {
    closed_count: number;
    free_count: number;
    expired_count: number;
    started_count: number;
    running_count: number;
    by_method: { cash: Money; card: Money; other: Money; unrecorded: Money };
    count_by_method: { cash: number; card: number; other: number; unrecorded: number };
    total: Money;
    /** v2 (2026-10-19): absent from a report frozen before. */
    unique_seats?: number;
    by_platform?: Array<{ platform: string; count: number; total: Money }>;
    paused_count?: number;
  };
  till: {
    paid_count: number;
    by_method: { cash: Money; card: Money; deposit: Money; other: Money };
    count_by_method: { cash: number; card: number; deposit: number; other: number };
    total: Money;
    voided_count: number;
    voided_total: Money;
  };
  tournaments: { count: number; total: Money };
  revenue_total: Money;
  /** Places and till together; `unrecorded` also holds tournament fees. Adds up to revenue_total. */
  by_method: { cash: Money; card: Money; other: Money; deposit: Money; unrecorded: Money };
  cash: {
    opening: Money;
    places: Money;
    till: Money;
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
    till: Array<{ id: number; method: string; amount: Money; status: string; at: string | null }>;
    tournaments: Array<{ id: number; amount: Money; paid_at: string }>;
    member_topups: Array<{ id: number; amount: Money }>;
  };
  version?: number;
  warnings: ShiftWarning[];
  /** Present once closed. */
  closed?: { closed_at: string; closed_by: IShiftPerson; notes: string | null };
}

export interface IShiftWithReport {
  shift: IShift;
  /** null only for a shift closed before reports were kept. */
  report: IShiftReport | null;
}
