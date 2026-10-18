// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

/**
 * Stop, then Start at once, as the panel wires it (2026-10-18).
 *
 * The board's own reads race the presses: the read a Stop asks for can land
 * after the next Start. Whatever order they land in, the console the player was
 * just given is not sent to rest, and nobody is asked about an "unexpected"
 * wake of a console that has a session.
 */

const lists = vi.hoisted(() => ({
  pcs: [] as unknown[],
  /** Each read of the running sessions waits here until the test answers it. */
  pending: [] as Array<(ids: number[]) => void>,
}));
const bridge = vi.hoisted(() => ({ rests: 0, wakes: 0, answer: "awake", cancels: 0 }));
const reported = vi.hoisted(() => ({ calls: 0 }));

vi.mock("@/api/pcs", () => ({ apiListPcsEverywhere: async () => ({ data: lists.pcs }) }));
vi.mock("@/api/sessions", () => ({
  apiListAllActiveSessions: () => new Promise((resolve) => {
    lists.pending.push((ids) => resolve({ data: ids.map((pc_id) => ({ pc_id })) }));
  }),
}));
vi.mock("@/api/ps5", () => ({ apiReportUnexpectedWake: async () => { reported.calls += 1; } }));
vi.mock("@/realtime/usePs5Realtime", () => ({ usePs5WakeDecided: () => {} }));
vi.mock("@/i18n/translations", () => ({ tActive: (key: string) => key }));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: { id: 3, role: "company_owner" } }) }));
vi.mock("@/ui/notify", () => ({ notify: { message: () => {} } }));

const DEVICE = {
  id: 96, branch_id: 3, place_id: 1, label: "PS5", kind: "ps", status: "online", is_startable: true,
  console_host_id: "5C9666876D85", console_address: "192.168.1.35",
  place: { id: 1, number: 1, name: "PS5", type: "standard", platform: "ps5" },
};

type Control = ReturnType<typeof import("./Ps5ControlProvider").usePs5Control>;
let control: Control | null = null;

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  lists.pcs = [DEVICE];
  lists.pending = [];
  bridge.rests = 0;
  bridge.wakes = 0;
  bridge.cancels = 0;
  bridge.answer = "awake";
  reported.calls = 0;
  control = null;
  (globalThis as Record<string, unknown>).cyberplacePS5 = {
    discover: async () => ({ consoles: [], probed: [], warnings: [] }),
    probe: async (addresses: string[]) => ({
      consoles: addresses.map((address) => ({
        hostId: "5C9666876D85", name: "PS5", type: "PS5", address, state: bridge.answer, systemVersion: "1",
      })),
      probed: addresses, warnings: [],
    }),
    capabilities: async () => ({ discover: true, observe: true, wake: true, rest: true }),
    wake: async () => { bridge.wakes += 1; return { sent: true }; },
    rest: async () => { bridge.rests += 1; return { sent: true }; },
    restCancel: async () => { bridge.cancels += 1; },
    hasCredential: async () => ({ has: true, available: true, persisted: true }),
  };
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  delete (globalThis as Record<string, unknown>).cyberplacePS5;
});

const settle = async (ms = 500) => {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
};

const mount = async () => {
  const { Ps5ControlProvider, usePs5Control } = await import("./Ps5ControlProvider");
  const Probe = () => { control = usePs5Control(); return null; };
  render(<Ps5ControlProvider><Probe /></Ps5ControlProvider>);
  await settle();
  // The first read: a session is running on the console.
  await act(async () => { lists.pending.shift()!([96]); });
  await settle();
};

describe("Stop then Start, with the Stop's read landing last", () => {
  test("the console is not sent to rest under the new player, and nobody is asked about it", async () => {
    await mount();
    expect(bridge.rests).toBe(0);

    await act(async () => { control!.sessionStopped(96); });
    await settle(50);
    const stopRead = lists.pending.shift()!;
    const restsAfterStop = bridge.rests;

    await act(async () => { control!.sessionStarting(96); });
    await settle(50);
    const startRead = lists.pending.shift()!;

    // The Start's read answers first, then the Stop's stale "no session".
    await act(async () => { startRead([96]); });
    await act(async () => { stopRead([]); });
    // Well past the unexpected-wake grace and the stopping intent.
    for (let i = 0; i < 8; i++) await settle(10_000);
    // Keep later polls honest: the session is running.
    while (lists.pending.length) await act(async () => { lists.pending.shift()!([96]); });
    await settle(3_000);

    expect(bridge.rests).toBe(restsAfterStop);
    expect(reported.calls).toBe(0);
  });
});

describe("the Stop's intent does not outlive the next Start", () => {
  test("a console whose running set briefly loses it after Start is not rested on the spot", async () => {
    const { renderHook } = await import("@testing-library/react");
    const { useConsoleControl } = await import("./useConsoleControl");
    let ids = new Set<number>([96]);
    // One array for every render, as the provider's state is.
    const devices = [DEVICE] as never;
    const hook = renderHook(() => useConsoleControl({ devices, sessionDeviceIds: ids }));
    await settle();

    await act(async () => { hook.result.current.sessionStopped(96); });
    ids = new Set(); hook.rerender();
    await settle();
    const restsAfterStop = bridge.rests;

    await act(async () => { hook.result.current.sessionStarting(96); });
    ids = new Set([96]); hook.rerender();
    await settle();
    // Whatever drops it from the set now, the Stop pressed before the Start is
    // not what decides: no rest goes out on the strength of it.
    ids = new Set(); hook.rerender();
    await settle(2_000);

    expect(bridge.rests).toBe(restsAfterStop);
  });
});
