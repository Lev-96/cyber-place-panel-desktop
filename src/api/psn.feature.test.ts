import { describe, expect, test } from "vitest";
import { PSN_FEATURE } from "./psn";

// Read before any test could switch it: the value the panel ships with.
const shipped = PSN_FEATURE.playerMessages;

describe("the PSN player message (deferred 2026-10-18)", () => {
  test("ships off, like the backend's services.psn.player_messages", () => {
    expect(shipped).toBe(false);
  });
});
