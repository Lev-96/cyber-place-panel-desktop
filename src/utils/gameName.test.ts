import { describe, expect, test } from "vitest";
import type { IGameApi } from "@/api/games";
import { findExistingGame, normalizeGameName, suggestGames } from "./gameName";

const g = (id: number, name: string, platform = "pc"): IGameApi => ({ id, name, platform });

describe("normalizeGameName", () => {
  test("trims, collapses inner spaces and lower-cases", () => {
    expect(normalizeGameName("  Dota   2 ")).toBe("dota 2");
  });
});

describe("findExistingGame", () => {
  test("same normalised name on the same platform", () => {
    expect(findExistingGame([g(1, "Dota 2"), g(2, "Dota 2", "ps5")], " dota  2", "ps5")?.id).toBe(2);
  });
});

describe("suggestGames", () => {
  const catalogue = [
    g(1, "Counter-Strike 2"),
    g(2, "Dota 2"),
    g(3, "Dota Underlords"),
    g(4, "Dota 2", "ps5"),
    g(5, "Defense of the Dota"),
    g(6, "dota"),
  ];

  test("exact match first, then prefix, then contains; case and spaces ignored", () => {
    expect(suggestGames(catalogue, "  DOTA ", "pc").map((x) => x.id)).toEqual([6, 2, 3, 5]);
  });

  test("only the selected platform", () => {
    expect(suggestGames(catalogue, "dota 2", "ps5").map((x) => x.id)).toEqual([4]);
  });

  test("nothing under two characters or without a platform", () => {
    expect(suggestGames(catalogue, " d ", "pc")).toEqual([]);
    expect(suggestGames(catalogue, "dota", "")).toEqual([]);
  });

  test("at most five, each game once", () => {
    const many = Array.from({ length: 8 }, (_, i) => g(10 + i, `Quake ${i}`));
    expect(suggestGames([...many, many[0]], "quake", "pc")).toHaveLength(5);
    expect(suggestGames([g(1, "Quake"), g(1, "Quake")], "quake", "pc")).toHaveLength(1);
  });

  test("a missing catalogue suggests nothing", () => {
    expect(suggestGames(null, "dota", "pc")).toEqual([]);
  });
});
