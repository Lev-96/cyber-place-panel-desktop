import { beforeEach, describe, expect, test, vi, type Mock } from "vitest";
import { Ps5Controller, type ConsoleInput, type ControllerPorts } from "./Ps5Controller";

/**
 * What the controller does with what the machine decides.
 *
 * The machine is tested separately and knows nothing about the world; this is
 * about the world: commands that must not be issued twice, failures that must
 * be surfaced rather than swallowed, several consoles that must not interfere
 * with each other, and the one rule the whole feature stands on — nothing here
 * reports a console asleep or awake because a command was sent.
 */

let clock = 1_000_000;
let ids = 0;
let ports: ControllerPorts;
let wake: Mock<ControllerPorts["wake"]>;
let rest: Mock<ControllerPorts["rest"]>;
let report: Mock<ControllerPorts["reportUnexpectedWake"]>;
let logs: Array<{ event: string; fields: Record<string, unknown> }>;

const input = (over: Partial<ConsoleInput> = {}): ConsoleInput => ({
  deviceId: 1,
  hostId: "AAA",
  address: "192.168.1.10",
  actual: "rest",
  hasSession: false,
  starting: false,
  stopping: false,
  maintenance: false,
  // These describe a rest-capable transport; the refusal path has its own tests
  // on the machine, which is where that decision is made.
  canRest: true,
  decision: null,
  ...over,
});

beforeEach(() => {
  clock = 1_000_000;
  ids = 0;
  logs = [];
  wake = vi.fn(async () => ({ sent: true }));
  rest = vi.fn(async () => ({ sent: false, code: "UNSUPPORTED_BY_TRANSPORT" }));
  report = vi.fn(async () => {});
  ports = {
    wake, rest, reportUnexpectedWake: report,
    log: (event, fields) => logs.push({ event, fields }),
    now: () => clock,
    newId: () => `e${++ids}`,
  };
});

describe("issuing commands", () => {
  test("a session start wakes the console once, however many ticks pass", async () => {
    const c = new Ps5Controller(ports);

    await c.tick([input({ starting: true })]);
    clock += 10_000;
    await c.tick([input({ starting: true })]);
    clock += 5_000;
    await c.tick([input({ starting: true })]);

    // Three monitor ticks with the console still asleep — one datagram. An
    // operator jabbing Start produces one wake, not three.
    expect(wake).toHaveBeenCalledTimes(1);
  });

  test("but a console that has not woken is asked again, later", async () => {
    // A datagram can be dropped and UDP will not say so. One retry a
    // twenty-second window is a retry; one every tick is traffic.
    const c = new Ps5Controller(ports);

    await c.tick([input({ starting: true })]);
    clock += 25_000;
    await c.tick([input({ starting: true })]);

    expect(wake).toHaveBeenCalledTimes(2);
  });

  test("a sent command is not a confirmed one", async () => {
    const c = new Ps5Controller(ports);

    await c.tick([input({ starting: true })]);

    // The datagram went out. The console has said nothing yet, so the state is
    // WAKING — never ACTIVE.
    expect(wake).toHaveBeenCalledWith("AAA", "192.168.1.10");
    expect(c.view("AAA").snapshot.state).toBe("WAKING");
  });

  test("the console being awake is what makes it ACTIVE", async () => {
    const c = new Ps5Controller(ports);

    await c.tick([input({ starting: true })]);
    await c.tick([input({ starting: true, actual: "awake" })]);

    expect(c.view("AAA").snapshot.state).toBe("ACTIVE");
  });
});

