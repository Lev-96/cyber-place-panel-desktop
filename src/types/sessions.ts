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
 * Not a count on the session, and the distinction is the whole feature: the
 * same slot handed out twice in an evening is two separate uses, each judged
 * on its own length. What a use COSTS is a flat fee — owed in full once the
 * period passes the server's threshold, owed not at all below it — so nothing
 * on this side ever multiplies `price` by a duration.
 */
/** One pad the venue hands out, with the figure the server will charge for it. */
export interface IJoystickRuleOption {
  /** 2..4. The slot IS the controller's number, the seat's own included. */
  slot: number;
  /** Null means this venue has no price for it and the add will be refused. */
  price: number | null;
  /**
   * True when this pad shares one figure with the other extra pad, which is
   * the "3/4" answer on the Prices screen. The card collapses the pair into a
   * single option when it is set, and names them apart when it is not.
   */
  shared: boolean;
}

export interface IJoystickRule {
  included: number;
  price: number | null;
  price_4: number | null;
  /** What a SEAT can physically hold. Not configurable. */
  max: number;
  /** What THIS venue hands out, which is the number the card counts to. */
  max_slot: number;
  charged_slots: number[];
  hourly: boolean;
  shared: boolean;
  /**
   * True when the fee is owed ONCE for the whole session rather than per
   * handout — the shape a club means by "one payment for extra controllers".
   */
  charge_once?: boolean;
  /**
   * …and whether it has already been taken on THIS seat.
   *
   * The server's answer, not a count of rows done here: the options below are
   * already priced at zero when it is true, and the card says "already charged"
   * so that a zero reads as a rule rather than as a mistake.
   */
  fee_taken?: boolean;
  options: IJoystickRuleOption[];
}

export interface ISessionJoystick {
  id: number;
  /** 2..4. Slot 1 is the session itself and never appears here. */
  slot: number;
  /** The flat fee for this use, frozen when the pad went out. Not a rate. */
  price: number;
  /**
   * Whether this period is on the bill — the SERVER's answer, never inferred.
   *
   * A pad that has been handed back is still charged: removal ends the use, it
   * is not a refund. Only rows from before that rule carry `false`. Absent on
   * an older payload, and then the tile counts nothing rather than guessing.
   */
  is_charged?: boolean;
  /**
   * Whether `price` is a rate per hour or a one-off fee.
   *
   * Snapshotted on the row when the pad was handed out, so a venue that
   * switches models mid session cannot move what a pad already out costs.
   * Absent on an older backend, which only ever charged the one-off fee.
   */
  is_hourly?: boolean;
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
  /**
   * The rate this session would carry on at if its end were removed, resolved
   * by the SERVER through the same ladder the switch itself applies.
   *
   * `hourly_rate` above cannot answer that: a fixed session's column is null by
   * design, because its rate is implied by the package (price ÷ duration × 60).
   * Reading that column with a `?? 0` fallback is exactly how a 1500/hour
   * tariff came to be offered as "0 драм/ч".
   *
   * `null` means no rate could be derived at all — no package, no configured
   * price for the seat. Render that as the refusal it is; the server refuses
   * the switch in the same case.
   */
  tariff_hourly_rate?: number | null;
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
  /**
   * Paused since this instant; null while the clock runs. The session stays
   * `active` while paused — the seat stays taken and a console stays awake —
   * so nothing that asks "is this seat in use" changes; only the clock stops.
   * Optional so an older backend reads as "never paused".
   */
  paused_at?: string | null;
  /**
   * Every stretch the clock was stopped. The ticking figures subtract these
   * exactly as the bill does (`pausedSecondsBetween` in sessionAmount.ts).
   */
  pauses?: Array<{ paused_at: string; resumed_at: string | null }>;
  total_paid: number;
  /**
   * How the money was taken when the session was stopped.
   *
   * ⚠️ Optional and nullable, and both matter. NULL is every session stopped
   * before this was recorded and every session still running; the history
   * renders nothing for it rather than inventing a method.
   */
  payment_method?: "cash" | "card" | "other" | null;
  /** The words the cashier typed. Only ever set when the method is `other`. */
  payment_method_other?: string | null;
  opened_by_user_id?: number | null;
  items?: Array<{
    id: number;
    name: string;
    price: number | string;
    qty: number;
    product_id: number | null;
    /**
     * The room's own extra, billed BY THE HOUR rather than by the piece.
     *
     * Absent on every catalogue line and on every line sold before the room
     * had the choice, which is why the mirror reads it as false by default:
     * `price × qty` is the old arithmetic and must stay exactly that.
     */
    is_extra?: boolean;
    is_hourly?: boolean;
    /** Minutes this hourly line has been running, as the server counted them. */
    minutes?: number | null;
    /**
     * When it was handed back, if it was. Null is "still out and still on the
     * clock" — this table's `stopped_at`.
     */
    returned_at?: string | null;
    /**
     * When it was handed over. This table's `started_at`, and what lets the
     * panel tick a rented line instead of waiting for the next poll.
     */
    created_at?: string | null;
    /** What the server says this line costs right now. */
    line_total?: number | string;
  }>;

