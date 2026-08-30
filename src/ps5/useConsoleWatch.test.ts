// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useConsoleWatch, WATCH_INTERVAL_MS } from "./useConsoleWatch";
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
    answerToProbe = () => [];
    await act(async () => { await vi.advanceTimersByTimeAsync(WATCH_INTERVAL_MS); });

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