describe("failures are surfaced", () => {
  test("a rest command this transport cannot send leaves an error, not a sleep", async () => {
    // The whole honesty rule in one test: today's transport has no rest
    // command. The console must not be shown as asleep.
    const c = new Ps5Controller(ports);

    await c.tick([input({ actual: "awake", stopping: true })]);

    expect(rest).toHaveBeenCalledTimes(1);
    expect(c.view("AAA").snapshot.state).toBe("ERROR");
    expect(c.view("AAA").snapshot.error).toBe("UNSUPPORTED_BY_TRANSPORT");
    expect(logs.some((l) => l.event === "PS5_TRANSPORT_ERROR")).toBe(true);
  });

  test("a missing wake key is reported as such, not as a generic failure", async () => {
    wake.mockResolvedValue({ sent: false, code: "NO_CREDENTIAL" });
    const c = new Ps5Controller(ports);

    await c.tick([input({ starting: true })]);

    expect(c.view("AAA").snapshot.error).toBe("NO_CREDENTIAL");
  });

  test("a console with no known address is not silently skipped", async () => {
    const c = new Ps5Controller(ports);

    await c.tick([input({ starting: true, address: null })]);

    expect(wake).not.toHaveBeenCalled();
    expect(c.view("AAA").snapshot.error).toBe("DEVICE_NOT_FOUND");
  });

  test("a thrown transport error does not take the tick down with it", async () => {
    wake.mockRejectedValue(new Error("network unreachable"));
    const c = new Ps5Controller(ports);

    await expect(c.tick([input({ starting: true })])).resolves.toBeUndefined();
    expect(c.view("AAA").snapshot.error).toBe("TRANSPORT_ERROR");
  });

  test("a failed command is not retried on the very next tick", async () => {
    wake.mockResolvedValue({ sent: false, code: "TRANSPORT_ERROR" });
    const c = new Ps5Controller(ports);

    await c.tick([input({ starting: true })]);
    clock += 10_000;
    await c.tick([input({ starting: true })]);

    expect(wake).toHaveBeenCalledTimes(1);

    // …but it is tried again once the backoff is over. A console that was
    // unreachable for a minute must still start working.
    clock += 25_000;
    await c.tick([input({ starting: true })]);
    expect(wake).toHaveBeenCalledTimes(2);
  });
});

describe("an operator who has just pressed something", () => {
  test("a press is not made to wait out a cooldown it did not cause", async () => {
    // The monitor's rate limit exists so a console is not shouted at every ten
    // seconds all shift. Somebody standing at the counter who has just pressed
    // Start is not the monitor, and waiting out a window that began before they
    // touched anything is exactly what "it takes ages" means.
    const c = new Ps5Controller(ports);

    await c.tick([input({ starting: true })]);
    expect(wake).toHaveBeenCalledTimes(1);

    clock += 2_000;
    await c.tick([input({ starting: true, urgent: true })]);

    expect(wake).toHaveBeenCalledTimes(2);
  });

  test("a press gets past a recent failure too", async () => {
    wake.mockResolvedValueOnce({ sent: false, code: "TRANSPORT_ERROR" });
    const c = new Ps5Controller(ports);

    await c.tick([input({ starting: true })]);
    expect(wake).toHaveBeenCalledTimes(1);

    // The backoff would normally hold this for half a minute.
    clock += 3_000;
    await c.tick([input({ starting: true, urgent: true })]);

    expect(wake).toHaveBeenCalledTimes(2);
  });

  test("but two presses do not put two commands on the wire at once", async () => {
    // Urgency skips the waiting, not the guard: a command already in flight is
    // not made faster by sending it again.
    // Held open deliberately: the second tick must find the first command still
    // on the wire.
    let release = () => {};
    wake.mockImplementation(async () => {
      await new Promise<void>((resolve) => { release = resolve; });
      return { sent: true };
    });
    const c = new Ps5Controller(ports);

    const first = c.tick([input({ starting: true, urgent: true })]);
    await Promise.resolve();
    await c.tick([input({ starting: true, urgent: true })]);

    expect(wake).toHaveBeenCalledTimes(1);
    release();
    await first;
  });

  test("the monitor itself still waits its turn", async () => {
    // Without a press, the cooldown is exactly as it was: one datagram, not one
    // per tick.
    const c = new Ps5Controller(ports);

    await c.tick([input({ starting: true })]);
    clock += 2_000;
    await c.tick([input({ starting: true })]);
    clock += 2_000;
    await c.tick([input({ starting: true })]);

    expect(wake).toHaveBeenCalledTimes(1);
  });
});

