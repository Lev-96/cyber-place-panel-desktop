import { describe, expect, test } from "vitest";
import { PC_KIND } from "@/types/pc";
import { isPlayStationSeat, packageFitsSeat, platformGroup } from "./platform";

describe("platformGroup", () => {
  test("pc, every PlayStation generation, and everything else", () => {
    expect(platformGroup("pc")).toBe("pc");
    expect(platformGroup("ps4")).toBe("ps");
    expect(platformGroup("ps5")).toBe("ps");
    expect(platformGroup("ps6")).toBe("ps");
    expect(platformGroup("billiards")).toBe("other");
    expect(platformGroup("ps-vr-room")).toBe("other");
  });
});

describe("isPlayStationSeat", () => {
  test("asks the place's platform before the device kind", () => {
    expect(isPlayStationSeat({ kind: PC_KIND.Ps, place: { platform: "ps5" } })).toBe(true);
    expect(isPlayStationSeat({ kind: PC_KIND.Ps, place: { platform: "billiards" } })).toBe(false);
    expect(isPlayStationSeat({ kind: PC_KIND.Pc, place: { platform: "ps4" } })).toBe(true);
  });

  test("falls back to the kind only without a place", () => {
    expect(isPlayStationSeat({ kind: PC_KIND.Ps, place: null })).toBe(true);
    expect(isPlayStationSeat({ kind: PC_KIND.Pc })).toBe(false);
    expect(isPlayStationSeat({ kind: PC_KIND.Ps, place: { platform: "" } })).toBe(true);
  });
});

describe("packageFitsSeat (the server's TimePackage::fitsPlatform)", () => {
  test("a tariff for all platforms fits every seat", () => {
    expect(packageFitsSeat({ platform: null }, "ps5")).toBe(true);
    expect(packageFitsSeat({ platform: undefined }, "billiards")).toBe(true);
  });
  test("a platform tariff fits only that platform", () => {
    expect(packageFitsSeat({ platform: "ps5" }, "ps5")).toBe(true);
    expect(packageFitsSeat({ platform: "ps5" }, "pc")).toBe(false);
    expect(packageFitsSeat({ platform: "billiards" }, "ps5")).toBe(false);
  });
  test("a seat with no known platform is not narrowed", () => {
    expect(packageFitsSeat({ platform: "ps5" }, null)).toBe(true);
    expect(packageFitsSeat({ platform: "pc" }, undefined)).toBe(true);
  });
});
