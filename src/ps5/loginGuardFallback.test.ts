import { expect, test, vi } from "vitest";

/**
 * If a playactor upgrade ever moves the classes the guard patches, resting must
 * go on exactly as before, not fail before it starts (review of 2026-11-08).
 */

vi.mock("playactor/dist/remoteplay/proc/login", () => { throw new Error("moved in a newer playactor"); });

test("a guard that cannot be installed is a warning, not a broken rest", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const { closeSocketOnFailedLogin } = await import("../../electron/ps5/playactor");

  await expect(closeSocketOnFailedLogin()).resolves.toBeUndefined();
  await expect(closeSocketOnFailedLogin()).resolves.toBeUndefined();
  expect(warn).toHaveBeenCalledTimes(1);
});
