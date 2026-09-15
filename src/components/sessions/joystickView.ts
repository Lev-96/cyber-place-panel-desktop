import { MAX_JOYSTICKS } from "@/api/joystickPrices";
import { sessionJoysticksTotal } from "./sessionAmount";
import type { IJoystickRule, ISessionApi } from "@/types/sessions";

/**
 * What the screens say about a seat's extra joysticks.
 *
 * ## Why this is one module and not three copies
 *
 * The board and the history both answer "which pads were charged, at what unit
 * figure, and is that figure a rate" — and they answered it twice, in two files,
 * with the same nine lines. They drifted once already: the history learned to
 * mark an hourly unit price as a rate a week after the board did, and for those
 * days one screen called 500 a fee and the other called it 500/h for the same
 * session.
 *
 * Nothing here computes money. `sessionJoysticksTotal` is the one mirror of the
 * server's arithmetic and this reads it; everything else in this file is about
 * WHICH pads and HOW to name them.
 *
 * ## The three concepts, kept apart on purpose
 *
 * A slot number is an IDENTITY — "the third controller" — and never a quantity.
 * `slots` is the deduped list of identities, `count` is how many charged periods
 * there were, and they differ the moment one pad is handed out twice. Mixing
 * them is what produced "3 × 500 = 1500" for a single third controller.
 */

/** What a seat's charged pads amount to, and how that figure should be read. */
export interface IPadCharge {
  /** WHICH pads, by number, deduped and in order. A slot is an identity. */
  slots: number[];
  /** How many charged PERIODS there were. One slot used twice counts twice. */
  count: number;
  /** The unit figure, only when every charged period agrees on one. */
  each: number | null;
  total: number;
  /** True when that unit figure is a RATE per hour rather than a one-off fee. */
  hourly: boolean;
}

/**
 * The pad line of a session, live or finished.
 *
 * `hourly` is read from the ROWS and never from the branch as it stands today: a
 * session that ran under the fee model is still a fee-model session after the
 * owner switches the venue, and a screen that re-read the branch would re-label
 * a bill that was already taken. Mixed rows read as the fee model, because the
 * unit price the line quotes is only a rate when every charged period is one.
 *
 * Null on a waived seat and when nothing was charged: a fee printed under "Free
 * session" is two numbers telling one truth.
 */
export const padChargeOf = (session: ISessionApi): IPadCharge | null => {
  if (session.is_free) return null;

  const charged = (session.joysticks ?? []).filter((j) => j.is_charged);
  if (charged.length === 0) return null;

  const first = Number(charged[0].price ?? 0);
  const uniform = charged.every((j) => Number(j.price ?? 0) === first);

  return {
    slots: [...new Set(charged.map((j) => Number(j.slot)))].sort((a, b) => a - b),
    count: charged.length,
    each: uniform ? first : null,
    total: sessionJoysticksTotal(session),
    hourly: charged.every((j) => j.is_hourly === true),
  };
};

/**
 * How many controllers THIS seat counts to.
 *
 * The venue's own ceiling, not this repo's constant: a branch that hands out
 * three controllers must read "3" and not "4". Null when the server did not send
 * the rule, and the caller then falls back to what a seat can physically hold —
 * the number the card drew before the rule travelled with it.
 */
export const padCeiling = (session: ISessionApi): number | null =>
  session.joystick_rule?.max_slot ?? null;

/** One entry of the "which joystick" menu on a tile. */
export interface PadChoice {
  /** The slot this entry hands out. For a shared pair, the next free one of it. */
  slot: number;
  /** True when this entry stands for the 3/4 pair the venue priced as one. */
  shared: boolean;
  /** The venue's figure. Null means no price is set and the add is refused. */
  price: number | null;
  /** Selectable right now: it is the pad that comes next on this seat. */
  enabled: boolean;
  /**
   * Already handed over on THIS seat.
   *
   * Told apart from "not selectable" on purpose: a cashier looking at a greyed
   * entry needs to know whether the pad is in somebody's hands or simply not
   * next, and those are different things to do about it.
   */
  taken: boolean;
}