describe("several consoles", () => {
  test("starting a session on one does not touch the other", async () => {
    const c = new Ps5Controller(ports);

    await c.tick([
      input({ deviceId: 1, hostId: "AAA", address: "192.168.1.10", starting: true }),
      input({ deviceId: 2, hostId: "BBB", address: "192.168.1.11" }),
    ]);

    expect(wake).toHaveBeenCalledTimes(1);
    expect(wake).toHaveBeenCalledWith("AAA", "192.168.1.10");
    expect(c.view("BBB").snapshot.state).toBe("REST");
  });

  test("each console keeps its own lifecycle", async () => {
    const c = new Ps5Controller(ports);

    await c.tick([
      input({ hostId: "AAA", actual: "awake", hasSession: true }),
      input({ hostId: "BBB", actual: "unreachable" }),
      input({ hostId: "CCC", actual: "awake" }),
    ]);

    expect(c.view("AAA").snapshot.state).toBe("ACTIVE");
    expect(c.view("BBB").snapshot.state).toBe("OFFLINE");
    expect(c.view("CCC").snapshot.state).toBe("UNEXPECTED_WAKE");
  });

  test("one console's pending countdown does not decide another's fate", async () => {
    // Two consoles switched on eleven seconds apart. If they shared state, the
    // second would inherit the first one's countdown, find it already expired
    // and be put to sleep without the owner ever being asked about it.
    const c = new Ps5Controller(ports);

    await c.tick([
      input({ deviceId: 1, hostId: "AAA", address: "192.168.1.10", actual: "awake" }),
      input({ deviceId: 2, hostId: "BBB", address: "192.168.1.11", actual: "rest" }),
    ]);
    expect(report).toHaveBeenCalledWith({ deviceId: 1, hostId: "AAA", eventId: "e1" });

    // Eleven seconds later the FIRST console's countdown has run out — and the
    // second one has only just been switched on.
    clock += 11_000;
    await c.tick([
      input({ deviceId: 1, hostId: "AAA", address: "192.168.1.10", actual: "awake" }),
      input({ deviceId: 2, hostId: "BBB", address: "192.168.1.11", actual: "awake" }),
    ]);

    // The second console gets its OWN question and its own ten seconds. Sharing
    // state would have it inherit an expired countdown and be put to sleep
    // without the owner ever being asked.
    expect(c.view("BBB").snapshot.state).toBe("UNEXPECTED_WAKE");
    expect(c.view("BBB").snapshot.wakeEventId).not.toBe("e1");
    expect(report).toHaveBeenCalledTimes(2);
    // Exactly one console was asked to sleep: the one whose time was up.
    expect(rest).toHaveBeenCalledTimes(1);
    expect(rest).toHaveBeenCalledWith("AAA", "192.168.1.10");
  });

  test("an unbound console stops being tracked", async () => {
    const c = new Ps5Controller(ports);
    await c.tick([input({ hostId: "AAA", actual: "awake", hasSession: true })]);

    c.forget(["AAA"]);

    expect(c.view("AAA").snapshot.state).toBe("UNKNOWN");
  });
});

