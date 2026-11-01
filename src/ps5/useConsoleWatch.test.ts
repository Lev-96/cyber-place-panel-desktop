// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useConsoleWatch, AWAKE_HOLD_MS, REST_HOLD_MS, WATCH_FAST_WINDOW_MS, WATCH_INTERVAL_FAST_MS, WATCH_INTERVAL_MS } from "./useConsoleWatch";
import type { Ps5Console, Ps5SweepResult } from "./usePs5Discovery";

/**
 * The ten-second console check.
 *
 * The rules being pinned here are the ones that keep a timer running all shift
 * from becoming a problem: it asks the consoles it knows about directly rather
 * than shouting at the network, it does not stack ticks on top of each other,
 * it stops when the screen goes away, and it says "unreachable" instead of
 * guessing when nothing answers.
 *
 * The bridge is faked because the real one is Electron's main process. What is
 * exercised for real is the policy — which addresses are asked, when a sweep is
 * allowed, and what the board is told.
 */

interface Call { addresses: string[] }

const consoleAt = (hostId: string, address: string, state: Ps5Console["state"] = "awake"): Ps5Console => ({
  hostId, name: `PS5 ${hostId}`, type: "PS5", address, state, systemVersion: "07000001",
});

const empty: Ps5SweepResult = { consoles: [], probed: [], warnings: [] };

let probeCalls: Call[] = [];
let sweepCalls = 0;
let answerToProbe: (addresses: string[]) => Ps5Console[] = () => [];
let answerToSweep: () => Ps5Console[] = () => [];

const installBridge = (): void => {
  (globalThis as Record<string, unknown>).cyberplacePS5 = {
    probe: async (addresses: string[]): Promise<Ps5SweepResult> => {
      probeCalls.push({ addresses });
      return { ...empty, consoles: answerToProbe(addresses), probed: addresses };
    },
    discover: async (): Promise<Ps5SweepResult> => {
      sweepCalls += 1;
      return { ...empty, consoles: answerToSweep() };
    },
  };
};

beforeEach(() => {
  probeCalls = [];
  sweepCalls = 0;
  answerToProbe = () => [];
  answerToSweep = () => [];
  installBridge();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
  delete (globalThis as Record<string, unknown>).cyberplacePS5;
});

/** Let the pending probe promise settle before asserting on what it produced. */
const settle = async () => { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); };

