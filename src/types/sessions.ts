/**
 * Sessions / time-billing types. The backend Laravel migrations
 * `sessions` and `time_packages` are still pending — until they exist,
 * the cashier UI runs against a local mock implementation that conforms
 * to these shapes. Same shapes will work against the real REST endpoints
 * when they ship.
 */

import { PcKind, PcStatus } from "@/types/pc";
import { Translated } from "@/i18n/translated";

export interface ITimePackage {
  id: number;
  branch_id?: number;
  /**
   * Per-locale labels — backend stores three separate columns matching
   * the `name_en/name_ru/name_am` convention. Render sites
   * resolve the right one via {@link timePackageNameOf}; never read a
   * single locale directly so a future fallback (e.g. en → ru) stays
   * centralised.
   */
  name_en: string;
  name_ru: string;
  name_am: string;
  duration_minutes: number;
  price: number;
  /** Soft-disabled packages stay in DB for historical sessions but don't show in pickers. */
  is_active?: boolean;
  /**
   * Target platform for this tariff. `null` means "applies to all
   * platforms". Mobile durationSelect filters tariffs server-side via
   * the `?platform=` query parameter — NULL-platform rows always
   * match, specific-platform rows match exactly.
   */
  platform?: "pc" | "ps4" | "ps5" | null;
  /**
   * Optional time-windowed discount. All four columns are nullable as
   * an atomic group: when any is null, no discount applies. Backend
   * normalizes the group on every write, so clients can rely on
   * "either all four are set, or all four are null".
   */
  discount_price?: number | string | null;
  discount_start_time?: string | null;   // "HH:MM" or "HH:MM:SS"
  discount_end_time?: string | null;
  discount_days_of_week?: number[] | null; // ISO 1..7
  /** Server-computed via TimePackage::isDiscountCurrentlyActive accessor. */
  is_discount_currently_active?: boolean;
  /** Server-computed: the discount price IF the window is live, otherwise null. */
  discounted_price_now?: number | string | null;
}

/**
 * One period a single extra joystick was in play.
 *
 * Not a count on the session, and the distinction is the whole feature: three
 * pads on a three-hour session does not mean three pads for three hours. The
 * player who joined at 15:00 pays from 15:00.
 */
export interface ISessionJoystick {
  id: number;
  /** 2..4. Slot 1 is the session itself and never appears here. */
  slot: number;
  hourly_rate: number;
  started_at: string;
  /** null while the pad is still in play. */
  stopped_at: string | null;
}

export interface ISessionApi {
  id: number;
  branch_id: number;
  pc_id: number;
  pc_label: string;
  user_display_name?: string;
  package_id?: number;
  package_name?: string;
  mode?: "fixed" | "open";
  hourly_rate?: number | string | null;
  started_at: string;   // ISO
  ends_at: string | null;      // ISO; null for open (count-up) sessions
  /**
   * When the session was actually stopped. `null` while it is running.
   *
   * Distinct from `ends_at`, which for a fixed package is when the time was
   * due to run out — the history page reads THIS one, because a session the
   * cashier closed early ended when they closed it.
   *
   * Optional like its neighbours below: the backend always sends it, but the
   * fixtures in this repo build sessions field by field and should not have to
   * carry a column they are not asserting on.
   */
  stopped_at?: string | null;
  status: "active" | "stopped" | "expired";
  total_paid: number;
  opened_by_user_id?: number | null;
  items?: Array<{ id: number; name: string; price: number | string; qty: number; product_id: number | null }>;

  /* ---- added 2026-09-03; every field above is unchanged ---------------- */

