// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

/**
 * A place bound before its console was paired (2026-10-19, club).
 *
 * The watcher asked the vault "is there a key?" once per binding and kept the
 * answer. Bound first, paired a few minutes later: it still said "no key", sent
 * no wake at all, and the place showed "command failed" until the panel was
 * restarted. Now the vault is asked again when the picker changes a key, and on
 * every Start or Stop.
 */

const lists = vi.hoisted(() => ({ pcs: [] as unknown[], sessions: [] as unknown[] }));
const bridge = vi.hoisted(() => ({ hasKey: false, wakes: 0, asked: 0 }));

vi.mock("@/api/pcs", () => ({ apiListPcsEverywhere: async () => ({ data: lists.pcs }) }));
vi.mock("@/api/sessions", () => ({ apiListAllActiveSessions: async () => ({ data: lists.sessions }) }));
vi.mock("@/api/ps5", () => ({ apiReportUnexpectedWake: async () => {} }));
vi.mock("@/realtime/usePs5Realtime", () => ({ usePs5WakeDecided: () => {} }));
vi.mock("@/i18n/translations", () => ({ tActive: (key: string) => key }));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: { id: 3, role: "company_owner" } }) }));
vi.mock("@/ui/notify", () => ({ notify: { message: () => {} } }));

const DEVICE = {
  id: 116, branch_id: 4, place_id: 9, label: "PS5", kind: "ps", status: "online", is_startable: true,
  console_host_id: "5C9666876D85", console_address: "192.168.1.35",
  place: { id: 9, number: 9, name: "PS5", type: "standard", platform: "ps5" },
};

type Control = ReturnType<typeof import("./Ps5ControlProvider").usePs5Control>;
let control: Control | null = null;

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  lists.pcs = [DEVICE];
  // A session is running: the console is wanted awake, and it is at rest.
  lists.sessions = [{ pc_id: 116 }];
  bridge.hasKey = false;
  bridge.wakes = 0;
  bridge.asked = 0;
  control = null;
  (globalThis as Record<string, unknown>).cyberplacePS5 = {
    discover: async () => ({ consoles: [], probed: [], warnings: [] }),
    probe: async (addresses: string[]) => ({
      consoles: addresses.map((address) => ({
        hostId: "5C9666876D85", name: "PS5-172", type: "PS5", address, state: "rest", systemVersion: "1",
      })),
      probed: addresses, warnings: [],
    }),
    capabilities: async () => ({ discover: true, observe: true, wake: true, rest: true }),
    wake: async () => { bridge.wakes += 1; return { sent: true }; },
    rest: async () => ({ sent: true }),
    hasCredential: async () => { bridge.asked += 1; return { has: bridge.hasKey, available: true, persisted: true }; },
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
  await settle(3_000);
};

describe("a console paired after its place was bound", () => {
  test("no key yet: nothing is sent, and that does not change by itself", async () => {
    await mount();
    await settle(10_000);
    expect(bridge.wakes).toBe(0);
  });

  test("paired in the picker: the next look wakes it, no restart", async () => {
    await mount();
    expect(bridge.wakes).toBe(0);

    bridge.hasKey = true; // the pairing wrote the key
    await act(async () => { control!.credentialsChanged(); });
    await settle(4_000);

    expect(bridge.wakes).toBeGreaterThan(0);
  });

  test("paired somewhere the picker cannot tell us: the next Start asks again and wakes it", async () => {
    await mount();
    expect(bridge.wakes).toBe(0);

    bridge.hasKey = true;
    await act(async () => { control!.sessionStarting(116); });
    await settle(4_000);

    expect(bridge.wakes).toBeGreaterThan(0);
  });
});
