/**
 * Sessions / time-billing types. The backend Laravel migrations
 * `sessions` and `time_packages` are still pending — until they exist,
 * the cashier UI runs against a local mock implementation that conforms
 * to these shapes. Same shapes will work against the real REST endpoints
 * when they ship.
 */

export interface ITimePackage {
  id: number;
  branch_id?: number;
  /**
   * Per-locale labels — backend stores three separate columns matching
   * the `services.name_en/name_ru/name_am` convention. Render sites
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
  status: "active" | "stopped" | "expired";
  total_paid: number;
  items?: Array<{ id: number; name: string; price: number | string; qty: number; product_id: number | null }>;
}

export interface IPcApi {
  id: number;
  branch_id: number;
  place_id?: number | null;
  label: string;
  kind?: "pc" | "ps";
  hourly_rate?: number | string | null;
  mac_address?: string | null;
  status: "online" | "offline" | "in_session";
  last_seen_at?: string | null;
  pairing_token?: string; // present only on create / rotate-token responses
  current_session_id?: number;
  // Eager-loaded by PcController (`place:id,number,type,platform`).
  // Lets the cashier UI resolve the assigned tariff via the branch
  // price matrix without an extra round-trip.
  place?: {
    id: number;
    number?: number | null;
    type: "standard" | "vip";
    platform: "pc" | "ps4" | "ps5";
  } | null;
}
