// @vitest-environment jsdom
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

/**
 * Watching consoles from wherever the panel happens to be.
 *
 * The bug this exists for: the watcher lived on the sessions board, so a
 * console switched on by hand while the owner was on any other screen was
 * never noticed — the question was not delivered late, it was never raised.
 * These tests assert the watching happens with no board rendered at all.
 */

const pcs = vi.hoisted(() => ({ data: [] as unknown[], calls: 0 }));
const sessions = vi.hoisted(() => ({ data: [] as unknown[] }));
const reported = vi.hoisted(() => ({ calls: [] as unknown[] }));
const bridge = vi.hoisted(() => ({ answer: "awake" as string, probes: 0 }));

vi.mock("@/api/pcs", () => ({ apiListPcsEverywhere: async () => { pcs.calls += 1; return pcs; } }));
vi.mock("@/api/sessions", () => ({ apiListAllActiveSessions: async () => sessions }));
vi.mock("@/api/ps5", () => ({
  apiReportUnexpectedWake: async (...a: unknown[]) => { reported.calls.push(a); },
}));
vi.mock("@/realtime/usePs5Realtime", () => ({ usePs5WakeDecided: () => {} }));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: { id: 3, role: "company_owner" } }) }));
vi.mock("@/ui/notify", () => ({ notify: { message: () => {} } }));

const device = (over: Record<string, unknown> = {}) => ({
  id: 96, branch_id: 3, place_id: 1, label: "Плейстейшен 5", kind: "ps",
  status: "online", is_startable: true,
  console_host_id: "5C9666876D85", console_address: "192.168.1.35",
  place: { id: 1, number: 1, name: "Плейстейшен 5", type: "standard", platform: "ps5" },
  ...over,
});

let Ps5ControlProvider: typeof import("./Ps5ControlProvider").Ps5ControlProvider;

beforeEach(async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  pcs.data = [];
  pcs.calls = 0;
  sessions.data = [];
  reported.calls = [];
  bridge.answer = "awake";
  bridge.probes = 0;

  (globalThis as Record<string, unknown>).cyberplacePS5 = {
    discover: async () => ({ consoles: [], probed: [], warnings: [] }),
    probe: async (addresses: string[]) => {
      bridge.probes += 1;
      return {
        consoles: addresses.map((address) => ({
          hostId: "5C9666876D85", name: "PS5-172", type: "PS5",
          address, state: bridge.answer, systemVersion: "13600007",
        })),
        probed: addresses,
        warnings: [],
      };
    },
    capabilities: async () => ({ discover: true, observe: true, wake: true, rest: true }),
    wake: async () => ({ sent: true }),
    rest: async () => ({ sent: true }),
  };

  ({ Ps5ControlProvider } = await import("./Ps5ControlProvider"));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  delete (globalThis as Record<string, unknown>).cyberplacePS5;
});

const settle = async () => {
  await act(async () => { await vi.advanceTimersByTimeAsync(500); });
};

describe("watching without a board on screen", () => {
  test("a console switched on with no session raises the question", async () => {
    pcs.data = [device()];

    // Nothing but the provider: no sessions board, no places, nothing.
    render(<Ps5ControlProvider><div /></Ps5ControlProvider>);
    await settle();

    await waitFor(() => expect(reported.calls.length).toBe(1));
    expect(reported.calls[0]).toEqual([96, expect.any(String)]);
  });

  test("a console with a session on it raises nothing", async () => {
    pcs.data = [device()];
    sessions.data = [{ id: 5, pc_id: 96, status: "active" }];

    render(<Ps5ControlProvider><div /></Ps5ControlProvider>);
    await settle();
    await act(async () => { await vi.advanceTimersByTimeAsync(11_000); });

    expect(reported.calls).toEqual([]);
  });

  test("a console nobody has bound is not watched", async () => {
    pcs.data = [device({ console_host_id: null, console_address: null })];

    render(<Ps5ControlProvider><div /></Ps5ControlProvider>);
    await settle();
    await act(async () => { await vi.advanceTimersByTimeAsync(11_000); });

    expect(bridge.probes).toBe(0);
    expect(reported.calls).toEqual([]);
  });

  test("a device that is not a PlayStation is not watched", async () => {
    // `pcs.kind = ps` covers a ping-pong table too, and asking the owner
    // whether they switched on a table would be a nonsense.
    pcs.data = [device({ place: { id: 9, number: 9, name: "Table", type: "standard", platform: "table-tennis" } })];

    render(<Ps5ControlProvider><div /></Ps5ControlProvider>);
    await settle();
    await act(async () => { await vi.advanceTimersByTimeAsync(11_000); });

    expect(bridge.probes).toBe(0);
  });

  test("a resting console is left alone", async () => {
    pcs.data = [device()];
    bridge.answer = "rest";

    render(<Ps5ControlProvider><div /></Ps5ControlProvider>);
    await settle();
    await act(async () => { await vi.advanceTimersByTimeAsync(11_000); });

    expect(reported.calls).toEqual([]);
  });

  test("without the desktop bridge it does nothing at all", async () => {
    delete (globalThis as Record<string, unknown>).cyberplacePS5;
    pcs.data = [device()];

    render(<Ps5ControlProvider><div /></Ps5ControlProvider>);
    await settle();
    await act(async () => { await vi.advanceTimersByTimeAsync(11_000); });

    expect(reported.calls).toEqual([]);
    // And asks the server for nothing either: a browser build has no way to
    // reach a console, so polling for the list of them is pure noise.
    expect(pcs.calls).toBe(0);
  });
});