  /**
   * The tariff a fixed session was started on, when the backend loaded it.
   *
   * Present on the sessions listing, which eager-loads `timePackage` with
   * `duration_minutes` and `price` — the two columns a fixed session's hourly
   * rate is derived from, since `hourly_rate` stays null until somebody makes
   * the session unlimited. {@see sessionTimeCostAt}.
   */
  time_package?: ITimePackage | null;

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
  /**
   * The venue's joystick rule as it applies to THIS seat: which pads it hands
   * out and what each costs.
   *
   * From the server, and only from the server. The card used to build its
   * control from a ceiling constant of its own and a single fee, which draws a
   * button for a pad the branch does not hand out and cannot show two prices
   * when the venue set two. Absent when the server did not load the relations
   * it needs, and the card then falls back to what it can draw safely.
   */
  joystick_rule?: IJoystickRule;
  /**
   * WHICH strategy this seat froze when it started, if it froze one.
   *
   * Null on a session started before the club could offer a choice; the venue's
   * own answer then applies, resolved server-side when a pad is handed out.
   */
  joystick_strategy?: "fixed" | "hourly" | null;
  /**
   * The venue's rounding policy, so a ticking figure can land where the
   * receipt does. 0 is "no policy", which is what every branch starts on.
   */
  rounding_step?: number;
  rounding_mode?: "up" | "nearest" | "down";
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
  /**
   * Whether CHIPS mean anything on this seat — a poker table and nothing else.
   *
   * From the server, which refuses the sale on the same answer. Absent or null
   * on a payload that did not load the place, and the control is then not
   * drawn: a missing field must not offer an operation the seat cannot take.
   */
  supports_chips?: boolean | null;
  /**
   * What THIS seat hands out besides itself, when its room configured one.
   *
   * One object or null rather than a flag plus a name: a control asking "may
   * I sell an extra here" and "what is it called" separately has two ways to
   * be half-drawn. Null is every PlayStation, every PC and every room nobody
   * configured — and also a payload that did not load the place, which is the
   * same instruction either way: do not offer the control.
   *
   * `unit_price` is what the NEXT hand-out costs, so a button can quote a
   * figure; on a seat that charges once for the session it is "0.00" as soon
   * as `fee_taken` is true, while `price` still reports what the charge was.
   */
  extra_item?: IExtraItem | null;
  /** The seat's platform slug, so a refusal can name it rather than just say no. */
  place_platform?: string | null;
}

/** The room's own extra, as the server resolves it for one session. */
export interface IExtraItem {
  name: string;
  price: string;
  charge_mode: "each" | "once";
  /**
   * A fee per piece, or a RATE per hour per piece — the same second question
   * a pad answers. Absent on a server that predates the choice, and read as
   * "fixed" there.
   */
  pricing_mode?: "fixed" | "hourly";
  fee_taken: boolean;
  unit_price: string;
  max_qty: number;
  /**
   * How many units the ROOM's rate already covers, the way
   * `branches.joystick_included` covers a pad: the first N handed out on a
   * session are free and everything past N is charged. `0` is "none of
   * them", which is what every room is until somebody sets one.
   *
   * Optional because a server that predates the allowance omits it, and the
   * absence must read as today's behaviour - every unit charged - rather than
   * as a room giving its first hand-out away.
   */
  included?: number;
  /**
   * How many of those are still free on THIS session, after what has already
   * gone out. The SERVER counts them; the panel only quotes what it is told,
   * which is what keeps the dialog and the receipt on one figure.
   */
  included_remaining?: number;
  /**
   * May the board hand ONE more over right now — the server's answer. False
   * after a FIXED room's one sale per session, or when the room's ceiling is
   * reached; the button is greyed then. Absent on an older server, which
   * never refused a second hand-out.
   */
  can_hand_out?: boolean;
  /**
   * The line the button would hand BACK, or null when there is none — only
   * ever something on a clock, never a fixed sale. Absent on an older server,
   * and the board then falls back to "the first extra line not returned".
   */
  return_item_id?: number | null;
}

export interface IPcApi extends Translated {
  id: number;
  branch_id: number;
  place_id?: number | null;
  label: string;
  kind?: PcKind;
  hourly_rate?: number | string | null;
  /**
   * What an hour on this seat actually costs, resolved BY THE SERVER with the
   * same service the session start uses.
   *
   * The Start dialog used to work this out from the tariff matrix plus this
   * device's own rate, and could not do better: the place arrives without its
   * rate, so a subcategory like "PS5 + VR" was invisible to the panel. It
   * offered the plain platform price while the server billed the
   * subcategory's, and on a platform priced only through a subcategory it
   * refused to start at all.
   *
   * Optional so a panel talking to an older backend falls back to the chain it
   * always had rather than showing nothing.
   */
  assigned_hourly_rate?: number | null;
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