/**
 * The pads a cashier may hand out on this seat, from the VENUE's rule.
 *
 * It was a list of target COUNTS built from a ceiling constant in this repo, and
 * it could not survive a venue that hands out three controllers or prices the
 * fourth apart from the third: the same "4" meant a different amount of money at
 * two branches and the card had no way to know.
 *
 * ## Why the pair collapses
 *
 * When a venue prices the third and the fourth as one figure ("3/4"), listing
 * them apart shows the same price twice and asks the cashier a question the
 * venue did not ask them: which of two identical things. One entry, and the slot
 * it opens is whichever of the pair comes next.
 *
 * ## Why everything else is disabled rather than absent
 *
 * A fourth controller with no third one is not a thing a floor does, and the
 * server refuses it. Showing the entry greyed keeps the venue's prices visible
 * to the cashier while making the mis-click that charges the fourth pad's fee
 * for the third pad's use impossible.
 */
export const padChoices = (rule: IJoystickRule | undefined, openSlots: number[]): PadChoice[] => {
  if (rule === undefined) return [];

  const free = rule.options
    .map((o) => o.slot)
    .filter((slot) => !openSlots.includes(slot))
    .sort((a, b) => a - b);
  const next = free.length > 0 ? free[0] : null;

  const out: PadChoice[] = [];
  let pairDone = false;

  for (const option of rule.options) {
    if (option.shared) {
      if (pairDone) continue;
      pairDone = true;

      const pairFree = rule.options
        .filter((o) => o.shared && !openSlots.includes(o.slot))
        .map((o) => o.slot)
        .sort((a, b) => a - b);
      const slot = pairFree.length > 0 ? pairFree[0] : option.slot;

      out.push({
        slot,
        shared: true,
        price: option.price,
        enabled: slot === next,
        // The pair is taken only when NEITHER position is free: one of two is
        // still a pad this venue can hand over.
        taken: pairFree.length === 0,
      });
      continue;
    }

    out.push({
      slot: option.slot,
      shared: false,
      price: option.price,
      enabled: option.slot === next,
      taken: openSlots.includes(option.slot),
    });
  }

  return out;
};

/**
 * What to print beside the joystick icon.
 *
 * The seat's base kit is a COUNT — two controllers come with a PlayStation and
 * nobody hands them over — so a seat with no extras out reads "2". The moment an
 * extra is in play the interesting fact stops being how many there are and
 * becomes WHICH ones, so the line names them: "3", "4", "3, 4", or "3/4" where
 * the venue prices the pair as one.
 *
 * That is the whole of the rule, and it is here rather than in the tile because
 * the receipt and the history ask the same question about the same seat.
 *
 * @param baseKit how many controllers the seat came with
 */
export const padIdentity = (session: ISessionApi, baseKit: number): string => {
  const open = (session.joysticks ?? []).filter((j) => j.stopped_at === null);
  const extras = open.filter((j) => Number(j.slot) > baseKit);

  if (extras.length === 0) return String(session.joystick_count ?? baseKit);

  // A venue that prices the pair as one figure calls it "3/4", and so does the
  // card — naming the position it happens to have opened would tell the cashier
  // something the venue deliberately did not distinguish.
  const pairIsShared = session.joystick_rule?.shared === true;
  const slots = [...new Set(extras.map((j) => Number(j.slot)))].sort((a, b) => a - b);

  if (pairIsShared && slots.every((s) => s >= 3)) {
    return slots.length > 1 ? slots.join(", ") : "3/4";
  }

  return slots.join(", ");
};

/** What a seat can physically hold, for callers with no rule to read. */
export const PAD_CEILING_FALLBACK = MAX_JOYSTICKS;
