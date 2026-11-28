/**
 * Ratings after a visit (2026-11-27, owner).
 *
 * The PLAYER rates the club in Club Card: stars, then the tags (3–5 what was
 * good, 1–2 what went wrong) and words. The codes below mirror the server's
 * `BonusRating::TAGS` and are only NAMED here: the staff read them in their
 * notices and on the card list.
 *
 * The CLUB rates the player here with stars only; at 1 star the reason is
 * required ({@link CLUB_REASON_UP_TO}).
 */
export const PLAYER_TAGS = {
  good: ["fast_pcs", "smooth_net", "clean", "friendly_staff", "comfy_seats", "great_vibe", "fair_prices", "fresh_games"],
  bad: ["laggy_pcs", "slow_net", "dirty", "rude_staff", "broken_gear", "noisy", "payment_trouble", "long_wait"],
} as const;

/** Up to these stars the club writes the reason (the server says the same). */
export const CLUB_REASON_UP_TO = 1;
export const COMMENT_MAX = 500;
/** The most bonuses one rating may give (the server's `BonusRating::GIFT_MAX`). */
export const GIFT_MAX = 100000;
/** A gift only from these stars up (the server's `BonusRating::GIFT_FROM`). */
export const GIFT_FROM = 3;

/** One tag's name, in the screen's language. */
export const tagLabel = (t: (k: string) => string, code: string) => {
  const s = t(`rating.tag.${code}`);
  return s === `rating.tag.${code}` ? code : s;
};
