/**
 * Time-windowed discount on a single (platform, tier) per-hour rate.
 * The full rate stays in `price_for_branch`; promos are overlay-only
 * data, never overwriting the canonical price.
 *
 * `is_currently_active` is server-computed (Asia/Yerevan timezone +
 * weekday-aware) so every client renders the same answer without
 * inventing its own date math.
 */
export type PromoPlatform = "pc" | "ps4" | "ps5";
export type PromoTier = "standard" | "vip";

export interface IBranchPricePromo {
  id: number;
  branch_id: number;
  platform: PromoPlatform;
  tier: PromoTier;
  discounted_price: number | string;  // backend returns decimal:2 as string in some drivers
  start_time: string;                  // "HH:MM" or "HH:MM:SS"
  end_time: string;
  days_of_week: number[];              // ISO 1..7 (Mon..Sun)
  is_active: boolean;
  is_currently_active?: boolean;       // server-computed, optional in case an older
                                        // backend deploy hasn't shipped the accessor yet
  created_at?: string;
  updated_at?: string;
}