describe("unexpected wakes", () => {
  test("the owner is asked once per event, not once per tick", async () => {
    const c = new Ps5Controller(ports);

    await c.tick([input({ actual: "awake" })]);
    clock += 1_000;
    await c.tick([input({ actual: "awake" })]);
    clock += 1_000;
    await c.tick([input({ actual: "awake" })]);

    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith({ deviceId: 1, hostId: "AAA", eventId: "e1" });
  });

  test("a report that failed to reach the backend is tried again", async () => {
    // Otherwise one dropped request means the owner is never asked about a
    // console that is awake in their venue.
    report.mockRejectedValueOnce(new Error("offline"));
    const c = new Ps5Controller(ports);

    await c.tick([input({ actual: "awake" })]);
    expect(c.view("AAA").snapshot.state).toBe("UNEXPECTED_WAKE");

    clock += 1_000;
    await c.tick([input({ actual: "awake" })]);
    expect(report).toHaveBeenCalledTimes(2);
  });

  test("the ten seconds still run out when the owner was never reachable", async () => {
    report.mockRejectedValue(new Error("offline"));
    const c = new Ps5Controller(ports);

    await c.tick([input({ actual: "awake" })]);
    clock += 11_000;
    await c.tick([input({ actual: "awake" })]);

    // It tries to put the console to sleep — and honestly records that this
    // transport cannot.
    expect(rest).toHaveBeenCalledTimes(1);
    expect(c.view("AAA").snapshot.error).toBe("UNSUPPORTED_BY_TRANSPORT");
  });

  test("a session starting during the countdown cancels it", async () => {
    const c = new Ps5Controller(ports);

    await c.tick([input({ actual: "awake" })]);
    clock += 2_000;
    await c.tick([input({ actual: "awake", starting: true })]);
    clock += 20_000;
    await c.tick([input({ actual: "awake", hasSession: true })]);

    // The stale countdown must never reach into a live session.
    expect(rest).not.toHaveBeenCalled();
    expect(c.view("AAA").snapshot.state).toBe("ACTIVE");
  });
});

describe("what is written to the log", () => {
  test("state changes and commands are recorded, and no key ever is", async () => {
    const c = new Ps5Controller(ports);

    await c.tick([input({ starting: true })]);

    const events = logs.map((l) => l.event);
    expect(events).toContain("PS5_STATE_CHANGED");
    expect(events).toContain("PS5_WAKE_REQUESTED");
    // The controller never sees a key — it names a console and the main process
    // looks up what it may send — so there is nothing here to leak.
    expect(JSON.stringify(logs)).not.toMatch(/credential|registKey|secret/i);
  });
});

describe("every command leaves one line saying how it ended and how long it took", () => {
  // The record a slow evening is diagnosed from (2026-11-02): `ps5.log` keeps
  // these lines, so "Start took ages" becomes a number per console.
  const done = () => logs.filter((l) => l.event === "PS5_COMMAND_DONE").map((l) => l.fields);

  test("a sent wake: the time it took, and 'sent' — not 'woke'", async () => {
    wake.mockImplementation(async () => { clock += 40; return { sent: true }; });
    const c = new Ps5Controller(ports);

    await c.tick([input({ starting: true })]);

    expect(done()).toEqual([{ hostId: "AAA", command: "wake", result: "sent", ms: 40 }]);
  });

  test("a rest the console refused: its code and the time spent getting there", async () => {
    rest.mockImplementation(async () => { clock += 45_000; return { sent: false, code: "TIMEOUT" }; });
    const c = new Ps5Controller(ports);

    await c.tick([input({ actual: "awake", stopping: true })]);

    expect(done()).toEqual([{ hostId: "AAA", command: "rest", result: "TIMEOUT", ms: 45_000 }]);
  });

  test("a transport that threw", async () => {
    wake.mockImplementation(async () => { clock += 5; throw new Error("ipc gone"); });
    const c = new Ps5Controller(ports);

    await c.tick([input({ starting: true })]);

    expect(done()).toEqual([{ hostId: "AAA", command: "wake", result: "threw", ms: 5 }]);
  });
});

