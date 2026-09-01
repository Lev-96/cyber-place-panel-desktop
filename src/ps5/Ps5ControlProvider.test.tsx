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
const bridge = vi.hoisted(() => ({
  answer: "awake" as string,
  probes: 0,
  rests: 0,
  wakes: 0,
  restResult: { sent: true } as { sent: boolean; code?: string },
  /** What the machine's key vault answers, or null for a preload that cannot be asked. */
  hasKey: true as boolean | null,
  /** Which console each command was aimed at — the whole point with more than one. */
  wakeTargets: [] as string[],
  restTargets: [] as string[],
  /** Per-console answers, for the tests that run a venue with several. */
  answers: {} as Record<string, string>,
  /** address → host-id, so each fake console has its own identity. */
  hosts: {} as Record<string, string>,
}));

vi.mock("@/api/pcs", () => ({ apiListPcsEverywhere: async () => { pcs.calls += 1; return pcs; } }));
vi.mock("@/api/sessions", () => ({ apiListAllActiveSessions: async () => sessions }));
vi.mock("@/api/ps5", () => ({
  apiReportUnexpectedWake: async (...a: unknown[]) => { reported.calls.push(a); },
}));
const decided = vi.hoisted(() => ({ branches: [] as number[], deliver: null as null | ((e: unknown) => void) }));
vi.mock("@/realtime/usePs5Realtime", () => ({
  usePs5WakeDecided: (branchId: number, onEvent: (e: unknown) => void) => {
    if (branchId) { decided.branches.push(branchId); decided.deliver = onEvent; }
  },
}));
// The key is what identifies WHICH sentence was chosen; the wording itself is
// the translations file's business and is tested there.
vi.mock("@/i18n/translations", () => ({ tActive: (key: string) => key }));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: { id: 3, role: "company_owner" } }) }));
const told = vi.hoisted(() => ({ messages: [] as string[] }));
vi.mock("@/ui/notify", () => ({ notify: { message: (_kind: string, text: string) => { told.messages.push(text); } } }));

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
  told.messages = [];
  decided.branches = [];
  decided.deliver = null;
  bridge.answer = "awake";
  bridge.probes = 0;
  bridge.rests = 0;
  bridge.wakes = 0;
  bridge.restResult = { sent: true };
  bridge.hasKey = true;
  bridge.wakeTargets = [];
  bridge.restTargets = [];
  bridge.answers = {};
  bridge.hosts = {};

  (globalThis as Record<string, unknown>).cyberplacePS5 = {
    discover: async () => ({ consoles: [], probed: [], warnings: [] }),
    probe: async (addresses: string[]) => {
      bridge.probes += 1;
      return {
        // Each address answers as ITS OWN console. A harness that replies with
        // one host-id for every address cannot show cross-talk even when there
        // is some, which is the failure these tests are for.
        consoles: addresses.map((address) => ({
          hostId: bridge.hosts[address] ?? "5C9666876D85",
          name: "PS5-172", type: "PS5",
          address,
          state: bridge.answers[address] ?? bridge.answer,
          systemVersion: "13600007",
        })),
        probed: addresses,
        warnings: [],
      };
    },
    capabilities: async () => ({ discover: true, observe: true, wake: true, rest: true }),
    wake: async (hostId: string, address: string) => {
      bridge.wakes += 1;
      bridge.wakeTargets.push(`${hostId}@${address}`);
      return { sent: true };
    },
    rest: async (hostId: string, address: string) => {
      bridge.rests += 1;
      bridge.restTargets.push(`${hostId}@${address}`);
      return bridge.restResult;
    },
    // `null` stands for an older preload that has no such channel: the map
    // then holds nothing for this console, which reads as "not asked".
    ...(bridge.hasKey === null ? {} : {
      hasCredential: async () => ({ has: bridge.hasKey, available: true, persisted: true }),
    }),
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

  test("a console with no session is checked every few seconds, not every ten", async () => {
    // The state where the interesting thing is somebody pressing the console's
    // own power button — and the owner is meant to be asked at once, not after
    // a ten-second silence.
    pcs.data = [device()];
    bridge.answer = "rest";

    render(<Ps5ControlProvider><div /></Ps5ControlProvider>);
    await settle();
    const after = bridge.probes;

    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });

    // Three seconds apart is at least three looks in ten, not one.
    expect(bridge.probes - after).toBeGreaterThanOrEqual(2);
  });

  test("a console in use is left on the slower rhythm", async () => {
    // Nothing to catch here: the console is authorised to be awake, so asking
    // it twenty times a minute buys nothing and costs the venue's network.
    pcs.data = [device()];
    sessions.data = [{ id: 5, pc_id: 96, status: "active" }];

    render(<Ps5ControlProvider><div /></Ps5ControlProvider>);
    await settle();
    const after = bridge.probes;

    await act(async () => { await vi.advanceTimersByTimeAsync(9_000); });

    expect(bridge.probes - after).toBeLessThanOrEqual(1);
  });

  test("the owner's answer is listened for in every venue that has a console", async () => {
    // The answer travels on the branch feed. Listening only to the first venue
    // is how a second one would never hear "no" — and never go to sleep.
    pcs.data = [
      device({ id: 96, branch_id: 3 }),
      device({ id: 97, branch_id: 4, console_host_id: "AABBCCDDEEFF", place: { id: 2, number: 2, name: "PS5 II", type: "standard", platform: "ps5" } }),
    ];

    render(<Ps5ControlProvider><div /></Ps5ControlProvider>);
    await settle();

    expect([...new Set(decided.branches)].sort()).toEqual([3, 4]);
  });

  test("a refusal puts that console to sleep", async () => {
    pcs.data = [device()];
    render(<Ps5ControlProvider><div /></Ps5ControlProvider>);
    await settle();

    // The console was reported as switched on with nothing authorising it.
    await waitFor(() => expect(reported.calls.length).toBe(1));
    const eventId = (reported.calls[0] as unknown[])[1] as string;

    // The owner says no, and it is asked to sleep — without waiting out the
    // ten seconds, because the answer already arrived.
    await act(async () => {
      decided.deliver?.({ device_id: 96, event_uuid: eventId, approved: false });
      await vi.advanceTimersByTimeAsync(2_000);
    });

    await waitFor(() => expect(bridge.rests).toBeGreaterThan(0));
  });

  test("an approval leaves it alone, past the ten seconds", async () => {
    pcs.data = [device()];
    render(<Ps5ControlProvider><div /></Ps5ControlProvider>);
    await settle();
    await waitFor(() => expect(reported.calls.length).toBe(1));
    const eventId = (reported.calls[0] as unknown[])[1] as string;

    await act(async () => {
      decided.deliver?.({ device_id: 96, event_uuid: eventId, approved: true });
      await vi.advanceTimersByTimeAsync(2_000);
    });
    // Well past the grace window: "yes, that was me" is an answer, not a pause.
    await act(async () => { await vi.advanceTimersByTimeAsync(20_000); });

    expect(bridge.rests).toBe(0);
  });

  test("a console that refuses to sleep is not left to be noticed by accident", async () => {
    // The console answers with its own "a Remote Play session is already in
    // use". The panel goes on trying, but the person who just answered "no"
    // about that console should not have to spot a chip on a tile to learn it
    // is still awake.
    bridge.restResult = { sent: false, code: "IN_USE" };
    pcs.data = [device()];

    render(<Ps5ControlProvider><div /></Ps5ControlProvider>);
    await settle();
    await waitFor(() => expect(reported.calls.length).toBe(1));
    const eventId = (reported.calls[0] as unknown[])[1] as string;

    await act(async () => {
      decided.deliver?.({ device_id: 96, event_uuid: eventId, approved: false });
      await vi.advanceTimersByTimeAsync(2_000);
    });

    await waitFor(() => expect(told.messages).toContain("ps5.error.IN_USE"));
  });

  test("a console this machine has no key for is not shouted at", async () => {
    // The wake datagram is authenticated: with no key nothing can be sent, so
    // nothing is. Before this the attempt failed instantly, the next
    // observation wiped the error, and forty-five seconds later the tile
    // blamed the console's own "turn on from network" setting — sending staff
    // into the PlayStation's menus over a key that was never on this computer.
    bridge.hasKey = false;
    bridge.answer = "rest";
    pcs.data = [device()];
    sessions.data = [{ pc_id: 96 }];

    render(<Ps5ControlProvider><div /></Ps5ControlProvider>);
    await settle();
    await act(async () => { await vi.advanceTimersByTimeAsync(11_000); });

    expect(bridge.wakes).toBe(0);
    expect(told.messages).toContain("ps5.error.NO_CREDENTIAL");
  });

  test("a console this machine DOES have a key for is woken for its session", async () => {
    bridge.hasKey = true;
    bridge.answer = "rest";
    pcs.data = [device()];
    sessions.data = [{ pc_id: 96 }];

    render(<Ps5ControlProvider><div /></Ps5ControlProvider>);
    await settle();
    await act(async () => { await vi.advanceTimersByTimeAsync(3_000); });

    expect(bridge.wakes).toBeGreaterThan(0);
    expect(told.messages).not.toContain("ps5.error.NO_CREDENTIAL");
  });

  test("a preload that cannot be asked about keys still wakes the console", async () => {
    // "Not asked" is not "absent". Refusing on an unasked question would break
    // every wake on a build whose bridge has no such channel.
    // Removed from the object the harness already built: a preload without
    // the channel at all, which is what an older desktop build is.
    delete ((globalThis as Record<string, unknown>).cyberplacePS5 as Record<string, unknown>).hasCredential;
    bridge.answer = "rest";
    pcs.data = [device()];
    sessions.data = [{ pc_id: 96 }];

    render(<Ps5ControlProvider><div /></Ps5ControlProvider>);
    await settle();
    await act(async () => { await vi.advanceTimersByTimeAsync(3_000); });

    expect(bridge.wakes).toBeGreaterThan(0);
  });

  test("a session wakes ITS console and no other, across two venues", async () => {
    // The property the venue is about to depend on: three consoles, three
    // places, two branches, and a session on exactly one of them. Nothing here
    // may reach the other two — not the wake, not the question, not a rest.
    bridge.hosts = {
      "192.168.1.35": "AAAA00000001",
      "192.168.1.36": "BBBB00000002",
      "192.168.1.37": "CCCC00000003",
    };
    bridge.answers = {
      "192.168.1.35": "rest",
      "192.168.1.36": "rest",
      "192.168.1.37": "rest",
    };
    pcs.data = [
      device({ id: 101, branch_id: 3, console_host_id: "AAAA00000001", console_address: "192.168.1.35" }),
      device({ id: 102, branch_id: 3, console_host_id: "BBBB00000002", console_address: "192.168.1.36" }),
      device({ id: 103, branch_id: 9, console_host_id: "CCCC00000003", console_address: "192.168.1.37" }),
    ];
    sessions.data = [{ pc_id: 102 }];

    render(<Ps5ControlProvider><div /></Ps5ControlProvider>);
    await settle();
    await act(async () => { await vi.advanceTimersByTimeAsync(3_000); });

    expect([...new Set(bridge.wakeTargets)]).toEqual(["BBBB00000002@192.168.1.36"]);
    // The two with no session are asleep and should simply be left alone.
    expect(bridge.restTargets).toEqual([]);
    expect(reported.calls).toEqual([]);
  });

  test("stopping one session sleeps one console, and only that one", async () => {
    bridge.hosts = { "192.168.1.35": "AAAA00000001", "192.168.1.36": "BBBB00000002" };
    // Both awake, both running a session — the state after two starts.
    bridge.answers = { "192.168.1.35": "awake", "192.168.1.36": "awake" };
    pcs.data = [
      device({ id: 101, branch_id: 3, console_host_id: "AAAA00000001", console_address: "192.168.1.35" }),
      device({ id: 102, branch_id: 3, console_host_id: "BBBB00000002", console_address: "192.168.1.36" }),
    ];
    sessions.data = [{ pc_id: 101 }, { pc_id: 102 }];

    render(<Ps5ControlProvider><div /></Ps5ControlProvider>);
    await settle();
    await act(async () => { await vi.advanceTimersByTimeAsync(3_000); });
    expect(bridge.restTargets).toEqual([]);

    // Session on 102 ends. 101 is still being played.
    //
    // No local Stop was pressed on THIS panel, which is the case of a second
    // panel in the venue: it learns from the list, treats the awake console as
    // a switch-on it cannot explain, asks, and sleeps it when nobody answers.
    // So the wait covers the 30 s list refresh AND the ten-second question.
    sessions.data = [{ pc_id: 101 }];
    await act(async () => { await vi.advanceTimersByTimeAsync(31_000); });
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });

    expect([...new Set(bridge.restTargets)]).toEqual(["BBBB00000002@192.168.1.36"]);
    // And the console still in a session is never asked to sleep, however long
    // the panel runs.
    expect(bridge.restTargets.some((t) => t.startsWith("AAAA00000001"))).toBe(false);
  });

  test("the question names the console that woke, not a neighbour", async () => {
    bridge.hosts = { "192.168.1.35": "AAAA00000001", "192.168.1.36": "BBBB00000002" };
    bridge.answers = { "192.168.1.35": "rest", "192.168.1.36": "awake" };
    pcs.data = [
      device({ id: 101, branch_id: 3, console_host_id: "AAAA00000001", console_address: "192.168.1.35" }),
      device({ id: 102, branch_id: 9, console_host_id: "BBBB00000002", console_address: "192.168.1.36" }),
    ];

    render(<Ps5ControlProvider><div /></Ps5ControlProvider>);
    await settle();
    await waitFor(() => expect(reported.calls.length).toBe(1));

    // Reported against device 102 — the one that is awake — and its branch.
    expect((reported.calls[0] as unknown[])[0]).toBe(102);
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
