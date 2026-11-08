import { describe, expect, test } from "vitest";
import { rateOptions, scopeOf, placeIdsOf, tiersOf } from "./vipMinimumCharge";
import type { IBillingSettings } from "@/api/joystickPrices";

/**
 * Which price the owner's example is worked at. It used to be "the first VIP
 * price found", which in a real branch was the PC VIP rate (12) while every
 * VIP seat was a PS5 (1500): an example nobody's seat would bill. Since
 * 2026-11-06 the rule may cover standard seats too, so the tiers in scope
 * decide which prices are offered.
 */
describe("rateOptions", () => {
  const name = (slug: string) => slug.toUpperCase();
  const matrix = { pc: 7, "pc-vip": 12, "pc-standard": 6, ps4: 9, "ps4-vip": 14, ps5: 1000, "ps5-vip": 1500, "ps5-standard": 1000 };
  const seat = (platform: string, type = "vip", status = "active") => ({ platform, type, status });

  test("VIP by default: the platform with the VIP seats comes first", () => {
    const options = rateOptions(matrix, [], [seat("ps5"), seat("ps5"), seat("pc", "standard")], name);
    expect(options[0]).toEqual({ key: "ps5-vip", slug: "ps5", tier: "vip", label: "PS5", rate: 1500, seats: 2 });
    expect(options.map((o) => o.key)).toEqual(["ps5-vip", "pc-vip", "ps4-vip"]);
  });

  test("standard: standard prices only, counted by standard seats", () => {
    const options = rateOptions(matrix, [], [seat("ps5"), seat("pc", "standard")], name, ["standard"]);
    expect(options.map((o) => [o.key, o.rate, o.seats])).toEqual([["pc-standard", 6, 1], ["ps5-standard", 1000, 0]]);
  });

  test("both tiers: every set price of either", () => {
    expect(rateOptions({ "ps5-vip": 1500, "ps5-standard": 1000 }, [], [], name, ["vip", "standard"]).map((o) => o.key))
      .toEqual(["ps5-vip", "ps5-standard"]);
  });

  test("an inactive seat does not count; unset and zero prices are not offered", () => {
    const options = rateOptions({ "pc-vip": 0, "ps5-vip": null, "ps4-vip": "14" }, [], [seat("ps4", "vip", "inactive")], name);
    expect(options).toEqual([{ key: "ps4-vip", slug: "ps4", tier: "vip", label: "PS4", rate: 14, seats: 0 }]);
  });

  test("a venue's own platform is priced from its row, per tier", () => {
    const rows = [{ platform: "poker", price_vip: "2500", price_standard: "1200" }];
    expect(rateOptions({}, rows, [seat("poker")], name, ["vip", "standard"]).map((o) => [o.key, o.rate]))
      .toEqual([["poker-vip", 2500], ["poker-standard", 1200]]);
  });
});

describe("the scope", () => {
  const s = (over: Partial<IBillingSettings>) => over as IBillingSettings;

  test("a branch that never chose covers VIP; an unknown value too", () => {
    expect(scopeOf(s({}))).toBe("vip");
    expect(scopeOf(s({ vip_min_charge_scope: null }))).toBe("vip");
    expect(scopeOf(s({ vip_min_charge_scope: "weekly" as never }))).toBe("vip");
    expect(scopeOf(s({ vip_min_charge_scope: "places" }))).toBe("places");
  });

  test("the chosen seats as positive whole ids", () => {
    expect(placeIdsOf(s({ vip_min_charge_place_ids: [3, 0, -1, 5] }))).toEqual([3, 5]);
    expect(placeIdsOf(s({}))).toEqual([]);
  });

  test("the tiers a scope reaches", () => {
    const places = [{ id: 1, type: "vip" }, { id: 2, type: "standard" }];
    expect(tiersOf("all", places, [])).toEqual(["vip", "standard"]);
    expect(tiersOf("vip", places, [])).toEqual(["vip"]);
    expect(tiersOf("standard", places, [])).toEqual(["standard"]);
    expect(tiersOf("places", places, [2])).toEqual(["standard"]);
    expect(tiersOf("places", places, [])).toEqual([]);
  });
});