  /**
   * The bill is waived. The clock keeps running and the session still counts
   * — it is simply worth 0, which is what `total_paid` will say when it stops.
   * Optional so a panel talking to an older backend degrades to "not free".
   */
  is_free?: boolean;
  /** No end: started in count-up mode, or an operator lifted the ceiling. */
  is_unlimited?: boolean;
  unlimited_at?: string | null;
  /**
   * The block that was SOLD, and where it ends. For an unlimited session this
   * is the boundary the hourly overflow is measured from — `ends_at` is null
   * there and cannot say it.
   */
  committed_until?: string | null;
  committed_amount?: number | string | null;
  /** Pads in play INCLUDING the session's own. 1 is the floor, never 0. */
  joystick_count?: number;
  /** Every period, closed ones included. Present when the relation is loaded. */
  joysticks?: ISessionJoystick[];
  /** Who opened it — the owner's "which of my managers ran this?". */
  opened_by?: { id: number; name: string; role: string } | null;
  /**
   * Who ended it. `null` is a FACT rather than a missing field: the session is
   * still running, or the kiosk agent expired it when its paid time ran out and
   * no person closed it at all.
   *
   * Never resolved from the current user. A session that crossed a shift change
   * was started by one person and stopped by another, and the person reading
   * this page is routinely a third.
   */
  stopped_by_user_id?: number | null;
  stopped_by?: { id: number; name: string; role: string } | null;
  /**
   * The venue this session ran at, as it was at the time. Present on the
   * history listing; an owner reads one list across several branches and each
   * line has to name its own.
   */
  branch?: {
    id: number;
    address: string;
    city: string | null;
    company_id: number;
    company_name: string | null;
  } | null;
  /**
   * Whether extra joysticks mean anything on this seat, decided by the
   * backend against the place's platform. `null`/absent when the relation was
   * not loaded — the caller then falls back to what it can see itself.
   *
   * This exists so the panel stops holding a second copy of a backend rule:
   * deriving it from a separately-loaded device list goes wrong the moment
   * that list is stale, and it goes wrong by silently hiding the controls.
   */
  supports_joysticks?: boolean | null;
  /** The seat's platform slug, so a refusal can name it rather than just say no. */
  place_platform?: string | null;
}

export interface IPcApi extends Translated {
  id: number;
  branch_id: number;
  place_id?: number | null;
  label: string;
  kind?: PcKind;
  hourly_rate?: number | string | null;
  mac_address?: string | null;
  /**
   * The physical console this device stands for, once an owner has bound one
   * from the console finder. Null on every computer, and on every console
   * nobody has pointed at yet — which is the normal state, not an error.
   *
   * Optional so a panel talking to a backend from before the binding existed
   * degrades to "nothing bound" instead of breaking.
   */
  console_host_id?: string | null;
  /** Last address it answered from. A hint the panel probes first, and allowed to be stale. */
  console_address?: string | null;
  /**
   * Until when the "a console with no session must be asleep" rule is suspended
   * for this device, or null. An owner opens the window; it closes on its own.
   */
  maintenance_until?: string | null;
  /**
   * EFFECTIVE availability, not the raw column — the backend already folds in
   * "a console has no agent to report in" and "this computer's heartbeat went
   * stale" (`App\Models\Pcs\Pc::effectiveStatus()`).
   */
  status: PcStatus;
  /**
   * Server verdict on whether a session may be started on this device.
   * Optional so an older backend that doesn't send it yet degrades to the
   * client-side rule in `isDeviceStartable`.
   */
  is_startable?: boolean;
  last_seen_at?: string | null;
  pairing_token?: string; // present only on create / rotate-token responses
  current_session_id?: number;
  // Eager-loaded by PcController (`place:id,number,type,platform`).
  // Lets the cashier UI resolve the assigned tariff via the branch
  // price matrix without an extra round-trip.
  //
  // Carries `Translated` because a place's `name` is auto-translated like any
  // other staff-authored text: the sessions board must render it in the
  // viewer's language, not in whichever language the manager who created it
  // happened to type.
  place?: (Translated & {
    id: number;
    number?: number | null;
    name?: string | null;
    type: "standard" | "vip";
    platform: string;
  }) | null;
}
