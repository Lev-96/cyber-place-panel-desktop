import { describe, expect, test } from "vitest";
import { vipRateOptions } from "./vipMinimumCharge";

/**
 * Which VIP price the owner's example is worked at. It used to be "the first
 * VIP price found", which in a real branch was the PC VIP rate (12) while
 * every VIP seat was a PS5 (1500): an example nobody's VIP seat would bill.
 */
describe("vipRateOptions", () => {
  const name = (slug: string) => slug.toUpperCase();
  const matrix = { pc: 7, "pc-vip": 12, ps4: 9, "ps4-vip": 14, ps5: 1000, "ps5-vip": 1500 };
  const vip = (platform: string, status = "active") => ({ platform, type: "vip", status });

  test("the platform with the VIP seats comes first", () => {
    const options = vipRateOptions(matrix, [], [vip("ps5"), vip("ps5"), { platform: "pc", type: "standard" }], name);

    expect(options[0]).toEqual({ slug: "ps5", label: "PS5", rate: 1500, vipSeats: 2 });
    expect(options.map((o) => o.slug)).toEqual(["ps5", "pc", "ps4"]);
  });

  test("no VIP seats: matrix order, every set VIP price offered", () => {
    expect(vipRateOptions(matrix, [], [], name).map((o) => [o.slug, o.rate])).toEqual([["pc", 12], ["ps4", 14], ["ps5", 1500]]);
  });

  test("an inactive VIP seat does not count; unset and zero prices are not offered", () => {
    const options = vipRateOptions({ "pc-vip": 0, "ps5-vip": null, "ps4-vip": "14" }, [], [vip("ps4", "inactive")], name);
    expect(options).toEqual([{ slug: "ps4", label: "PS4", rate: 14, vipSeats: 0 }]);
  });

  test("a venue's own platform is priced from its row", () => {
    const options = vipRateOptions({}, [{ platform: "poker", price_vip: "2500" }], [vip("poker")], name);
    expect(options).toEqual([{ slug: "poker", label: "POKER", rate: 2500, vipSeats: 1 }]);
  });
});
