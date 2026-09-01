import { describe, expect, test, vi } from "vitest";
import { isTheConsole, withCeiling } from "../../electron/ps5/playactor";

/**
 * The two rules that decide WHICH console is asked to sleep, and for HOW LONG.
 *
 * Both exist because of the same measurement. A rest aimed at a console that
 * had left the network took 144 416 ms to fail — three attempts, each waiting
 * out a full discovery — and nothing else can be sent to a console while one
 * command is in flight, so those two and a half minutes were minutes in which
 * pressing Start woke nothing. That is the whole of "it depends on what
 * happened before"; a reboot never fixed it, it only ended whatever was still
 * hanging.
 *
 * Targeting is the other half: waking has always resolved a console by its
 * host-id, resting resolved it by IP. One console makes those the same thing.
 * Several do not.
 */

describe("which console a sleep command is for", () => {
  const at = (address: string, id?: string) => ({ id, address: { address } });

  test("the host-id decides, when the caller knows it", () => {
    const isIt = isTheConsole("192.168.1.35", "5C9666876D85");

    expect(isIt(at("192.168.1.35", "5C9666876D85"))).toBe(true);
    // Same console, new lease. Still the one we mean.
    expect(isIt(at("192.168.1.77", "5C9666876D85"))).toBe(true);
  });

  test("another console at our address is NOT ours", () => {
    // The failure this rule exists for: two consoles in a venue, a lease that
    // moved, and a manager's Stop putting somebody else's game to sleep.
    const isIt = isTheConsole("192.168.1.35", "5C9666876D85");

    expect(isIt(at("192.168.1.35", "78C881F128C2"))).toBe(false);
  });

  test("with no host-id it falls back to the address", () => {
    // Pairing is the caller with no identity yet: the owner has just picked a
    // console off the discovery list, and the host-id is what pairing returns.
    const isIt = isTheConsole("192.168.1.35");

    expect(isIt(at("192.168.1.35", "5C9666876D85"))).toBe(true);
    expect(isIt(at("192.168.1.36", "5C9666876D85"))).toBe(false);
  });

  test("a console that answers nothing about itself matches nothing", () => {
    expect(isTheConsole("192.168.1.35", "5C9666876D85")({})).toBe(false);
  });
});

describe("how long a sleep command may take", () => {
  test("work that finishes in time is the answer", async () => {
    const result = await withCeiling(Promise.resolve({ ok: true }), 50);

    expect(result).toEqual({ ok: true });
  });

  test("work that will not return is given up on, as unreachable", async () => {
    vi.useFakeTimers();
    try {
      // A promise that never settles is exactly what the 144-second call was:
      // the library waiting out a discovery for a console that is not there.
      const race = withCeiling(new Promise<never>(() => {}), 20_000);
      await vi.advanceTimersByTimeAsync(20_000);

      expect(await race).toEqual({
        ok: false,
        code: "UNREACHABLE",
        detail: "Timed out after 20000ms",
      });
    } finally {
      vi.useRealTimers();
    }
  });

  test("a refusal that arrives before the ceiling is passed through unchanged", async () => {
    // The ceiling must not turn the console's own answer into a timeout: "in
    // use" and "not paired" mean different things to whoever is standing in
    // front of it, and both are worth saying.
    const refusal = { ok: false, code: "IN_USE" as const, detail: "already in use" };

    expect(await withCeiling(Promise.resolve(refusal), 20_000)).toEqual(refusal);
  });
});
