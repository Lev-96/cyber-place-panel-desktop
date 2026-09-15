import { describe, expect, test } from "vitest";
import { padCeiling, padChargeOf, padChoices, padIdentity } from "./joystickView";
import type { IJoystickRule, ISessionApi } from "@/types/sessions";

/**
 * What the screens say about a seat's extra joysticks.
 *
 * The board and the history both used to answer this, in two files, from the
 * same nine lines — and they drifted: for a few days one screen called an
 * hourly unit price a fee and the other called it a rate, for the same session.
 * These pin the single answer they now share.
 *
 * The rule the whole file turns on: a slot number is an IDENTITY and never a
 * quantity. "3" is the third controller, not three controllers.
 */

const RULE: IJoystickRule = {
  included: 2,
  price: 500,
  price_4: null,
  max: 4,
  max_slot: 4,
  charged_slots: [3, 4],
  hourly: false,
  shared: true,
  options: [
    { slot: 3, price: 500, shared: true },
    { slot: 4, price: 500, shared: true },
  ],
};

const separate: IJoystickRule = {
  ...RULE,
  shared: false,
  options: [
    { slot: 3, price: 500, shared: false },
    { slot: 4, price: 700, shared: false },
  ],
};

const pad = (over: Record<string, unknown> = {}) => ({
  id: 1, slot: 3, price: 500, is_charged: true, is_hourly: false,
  started_at: "2026-09-01T10:00:00.000Z", stopped_at: null,
  ...over,
});

const session = (over: Partial<ISessionApi> = {}): ISessionApi => ({
  id: 1, branch_id: 1, pc_id: 1, status: "active", mode: "open",
  started_at: "2026-09-01T10:00:00.000Z", total_paid: 0, is_free: false,
  joystick_count: 2, joystick_rule: RULE,
  ...over,
} as ISessionApi);

describe("what the icon says", () => {
  test("an untouched seat says how many controllers it came with", () => {
    expect(padIdentity(session({ joysticks: [] }), 2)).toBe("2");
  });

  /** The base kit is a count; the extras are identities. */
  test("a seat with no extras out never names a slot", () => {
    // A legacy row inside the kit is not an extra and must not be named.
    const s = session({ joysticks: [pad({ slot: 2 })] } as Partial<ISessionApi>);

    expect(padIdentity(s, 2)).toBe("2");
  });

  /** A venue that prices the pair as one figure calls it 3/4, and so do we. */
  test("a shared pair is named 3/4, not the position it happened to open", () => {
    const s = session({ joysticks: [pad({ slot: 3 })] } as Partial<ISessionApi>);

    expect(padIdentity(s, 2)).toBe("3/4");
    expect(padIdentity(s, 2)).not.toBe("3");
  });

  test("…including when the fourth position is the one that opened", () => {
    const s = session({ joysticks: [pad({ slot: 4 })] } as Partial<ISessionApi>);

    expect(padIdentity(s, 2)).toBe("3/4");
  });

  /** Priced apart, the positions are the fact, and they are named. */
  test("separately priced pads are named by their own numbers", () => {
    const s = session({
      joystick_rule: separate,
      joysticks: [pad({ slot: 3 })],
    } as Partial<ISessionApi>);

    expect(padIdentity(s, 2)).toBe("3");
  });

  test("two of them read as a list, not as a count", () => {
    const s = session({
      joystick_rule: separate,
      joysticks: [pad({ id: 1, slot: 4 }), pad({ id: 2, slot: 3 })],
    } as Partial<ISessionApi>);

    expect(padIdentity(s, 2)).toBe("3, 4");
    expect(padIdentity(s, 2)).not.toBe("2");
  });

  /** A pad handed back is not in play and stops being named. */
  test("a returned pad is no longer named", () => {
    const s = session({
      joystick_count: 2,
      joysticks: [pad({ slot: 3, stopped_at: "2026-09-01T10:30:00.000Z" })],
    } as Partial<ISessionApi>);

    expect(padIdentity(s, 2)).toBe("2");
  });
});

describe("what the pads cost", () => {
  test("a waived seat quotes nothing", () => {
    expect(padChargeOf(session({ is_free: true, joysticks: [pad()] } as Partial<ISessionApi>))).toBeNull();
  });

  test("a seat charged for nothing quotes nothing", () => {
    expect(padChargeOf(session({ joysticks: [pad({ is_charged: false })] } as Partial<ISessionApi>))).toBeNull();
  });

  /** The same slot twice is ONE identity and TWO periods. */
  test("identity and quantity are different numbers", () => {
    const charge = padChargeOf(session({
      joysticks: [
        pad({ id: 1, slot: 3, stopped_at: "2026-09-01T10:10:00.000Z" }),
        pad({ id: 2, slot: 3, stopped_at: "2026-09-01T10:20:00.000Z" }),
      ],
    } as Partial<ISessionApi>));

    expect(charge?.slots).toEqual([3]);
    expect(charge?.count).toBe(2);
  });

  test("periods that disagree on a price quote no unit figure", () => {
    const charge = padChargeOf(session({
      joysticks: [pad({ id: 1, slot: 3 }), pad({ id: 2, slot: 4, price: 700 })],
    } as Partial<ISessionApi>));

    expect(charge?.each).toBeNull();
    expect(charge?.slots).toEqual([3, 4]);
  });

  test("a rate is only a rate when every charged period is one", () => {
    const mixed = padChargeOf(session({
      joysticks: [pad({ id: 1, is_hourly: true }), pad({ id: 2, slot: 4, is_hourly: false })],
    } as Partial<ISessionApi>));

    expect(mixed?.hourly).toBe(false);
  });
});

describe("what may be handed over next", () => {
  test("a venue with no rule offers nothing", () => {
    expect(padChoices(undefined, [])).toEqual([]);
  });

  /** One entry for a shared pair, not the same price listed twice. */
  test("a shared pair is one entry", () => {
    const choices = padChoices(RULE, []);

    expect(choices).toHaveLength(1);
    expect(choices[0].shared).toBe(true);
    expect(choices[0].slot).toBe(3);
    expect(choices[0].enabled).toBe(true);
  });

  test("the pair stays offered while either position is free", () => {
    const choices = padChoices(RULE, [3]);

    expect(choices[0].taken).toBe(false);
    expect(choices[0].slot).toBe(4);
  });

  test("…and is taken only when both are out", () => {
    expect(padChoices(RULE, [3, 4])[0].taken).toBe(true);
  });

  /** Priced apart, each position answers for itself. */
  test("a taken position says so and the free one does not", () => {
    const choices = padChoices(separate, [3]);
    const third = choices.find((c) => c.slot === 3);
    const fourth = choices.find((c) => c.slot === 4);

    expect(third?.taken).toBe(true);
    expect(third?.enabled).toBe(false);
    expect(fourth?.taken).toBe(false);
    expect(fourth?.enabled).toBe(true);
  });

  /** Skipping is impossible: only the pad that comes next may be picked. */
  test("the fourth cannot be picked before the third", () => {
    const choices = padChoices(separate, []);

    expect(choices.find((c) => c.slot === 3)?.enabled).toBe(true);
    expect(choices.find((c) => c.slot === 4)?.enabled).toBe(false);
  });
});

describe("how far the seat counts", () => {
  test("the venue's ceiling, when it sent one", () => {
    expect(padCeiling(session({ joystick_rule: { ...RULE, max_slot: 3 } } as Partial<ISessionApi>))).toBe(3);
  });

  test("null when it did not, so the caller can fall back", () => {
    expect(padCeiling(session({ joystick_rule: undefined } as Partial<ISessionApi>))).toBeNull();
  });
});