describe("asking again straight away", () => {
  test("a press asks now instead of waiting out the period", async () => {
    // The operator is looking at the tile. The next scheduled look could be ten
    // seconds away, and ten seconds of the previous state on screen is what
    // "nothing happens when I press Start" was.
    answerToProbe = () => [consoleAt("AAA", "192.168.1.10")];
    const { result } = renderHook(() => useConsoleWatch([{ hostId: "AAA", address: "192.168.1.10" }]));

    await settle();
    expect(probeCalls).toHaveLength(1);

    await act(async () => { result.current.refreshNow(); await Promise.resolve(); });
    await settle();

    expect(probeCalls).toHaveLength(2);
  });

  test("and keeps asking quickly while something is expected to change", async () => {
    answerToProbe = () => [consoleAt("AAA", "192.168.1.10")];
    const { result } = renderHook(() => useConsoleWatch([{ hostId: "AAA", address: "192.168.1.10" }]));
    await settle();

    await act(async () => { result.current.refreshNow(); await Promise.resolve(); });
    await settle();
    const after = probeCalls.length;

    // Three fast periods, three more looks — not one.
    await act(async () => { await vi.advanceTimersByTimeAsync(WATCH_INTERVAL_FAST_MS * 3); });

    expect(probeCalls.length).toBeGreaterThan(after + 1);
  });

  test("the fast rhythm lapses on its own", async () => {
    // A console that never obeys must not leave the panel polling it all day.
    answerToProbe = () => [consoleAt("AAA", "192.168.1.10")];
    const { result } = renderHook(() => useConsoleWatch([{ hostId: "AAA", address: "192.168.1.10" }]));
    await settle();

    await act(async () => { result.current.refreshNow(); await Promise.resolve(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(WATCH_FAST_WINDOW_MS + 10_000); });
    const settled = probeCalls.length;

    // Well past the window: back to one look per ten seconds.
    await act(async () => { await vi.advanceTimersByTimeAsync(WATCH_INTERVAL_MS); });

    expect(probeCalls.length - settled).toBeLessThanOrEqual(2);
  });
});

describe("the ten-second console check", () => {
  test("asks the bound consoles at their own addresses, not the whole network", async () => {
    answerToProbe = () => [consoleAt("AAA", "192.168.1.10", "rest")];

    const { result } = renderHook(() => useConsoleWatch([{ hostId: "AAA", address: "192.168.1.10" }]));

    await waitFor(() => expect(result.current.statuses.AAA).toBeDefined());
    expect(result.current.statuses.AAA.state).toBe("rest");
    // The whole point of the unicast path: one datagram to one address, and no
    // broadcast anywhere in it.
    expect(probeCalls[0].addresses).toEqual(["192.168.1.10"]);
    expect(sweepCalls).toBe(0);
  });

  test("keeps asking, every ten seconds", async () => {
    answerToProbe = () => [consoleAt("AAA", "192.168.1.10")];

    renderHook(() => useConsoleWatch([{ hostId: "AAA", address: "192.168.1.10" }]));
    await settle();
    expect(probeCalls).toHaveLength(1);

    await act(async () => { await vi.advanceTimersByTimeAsync(WATCH_INTERVAL_MS); });
    expect(probeCalls).toHaveLength(2);

    await act(async () => { await vi.advanceTimersByTimeAsync(WATCH_INTERVAL_MS); });
    expect(probeCalls).toHaveLength(3);
  });

  test("the ten seconds are measured from the start of a check, not the end", async () => {
    // A probe takes real time on a real network. Waiting the full interval
    // AFTER it returns is how a ten-second check silently becomes a twelve-
    // second one — and the drift compounds, differently on every machine.
    let slow: (() => void) | null = null;
    (globalThis as Record<string, unknown>).cyberplacePS5 = {
      probe: async (addresses: string[]) => {
        probeCalls.push({ addresses });
        await new Promise<void>((resolve) => { slow = resolve; });
        return { ...empty, consoles: [consoleAt("AAA", "192.168.1.10")] };
      },
      discover: async () => empty,
    };

    renderHook(() => useConsoleWatch([{ hostId: "AAA", address: "192.168.1.10" }]));
    await settle();
    expect(probeCalls).toHaveLength(1);

    // The probe takes three seconds.
    await act(async () => { await vi.advanceTimersByTimeAsync(3_000); });
    await act(async () => { slow?.(); await Promise.resolve(); });

    // Seven more seconds — ten since the check STARTED — and the next one is due.
    await act(async () => { await vi.advanceTimersByTimeAsync(7_000); });
    expect(probeCalls).toHaveLength(2);
  });

  test("a console that stops answering reads as unreachable, never as awake", async () => {
    answerToProbe = () => [consoleAt("AAA", "192.168.1.10")];
    const { result } = renderHook(() => useConsoleWatch([{ hostId: "AAA", address: "192.168.1.10" }]));
    await waitFor(() => expect(result.current.statuses.AAA?.state).toBe("awake"));

    // Unplugged, switched off at the wall, or moved to another network — from
    // here these are the same silence, and presenting one of them as a state
    // would be a guess.
    // Past the hold an awake console gets for Wi-Fi gaps (AWAKE_HOLD_MS).
    answerToProbe = () => [];
    await act(async () => { await vi.advanceTimersByTimeAsync(AWAKE_HOLD_MS + WATCH_INTERVAL_MS); });

    await waitFor(() => expect(result.current.statuses.AAA.state).toBe("unreachable"));
  });

  test("after two silent ticks it sweeps, and adopts the address it finds", async () => {
    const onAddressChanged = vi.fn();
    // The console is alive but the router handed it a new lease. The address we
    // hold is simply wrong, and a watcher that only ever probed it would report
    // a working console as dead forever.
    answerToProbe = (addresses) => (addresses.includes("192.168.1.99") ? [consoleAt("AAA", "192.168.1.99")] : []);
    answerToSweep = () => [consoleAt("AAA", "192.168.1.99")];

    const { result } = renderHook(() =>
      useConsoleWatch([{ hostId: "AAA", address: "192.168.1.10" }], { onAddressChanged }));

    await settle();
    expect(sweepCalls).toBe(0); // one silent tick is a dropped datagram, not a move

    await act(async () => { await vi.advanceTimersByTimeAsync(WATCH_INTERVAL_MS); });
    await waitFor(() => expect(sweepCalls).toBe(1));

    expect(onAddressChanged).toHaveBeenCalledWith("AAA", "192.168.1.99");
    await waitFor(() => expect(result.current.statuses.AAA.state).toBe("awake"));

    // …and the next tick goes straight to the new address.
    await act(async () => { await vi.advanceTimersByTimeAsync(WATCH_INTERVAL_MS); });
    expect(probeCalls[probeCalls.length - 1].addresses).toEqual(["192.168.1.99"]);
  });

  test("it stops when the screen goes away", async () => {
    answerToProbe = () => [consoleAt("AAA", "192.168.1.10")];
    const { unmount } = renderHook(() => useConsoleWatch([{ hostId: "AAA", address: "192.168.1.10" }]));
    await settle();
    const before = probeCalls.length;

    unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(WATCH_INTERVAL_MS * 3); });

    // A board left behind by navigation must not keep a timer on the network.
    expect(probeCalls).toHaveLength(before);
  });

  test("nothing bound means no timer and no packets at all", async () => {
    const { result } = renderHook(() => useConsoleWatch([]));

    await act(async () => { await vi.advanceTimersByTimeAsync(WATCH_INTERVAL_MS * 3); });

    expect(probeCalls).toHaveLength(0);
    expect(result.current.statuses).toEqual({});
    expect(result.current.watching).toBe(false);
  });

  test("an unbound console disappears from the board rather than freezing", async () => {
    answerToProbe = () => [consoleAt("AAA", "192.168.1.10"), consoleAt("BBB", "192.168.1.11")];
    const { result, rerender } = renderHook(
      ({ bound }) => useConsoleWatch(bound),
      { initialProps: { bound: [{ hostId: "AAA", address: "192.168.1.10" }, { hostId: "BBB", address: "192.168.1.11" }] } },
    );
    await waitFor(() => expect(Object.keys(result.current.statuses).sort()).toEqual(["AAA", "BBB"]));

    rerender({ bound: [{ hostId: "AAA", address: "192.168.1.10" }] });
    await waitFor(() => expect(Object.keys(result.current.statuses)).toEqual(["AAA"]));
  });

  test("an older desktop build without the probe channel simply does not watch", async () => {
    // The renderer can be newer than the preload it is loaded into. Reaching
    // for a channel that is not there must degrade to "no status", not throw.
    (globalThis as Record<string, unknown>).cyberplacePS5 = { discover: async () => empty };

    const { result } = renderHook(() => useConsoleWatch([{ hostId: "AAA", address: "192.168.1.10" }]));
    await act(async () => { await vi.advanceTimersByTimeAsync(WATCH_INTERVAL_MS * 2); });

    expect(result.current.watching).toBe(false);
    expect(result.current.statuses).toEqual({});
  });
});

