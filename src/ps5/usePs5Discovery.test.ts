// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { usePs5Discovery } from "./usePs5Discovery";

/**
 * "Find PlayStation" keeps what the sweep could not do (2026-10-18), so a
 * "nothing found" report from a club carries the evidence.
 */
afterEach(() => { delete (globalThis as Record<string, unknown>).cyberplacePS5; });

describe("the find-PlayStation sweep", () => {
  test("hands its warnings to the screen with the list of where it looked", async () => {
    (globalThis as Record<string, unknown>).cyberplacePS5 = {
      discover: async () => ({
        consoles: [],
        probed: ["192.168.1.255", "255.255.255.255"],
        warnings: ["skipped tun0 100.101.7.3: point-to-point"],
      }),
    };
    const { result } = renderHook(() => usePs5Discovery());

    await act(async () => { await result.current.scan(); });

    expect(result.current.probed).toEqual(["192.168.1.255", "255.255.255.255"]);
    expect(result.current.warnings).toEqual(["skipped tun0 100.101.7.3: point-to-point"]);
  });
});
