import { beforeEach, describe, expect, test, vi } from "vitest";

/**
 * Pair and rest find the console by its known address (2026-10-18).
 *
 * playactor is replaced here only to read what it was asked to do: the
 * discovery config each PendingDevice is built with. Without `deviceIp` the
 * library falls back to the limited broadcast, which on a PC with a USB modem
 * leaves through the modem and never reaches the console LAN.
 */

const built = vi.hoisted(() => ({ configs: [] as unknown[] }));

vi.mock("playactor/dist/device/pending", () => ({
  PendingDevice: class {
    constructor(_d: string, _p: unknown, _n: unknown, discoveryConfig: unknown) {
      built.configs.push(discoveryConfig);
    }
    async openConnection() {
      return { standby: async () => {}, close: async () => {} };
    }
  },
}));
vi.mock("playactor/dist/credentials", () => ({ CredentialManager: class {} }));

beforeEach(() => { built.configs = []; });

describe("where playactor looks for the console", () => {
  test("rest aims its search at the console's address", async () => {
    const { standby } = await import("../../electron/ps5/playactor");
    const result = await standby("192.168.1.35", {} as never, "5C9666876D85");

    expect(result.ok).toBe(true);
    expect(built.configs).toEqual([{ deviceIp: "192.168.1.35", pingIntervalMillis: 1_000, timeoutMillis: 15_000 }]);
  });

  test("pairing does too", async () => {
    const { pair } = await import("../../electron/ps5/playactor");
    await pair("192.168.1.35", "acct", "12345678", {} as never);

    expect(built.configs).toEqual([{ deviceIp: "192.168.1.35", pingIntervalMillis: 1_000, timeoutMillis: 15_000 }]);
  });
});