describe("one panel of the venue rests a console (2026-11-08)", () => {
  // Two panels resting one PS5 together were answered "Remote is already in
  // use" for minutes and the console stayed awake: it takes one Remote Play
  // session at a time. The backend names one panel; the others stand aside.
  let claim: Mock<NonNullable<ControllerPorts["claimRest"]>>;
  let release: Mock<NonNullable<ControllerPorts["releaseRest"]>>;
  const stopping = (over: Partial<ConsoleInput> = {}) => input({ actual: "awake", stopping: true, ...over });

  beforeEach(() => {
    claim = vi.fn(async () => "granted" as const);
    release = vi.fn();
    rest.mockImplementation(async () => ({ sent: true }));
    ports = { ...ports, claimRest: claim, releaseRest: release };
  });

  test("the panel that holds the console rests it, and keeps it while it goes down", async () => {
    const c = new Ps5Controller(ports);
    await c.tick([stopping()]);

    expect(claim).toHaveBeenCalledWith(1);
    expect(rest).toHaveBeenCalledTimes(1);
    // Given back only when the rest did not go out: a console on its way down
    // must not get a second panel's session.
    expect(release).not.toHaveBeenCalled();
  });

  test("another panel resting it: nothing is sent, nothing is an error", async () => {
    claim.mockImplementation(async () => "elsewhere");
    const c = new Ps5Controller(ports);
    await c.tick([stopping()]);

    expect(rest).not.toHaveBeenCalled();
    expect(c.view("AAA").snapshot.error).toBeNull();
    expect(c.view("AAA").snapshot.state).not.toBe("ERROR");
    expect(logs.some((l) => l.event === "PS5_REST_ELSEWHERE")).toBe(true);
    expect(logs.find((l) => l.event === "PS5_COMMAND_DONE")?.fields.result).toBe("ELSEWHERE");
  });

  test("it is left to that panel for ten seconds, a press included, then asked again", async () => {
    claim.mockImplementation(async () => "elsewhere");
    const c = new Ps5Controller(ports);
    await c.tick([stopping()]);

    clock += 5_000;
    c.pressed("AAA");
    await c.tick([stopping({ urgent: true })]);
    expect(claim).toHaveBeenCalledTimes(1);

    claim.mockImplementation(async () => "granted");
    clock += 6_000;
    await c.tick([stopping({ urgent: true })]);
    expect(claim).toHaveBeenCalledTimes(2);
    expect(rest).toHaveBeenCalledTimes(1);
  });

  test("without a press too: asked again after ten seconds, not the twenty of a resend", async () => {
    claim.mockImplementation(async () => "elsewhere");
    const c = new Ps5Controller(ports);
    await c.tick([stopping()]);

    clock += 9_000;
    await c.tick([stopping()]);
    expect(claim).toHaveBeenCalledTimes(1);

    claim.mockImplementation(async () => "granted");
    clock += 2_000;
    await c.tick([stopping()]);
    expect(claim).toHaveBeenCalledTimes(2);
    expect(rest).toHaveBeenCalledTimes(1);
  });

  test("an unbound and re-bound console starts without the other panel's wait", async () => {
    claim.mockImplementation(async () => "elsewhere");
    const c = new Ps5Controller(ports);
    await c.tick([stopping()]);
    c.forget(["AAA"]);

    claim.mockImplementation(async () => "granted");
    await c.tick([stopping()]);
    expect(rest).toHaveBeenCalledTimes(1);
  });

  test("a rest that threw gives the console back", async () => {
    rest.mockImplementation(async () => { throw new Error("ipc gone"); });
    const c = new Ps5Controller(ports);
    await c.tick([stopping()]);

    expect(release).toHaveBeenCalledWith(1);
  });

  test("a backend that cannot be asked does not stop the rest", async () => {
    claim.mockImplementation(async () => "unknown");
    const c = new Ps5Controller(ports);
    await c.tick([stopping()]);

    expect(rest).toHaveBeenCalledTimes(1);
    expect(release).not.toHaveBeenCalled();
  });

  test("a claim port that throws reads as 'could not ask'", async () => {
    claim.mockImplementation(async () => { throw new Error("offline"); });
    const c = new Ps5Controller(ports);
    await c.tick([stopping()]);

    expect(rest).toHaveBeenCalledTimes(1);
  });

  test("a rest that did not go out gives the console back", async () => {
    rest.mockImplementation(async () => ({ sent: false, code: "IN_USE" }));
    const c = new Ps5Controller(ports);
    await c.tick([stopping()]);

    expect(release).toHaveBeenCalledWith(1);
  });

  test("a session started while the backend was being asked: the rest is not sent", async () => {
    let answer: (v: "granted") => void = () => {};
    claim.mockImplementation(() => new Promise((resolve) => { answer = resolve; }));
    const c = new Ps5Controller(ports);

    const first = c.tick([stopping()]);
    // The next tick sees the player: the console is wanted awake now.
    await c.tick([input({ actual: "awake", hasSession: true, starting: true })]);
    answer("granted");
    await first;

    expect(rest).not.toHaveBeenCalled();
    expect(release).toHaveBeenCalledWith(1);
  });

  test("waking never asks the backend", async () => {
    const c = new Ps5Controller(ports);
    await c.tick([input({ starting: true })]);

    expect(wake).toHaveBeenCalledTimes(1);
    expect(claim).not.toHaveBeenCalled();
  });

  test("two consoles are claimed separately", async () => {
    const c = new Ps5Controller(ports);
    await c.tick([
      stopping({ deviceId: 1, hostId: "AAA" }),
      stopping({ deviceId: 2, hostId: "BBB", address: "192.168.1.11" }),
    ]);

    expect(claim.mock.calls.map(([id]) => id).sort()).toEqual([1, 2]);
    expect(rest).toHaveBeenCalledTimes(2);
  });
});

