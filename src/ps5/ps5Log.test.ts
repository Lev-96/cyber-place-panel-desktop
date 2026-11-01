import { describe, expect, test, vi } from "vitest";

vi.mock("electron-log", () => ({ default: { create: () => ({ transports: { file: {}, console: {} }, info: vi.fn() }) } }));

import { isPs5Line, PS5_LOG_PREFIX } from "../../electron/ps5/ps5Log";

/**
 * Which page-console lines go to ps5.log (2026-11-02): the watcher's own and
 * nothing else — the rest of the page's console is not the console log.
 */
describe("ps5.log keeps only the watcher's lines", () => {
  test("a [ps5] line", () => {
    expect(isPs5Line(`${PS5_LOG_PREFIX} 2026-11-02T10:00:00.000Z PS5_COMMAND_DONE {"hostId":"AAA"}`)).toBe(true);
  });

  test("anything else", () => {
    expect(isPs5Line("[realtime] connected")).toBe(false);
    expect(isPs5Line("some text mentioning [ps5] later")).toBe(false);
    expect(isPs5Line(undefined)).toBe(false);
    expect(isPs5Line(42)).toBe(false);
  });
});
