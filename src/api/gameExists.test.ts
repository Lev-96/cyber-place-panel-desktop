import { describe, expect, test } from "vitest";
import { existingGameOf } from "./gameExists";
import { packageMismatchOf } from "./packagePlatformMismatch";
import { findExistingGame, normalizeGameName } from "@/utils/gameName";

const refusal = (body: unknown) => ({ status: 422, body });

describe("existingGameOf", () => {
  test("reads the existing row from a game_exists refusal", () => {
    expect(existingGameOf(refusal({ code: "game_exists", game: { id: 4, name: "Dota 2", platform: "pc" } })))
      .toEqual({ id: 4, name: "Dota 2", platform: "pc" });
  });

  test("anything else is not one", () => {
    expect(existingGameOf(refusal({ message: "taken", errors: { name: ["taken"] } }))).toBeNull();
    expect(existingGameOf(refusal({ code: "game_exists" }))).toBeNull();
    expect(existingGameOf(refusal({ code: "game_exists", game: { id: "4", name: "x", platform: "pc" } }))).toBeNull();
    expect(existingGameOf(refusal({ code: "seat_reserved", game: { id: 4, name: "x", platform: "pc" } }))).toBeNull();
    expect(existingGameOf(new Error("network"))).toBeNull();
    expect(existingGameOf(null)).toBeNull();
  });
});

describe("packageMismatchOf", () => {
  test("only the package_platform_mismatch code", () => {
    expect(packageMismatchOf(refusal({ code: "package_platform_mismatch", message: "x" }))).toBe(true);
    expect(packageMismatchOf(refusal({ code: "seat_reserved" }))).toBe(false);
    expect(packageMismatchOf(refusal({ message: "package_platform_mismatch" }))).toBe(false);
    expect(packageMismatchOf(new Error("x"))).toBe(false);
  });
});

describe("findExistingGame", () => {
  const catalogue = [
    { id: 1, name: "Dota 2", platform: "pc" },
    { id: 2, name: "FIFA 26", platform: "ps5" },
  ];

  test("trims, folds case and collapses inner spaces", () => {
    expect(normalizeGameName("  DOTA \t 2 ")).toBe("dota 2");
    expect(findExistingGame(catalogue, " dota   2", "pc")?.id).toBe(1);
  });

  test("the same name on another platform is another game", () => {
    expect(findExistingGame(catalogue, "Dota 2", "ps5")).toBeNull();
  });

  test("nothing to compare is no match", () => {
    expect(findExistingGame(catalogue, "   ", "pc")).toBeNull();
    expect(findExistingGame(catalogue, "Dota 2", "")).toBeNull();
    expect(findExistingGame(undefined, "Dota 2", "pc")).toBeNull();
  });
});