/**
 * A console that is really off (2026-10-18): it used to cost a network-wide
 * sweep on every tick, all evening. Now the sweeps space out, and a press
 * brings them back.
 */
describe("sweeping for a console that is not there", () => {
  test("sweeps space out instead of running on every tick", async () => {
    renderHook(() => useConsoleWatch([{ hostId: "OFF", address: "192.168.1.10" }], { intervalMs: 3_000 }));
    await settle();

    // Ten minutes of a console that never answers, at the watchful rhythm.
    for (let i = 0; i < 200; i++) await act(async () => { await vi.advanceTimersByTimeAsync(3_000); });

    // At every tick that would be ~199 sweeps. Spaced: 5, 10, 20, 40, then one
    // a minute — about a dozen in ten minutes.
    expect(sweepCalls).toBeGreaterThanOrEqual(8);
    expect(sweepCalls).toBeLessThanOrEqual(16);
  });

  test("a press brings the next sweep back to the shortest gap", async () => {
    const { result } = renderHook(() => useConsoleWatch([{ hostId: "OFF", address: "192.168.1.10" }], { intervalMs: 3_000 }));
    await settle();
    for (let i = 0; i < 100; i++) await act(async () => { await vi.advanceTimersByTimeAsync(3_000); });
    const before = sweepCalls;

    await act(async () => { result.current.refreshNow(); await Promise.resolve(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(WATCH_INTERVAL_FAST_MS * 5); });

    expect(sweepCalls).toBeGreaterThan(before);
  });

  test("a console that comes back resets the spacing", async () => {
    let on = false;
    answerToProbe = (addresses) => (on ? addresses.map((a) => consoleAt("OFF", a)) : []);
    const { result } = renderHook(() => useConsoleWatch([{ hostId: "OFF", address: "192.168.1.10" }], { intervalMs: 3_000 }));
    await settle();
    for (let i = 0; i < 60; i++) await act(async () => { await vi.advanceTimersByTimeAsync(3_000); });

    on = true;
    await act(async () => { await vi.advanceTimersByTimeAsync(3_000); });
    await waitFor(() => expect(result.current.statuses.OFF.state).toBe("awake"));

    // Off again: the first sweep comes after two misses and the shortest gap.
    on = false;
    const before = sweepCalls;
    for (let i = 0; i < 4; i++) await act(async () => { await vi.advanceTimersByTimeAsync(3_000); });
    expect(sweepCalls).toBe(before + 1);
  });
});

/**
 * A console asleep on Wi-Fi answers about one probe in three (2026-10-19,
 * club). Its silence must not turn the tile into "unavailable" between two
 * answers; real silence still does, once it has lasted.
 */
describe("a sleeping console that goes quiet", () => {
  test("is still shown at rest through the gaps between its answers", async () => {
    let answers = true;
    answerToProbe = (addresses) => (answers ? addresses.map((a) => consoleAt("AAA", a, "rest")) : []);
    const { result } = renderHook(() => useConsoleWatch([{ hostId: "AAA", address: "192.168.1.10" }], { intervalMs: 3_000 }));
    await settle();
    await waitFor(() => expect(result.current.statuses.AAA.state).toBe("rest"));

    answers = false;
    for (let i = 0; i < 5; i++) {
      await act(async () => { await vi.advanceTimersByTimeAsync(3_000); });
      expect(result.current.statuses.AAA.state).toBe("rest");
    }
  });

  test("is unreachable once the silence has outlasted the hold", async () => {
    let answers = true;
    answerToProbe = (addresses) => (answers ? addresses.map((a) => consoleAt("AAA", a, "rest")) : []);
    const { result } = renderHook(() => useConsoleWatch([{ hostId: "AAA", address: "192.168.1.10" }], { intervalMs: 3_000 }));
    await settle();
    await waitFor(() => expect(result.current.statuses.AAA.state).toBe("rest"));

    answers = false;
    await act(async () => { await vi.advanceTimersByTimeAsync(REST_HOLD_MS + 10_000); });
    await waitFor(() => expect(result.current.statuses.AAA.state).toBe("unreachable"));
  });

  test("an awake console on Wi-Fi stays awake through a few silent probes, then is unavailable", async () => {
    // Measured 2026-10-27: awake, it answered 35 % of probes with gaps up to
    // 6 s. A gap is not "unavailable", which flickered the tile and restarted
    // the unexpected-wake clock on every miss.
    let answers = true;
    answerToProbe = (addresses) => (answers ? addresses.map((a) => consoleAt("AAA", a, "awake")) : []);
    const { result } = renderHook(() => useConsoleWatch([{ hostId: "AAA", address: "192.168.1.10" }], { intervalMs: 3_000 }));
    await settle();
    await waitFor(() => expect(result.current.statuses.AAA.state).toBe("awake"));
    const heard = result.current.statuses.AAA.heardAt;

    answers = false;
    await act(async () => { await vi.advanceTimersByTimeAsync(9_000); });
    expect(result.current.statuses.AAA.state).toBe("awake");
    // Held, not heard: the moment it last really answered is kept.
    expect(result.current.statuses.AAA.heardAt).toBe(heard);

    await act(async () => { await vi.advanceTimersByTimeAsync(AWAKE_HOLD_MS); });
    await waitFor(() => expect(result.current.statuses.AAA.state).toBe("unreachable"));
  });

  test("a sleeping console on Wi-Fi is still shown asleep after five silent minutes, unavailable after ten", async () => {
    // Measured 2026-10-28: asleep, it answered 0 of 45 and 2 of 90 probes.
    let answers = true;
    answerToProbe = (addresses) => (answers ? addresses.map((a) => consoleAt("AAA", a, "rest")) : []);
    const { result } = renderHook(() => useConsoleWatch([{ hostId: "AAA", address: "192.168.1.10" }], { intervalMs: 3_000 }));
    await settle();
    await waitFor(() => expect(result.current.statuses.AAA.state).toBe("rest"));

    answers = false;
    await act(async () => { await vi.advanceTimersByTimeAsync(5 * 60_000); });
    expect(result.current.statuses.AAA.state).toBe("rest");

    await act(async () => { await vi.advanceTimersByTimeAsync(5 * 60_000 + 10_000); });
    await waitFor(() => expect(result.current.statuses.AAA.state).toBe("unreachable"));
  });

  test("a held rest keeps the moment it was really heard, so silence is not mistaken for an answer", async () => {
    let answers = true;
    answerToProbe = (addresses) => (answers ? addresses.map((a) => consoleAt("AAA", a, "rest")) : []);
    const { result } = renderHook(() => useConsoleWatch([{ hostId: "AAA", address: "192.168.1.10" }], { intervalMs: 3_000 }));
    await settle();
    await waitFor(() => expect(result.current.statuses.AAA.heardAt).toBeDefined());
    const heard = result.current.statuses.AAA.heardAt;

    answers = false;
    await act(async () => { await vi.advanceTimersByTimeAsync(9_000); });
    expect(result.current.statuses.AAA.state).toBe("rest");
    expect(result.current.statuses.AAA.heardAt).toBe(heard);
  });
});

