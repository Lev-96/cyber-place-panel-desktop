import { describe, expect, test, vi } from "vitest";

/**
 * A rest withdrawn while its connection to the console was still opening
 * (2026-10-27): the standby is not sent. The panel holds its wake until the
 * rest returns, so this is the last moment at which the console can still be
 * spared a standby that would land after the wake.
 */
const playactor = vi.hoisted(() => ({
  standby: vi.fn(async () => {}),
  close: vi.fn(async () => {}),
  /** Runs while the connection opens — where the test withdraws the rest. */
  whileOpening: () => {},
  /** Holds the connection open until the test says so (a slow console). */
  opening: null as Promise<void> | null,
  /** What the console's discovery answer says it is doing. */
  status: "AWAKE" as "AWAKE" | "STANDBY",
  /** Connections opened — each one starts with a wake inside playactor. */
  opened: 0,
}));

vi.mock("playactor/dist/device/pending", () => ({
  PendingDevice: class {
    async discover() { return { status: playactor.status }; }
    async openConnection() {
      playactor.opened += 1;
      playactor.whileOpening();
      if (playactor.opening) await playactor.opening;
      return { standby: playactor.standby, close: playactor.close };
    }
  },
}));
vi.mock("playactor/dist/credentials", () => ({ CredentialManager: class {} }));

import { standby } from "../../electron/ps5/playactor";

const keys = {} as never;

describe("a console that is already asleep (2026-10-28, measured live with two panels)", () => {
  test("is not connected to — playactor would wake it first — and the rest counts as done", async () => {
    playactor.standby.mockClear();
    playactor.opened = 0;
    playactor.status = "STANDBY";
    playactor.whileOpening = () => {};
    try {
      const result = await standby("192.168.1.35", keys, "AAA", () => false);
      expect(result.ok).toBe(true);
      expect(playactor.opened).toBe(0);
      expect(playactor.standby).not.toHaveBeenCalled();
    } finally {
      playactor.status = "AWAKE";
    }
  });

  test("an awake console is connected to and put to sleep", async () => {
    playactor.standby.mockClear();
    playactor.opened = 0;
    playactor.whileOpening = () => {};
    const result = await standby("192.168.1.35", keys, "AAA", () => false);
    expect(result.ok).toBe(true);
    expect(playactor.opened).toBe(1);
    expect(playactor.standby).toHaveBeenCalledTimes(1);
  });
});

describe("a rest that was given up on (2026-10-27, measured on a real console)", () => {
  test("an attempt that timed out and connects later sends no standby", async () => {
    vi.useFakeTimers();
    try {
      playactor.standby.mockClear();
      playactor.whileOpening = () => {};
      let connect!: () => void;
      // The first attempt's connection is slow; later ones never come.
      let first = true;
      playactor.opening = null;
      playactor.whileOpening = () => {
        if (first) { first = false; playactor.opening = new Promise<void>((r) => { connect = r; }); }
        else playactor.opening = new Promise<void>(() => {});
      };

      const pending = standby("192.168.1.35", keys, "AAA", () => false);
      // Past every ceiling: the command is over and reported as a timeout.
      await vi.advanceTimersByTimeAsync(70_000);
      const result = await pending;
      expect(result.code).toBe("TIMEOUT");

      // The console finally answers the abandoned attempt…
      connect();
      await vi.advanceTimersByTimeAsync(1_000);
      // …and is not put to sleep behind the panel's back.
      expect(playactor.standby).not.toHaveBeenCalled();
    } finally {
      playactor.opening = null;
      vi.useRealTimers();
    }
  });

  test("a withdrawal is answered at once, not after the slow connection", async () => {
    vi.useFakeTimers();
    try {
      playactor.standby.mockClear();
      playactor.whileOpening = () => { playactor.opening = new Promise<void>(() => {}); };
      let withdrawn = false;

      const pending = standby("192.168.1.35", keys, "AAA", () => withdrawn);
      await vi.advanceTimersByTimeAsync(2_000);
      withdrawn = true;
      await vi.advanceTimersByTimeAsync(500);

      expect((await pending).code).toBe("CANCELLED");
      expect(playactor.standby).not.toHaveBeenCalled();
    } finally {
      playactor.opening = null;
      vi.useRealTimers();
    }
  });
});

describe("a withdrawn rest", () => {
  test("withdrawn while the connection opened: no standby is sent, and the connection is closed", async () => {
    let withdrawn = false;
    playactor.whileOpening = () => { withdrawn = true; };

    const result = await standby("192.168.1.35", keys, "AAA", () => withdrawn);

    expect(result.code).toBe("CANCELLED");
    expect(playactor.standby).not.toHaveBeenCalled();
    expect(playactor.close).toHaveBeenCalled();
  });

  test("not withdrawn: the standby is sent", async () => {
    playactor.standby.mockClear();
    playactor.whileOpening = () => {};

    const result = await standby("192.168.1.35", keys, "AAA", () => false);

    expect(result.ok).toBe(true);
    expect(playactor.standby).toHaveBeenCalledTimes(1);
  });
});
