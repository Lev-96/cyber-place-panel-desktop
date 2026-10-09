// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const repos = vi.hoisted(() => ({ places: vi.fn(), prices: vi.fn() }));
vi.mock("@/repositories/PlaceRepository", () => ({
  placeRepository: { listRawByBranch: (...a: unknown[]) => repos.places(...a) },
}));
vi.mock("@/repositories/PlatformPriceRepository", () => ({
  platformPriceRepository: { listByBranch: (...a: unknown[]) => repos.prices(...a) },
}));
const lang = vi.hoisted(() => ({ current: "ru" }));
vi.mock("@/i18n/LanguageContext", () => ({ useLang: () => ({ t: (k: string) => k, lang: lang.current }) }));

import { useBranchPlatformNames, useBranchPlatforms } from "./useBranchPlatforms";

const billiards = { id: 3, branch_id: 7, platform: "billiards", name_en: "Billiards", name_ru: "Бильярд", name_am: "Բիլիարդ" };

beforeEach(() => {
  lang.current = "ru";
  repos.places.mockReset().mockResolvedValue([{ id: 1, platform: "pc" }, { id: 2, platform: "air-hockey" }]);
  repos.prices.mockReset().mockResolvedValue([billiards]);
});
afterEach(cleanup);

const settle = async () => { await act(async () => {}); };

describe("useBranchPlatforms", () => {
  // Sorted by the Russian collator: Cyrillic names before Latin ones.
  test("the branch's places + price rows, as one ordered, named list", async () => {
    const { result } = renderHook(() => useBranchPlatforms(7));
    await settle();

    expect(repos.places).toHaveBeenCalledWith(7);
    expect(repos.prices).toHaveBeenCalledWith(7);
    expect(result.current.loading).toBe(false);
    expect(result.current.options.map((o) => [o.slug, o.label])).toEqual([
      ["pc", "PC"], ["ps4", "PS4"], ["ps5", "PS5"], ["billiards", "Бильярд"], ["air-hockey", "Air Hockey"],
    ]);
    expect(result.current.nameOf("billiards")).toBe("Бильярд");
  });

  test("lists the known three while loading, and keeps an extra (saved) slug", () => {
    repos.places.mockReturnValue(new Promise(() => {}));
    repos.prices.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useBranchPlatforms(7, "old-room"));

    expect(result.current.loading).toBe(true);
    expect(result.current.options.map((o) => o.slug)).toEqual(["pc", "ps4", "ps5", "old-room"]);
  });

  test("no branch: no request, just the known platforms", async () => {
    const { result } = renderHook(() => useBranchPlatforms(undefined));
    await settle();

    expect(repos.places).not.toHaveBeenCalled();
    expect(repos.prices).not.toHaveBeenCalled();
    expect(result.current.options).toHaveLength(3);
  });

  test("a failed read ends loading and still names every slug", async () => {
    repos.prices.mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useBranchPlatforms(7));
    await settle();

    expect(result.current.loading).toBe(false);
    expect(result.current.nameOf("billiards")).toBe("Billiards");
    expect(result.current.options.map((o) => o.slug)).toContain("air-hockey");
  });
});

describe("useBranchPlatformNames", () => {
  test("reads only the price rows (one request), names follow the language", async () => {
    const { result, rerender } = renderHook(() => useBranchPlatformNames(7));
    await settle();

    expect(repos.places).not.toHaveBeenCalled();
    expect(repos.prices).toHaveBeenCalledTimes(1);
    expect(result.current.nameOf("billiards")).toBe("Бильярд");
    expect(result.current.nameOf("ps5")).toBe("PS5");

    lang.current = "am";
    rerender();
    expect(result.current.nameOf("billiards")).toBe("Բիլիարդ");
    expect(repos.prices).toHaveBeenCalledTimes(1);
  });
});