describe("a console that asks for its user's login passcode (2026-11-08)", () => {
  // Nothing the panel sends changes that answer; a player signing in does.
  // A press used to re-ask the console every 1.5 s for the whole 45 s window.
  const stopping = (over: Partial<ConsoleInput> = {}) => input({ actual: "awake", stopping: true, ...over });

  test("is left alone for fifteen seconds, a press included, then asked again", async () => {
    rest.mockImplementation(async () => ({ sent: false, code: "PASSCODE_REQUIRED" }));
    const c = new Ps5Controller(ports);
    await c.tick([stopping()]);

    for (let i = 0; i < 10; i++) {
      clock += 1_400;
      await c.tick([stopping({ urgent: true })]);
    }
    expect(rest).toHaveBeenCalledTimes(1);

    clock += 1_100; // 15.1 s after the refusal
    await c.tick([stopping({ urgent: true })]);
    expect(rest).toHaveBeenCalledTimes(2);
  });

  test("a saved code the console refuses is held the same way", async () => {
    rest.mockImplementation(async () => ({ sent: false, code: "PASSCODE_WRONG" }));
    const c = new Ps5Controller(ports);
    await c.tick([stopping()]);
    clock += 5_000;
    await c.tick([stopping({ urgent: true })]);
    expect(rest).toHaveBeenCalledTimes(1);
  });

  test("the error stays on the tile meanwhile", async () => {
    rest.mockImplementation(async () => ({ sent: false, code: "PASSCODE_REQUIRED" }));
    const c = new Ps5Controller(ports);
    await c.tick([stopping()]);

    expect(c.view("AAA").snapshot.error).toBe("PASSCODE_REQUIRED");
  });

  test("once it sleeps, or is unbound, the wait is gone", async () => {
    rest.mockImplementation(async () => ({ sent: false, code: "PASSCODE_REQUIRED" }));
    const c = new Ps5Controller(ports);
    await c.tick([stopping()]);
    c.forget(["AAA"]);

    rest.mockImplementation(async () => ({ sent: true }));
    await c.tick([stopping()]);
    expect(rest).toHaveBeenCalledTimes(2);
  });

  test("any other refusal keeps the old rhythm", async () => {
    rest.mockImplementation(async () => ({ sent: false, code: "IN_USE" }));
    const c = new Ps5Controller(ports);
    await c.tick([stopping()]);

    clock += 1_500;
    await c.tick([stopping({ urgent: true })]);
    expect(rest).toHaveBeenCalledTimes(2);
  });

  test("waking is never held by it", async () => {
    rest.mockImplementation(async () => ({ sent: false, code: "PASSCODE_REQUIRED" }));
    const c = new Ps5Controller(ports);
    await c.tick([stopping()]);

    clock += 2_000;
    await c.tick([input({ actual: "rest", starting: true, urgent: true })]);
    expect(wake).toHaveBeenCalledTimes(1);
  });
});
