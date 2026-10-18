import { afterEach, beforeEach, describe, expect, test, vi, type Mock } from "vitest";
import { Ps5Controller, type CommandOutcome, type ConsoleInput, type ControllerPorts } from "./Ps5Controller";
import { standby, STANDBY_CANCELLED } from "../../electron/ps5/playactor";

/**
 * Stop, then Start again at once, on the same PlayStation (2026-10-18).
 *
 * The latest press wins. A rest that is still being retried when the next
 * session starts is withdrawn; whatever it did reach is undone by a wake taken
 * from the console's own answer, never from a timer; and a failure of the
 * withdrawn rest never holds that wake back.
 */

let clock = 1_000_000;
let ports: ControllerPorts;
let wake: Mock<ControllerPorts["wake"]>;
let rest: Mock<ControllerPorts["rest"]>;
let cancelRest: Mock<NonNullable<ControllerPorts["cancelRest"]>>;
let logs: string[];

const input = (over: Partial<ConsoleInput> = {}): ConsoleInput => ({
  deviceId: 1, hostId: "AAA", address: "192.168.1.10",
  actual: "awake", hasSession: false, starting: false, stopping: false,
  maintenance: false, canRest: true, decision: null,
  ...over,
});

/** A rest the test answers when it chooses: the main process retrying. */
const pendingRest = () => {
  let answer!: (o: CommandOutcome) => void;
  rest.mockImplementationOnce(() => new Promise<CommandOutcome>((r) => { answer = r; }));
  return (o: CommandOutcome) => answer(o);
};

beforeEach(() => {
  clock = 1_000_000;
  logs = [];
  wake = vi.fn(async () => ({ sent: true }));
  rest = vi.fn(async () => ({ sent: true }));
  cancelRest = vi.fn();
  ports = {
    wake, rest, cancelRest,
    reportUnexpectedWake: async () => {},
    log: (event) => logs.push(event),
    now: () => clock,
    newId: () => "e1",
  };
});

describe("Stop then Start on the same console", () => {
  test("a rest still in flight is withdrawn the moment a session starts, once", async () => {
    const c = new Ps5Controller(ports);
    const answer = pendingRest();

    // Stop: rest goes on the wire and stays there (the retry loop).
    const stopTick = c.tick([input({ stopping: true, urgent: true })]);
    await Promise.resolve();
    expect(rest).toHaveBeenCalledTimes(1);

    // Start, then two more monitor ticks while the rest is still out.
    await c.tick([input({ hasSession: true, urgent: true })]);
    await c.tick([input({ hasSession: true, urgent: true })]);
    expect(cancelRest).toHaveBeenCalledTimes(1);
    expect(cancelRest).toHaveBeenCalledWith("AAA");
    expect(logs).toContain("PS5_REST_WITHDRAWN");

    answer({ sent: false, code: "CANCELLED" });
    await stopTick;

    // Withdrawn is not failed: no error on the tile.
    expect(c.view("AAA").snapshot.error).toBeNull();
    expect(c.view("AAA").pending).toBeNull();
  });

  test("the console that slept anyway is woken from its own answer, with no backoff in the way", async () => {
    const c = new Ps5Controller(ports);
    const answer = pendingRest();

    const stopTick = c.tick([input({ stopping: true, urgent: true })]);
    await Promise.resolve();
    await c.tick([input({ hasSession: true, urgent: true })]);

    // The attempt already on the wire put it to sleep, then the main process
    // reported a failure (the console dropped the session as it went down).
    answer({ sent: false, code: "TRANSPORT_ERROR" });
    await stopTick;
    expect(c.view("AAA").snapshot.error).toBeNull();

    // Well past the urgent window, a plain monitor tick sees 620 (rest).
    clock += 20_000;
    await c.tick([input({ actual: "rest", hasSession: true })]);

    expect(wake).toHaveBeenCalledTimes(1);
    expect(c.view("AAA").snapshot.state).toBe("WAKING");
  });

  test("a rest that throws after the start is not held against the wake either", async () => {
    const c = new Ps5Controller(ports);
    let fail!: (e: Error) => void;
    rest.mockImplementationOnce(() => new Promise<CommandOutcome>((_r, reject) => { fail = reject; }));

    const stopTick = c.tick([input({ stopping: true, urgent: true })]);
    await Promise.resolve();
    await c.tick([input({ hasSession: true })]);
    fail(new Error("socket hang up"));
    await stopTick;

    clock += 20_000;
    await c.tick([input({ actual: "rest", hasSession: true })]);
    expect(wake).toHaveBeenCalledTimes(1);
  });

  test("ready is claimed only when the console answers awake", async () => {
    const c = new Ps5Controller(ports);
    await c.tick([input({ actual: "rest", hasSession: true, urgent: true })]);
    expect(c.view("AAA").snapshot.state).toBe("WAKING");

    clock += 3_000;
    await c.tick([input({ actual: "rest", hasSession: true, urgent: true })]);
    expect(c.view("AAA").snapshot.state).toBe("WAKING");

    clock += 3_000;
    await c.tick([input({ actual: "awake", hasSession: true })]);
    expect(c.view("AAA").snapshot.state).toBe("ACTIVE");
  });

  test("Start pressed again while the wake is on the wire puts no second one there", async () => {
    const c = new Ps5Controller(ports);
    let answer!: (o: CommandOutcome) => void;
    wake.mockImplementationOnce(() => new Promise<CommandOutcome>((r) => { answer = r; }));

    const first = c.tick([input({ actual: "rest", hasSession: true, urgent: true })]);
    await Promise.resolve();
    for (let i = 0; i < 4; i++) {
      c.pressed("AAA");
      await c.tick([input({ actual: "rest", hasSession: true, urgent: true })]);
    }
    answer({ sent: true });
    await first;

    expect(wake).toHaveBeenCalledTimes(1);
  });
});

describe("Start then Stop: the latest press wins the other way too", () => {
  test("a wake that fails after the session was stopped starts no backoff for the rest", async () => {
    const c = new Ps5Controller(ports);
    let answer!: (o: CommandOutcome) => void;
    wake.mockImplementationOnce(() => new Promise<CommandOutcome>((r) => { answer = r; }));

    const startTick = c.tick([input({ actual: "rest", hasSession: true, urgent: true })]);
    await Promise.resolve();
    // Stopped while the wake was out; the console is at rest, which is wanted.
    await c.tick([input({ actual: "rest", stopping: true })]);
    answer({ sent: false, code: "TRANSPORT_ERROR" });
    await startTick;

    expect(c.view("AAA").snapshot.error).toBeNull();
    // It woke after all (the datagram did land): rest is sent at once.
    clock += 2_000;
    await c.tick([input({ actual: "awake", stopping: true })]);
    expect(rest).toHaveBeenCalledTimes(1);
  });
});

describe("recovery after a wake that gave up", () => {
  test("a new press starts the give-up clock again, so the wake is tried", async () => {
    const c = new Ps5Controller(ports);
    await c.tick([input({ actual: "rest", hasSession: true })]);
    clock += 50_000;
    await c.tick([input({ actual: "rest", hasSession: true })]);
    expect(c.view("AAA").snapshot.error).toBe("WAKE_IGNORED");
    const before = wake.mock.calls.length;

    c.pressed("AAA");
    await c.tick([input({ actual: "rest", hasSession: true, urgent: true })]);

    expect(wake.mock.calls.length).toBe(before + 1);
    expect(c.view("AAA").snapshot.state).toBe("WAKING");
  });

  test("a press clears a backoff left by a failure that belongs to the previous intent", async () => {
    const c = new Ps5Controller(ports);
    rest.mockResolvedValueOnce({ sent: false, code: "IN_USE" });
    await c.tick([input({ stopping: true })]);
    expect(c.view("AAA").snapshot.error).toBe("IN_USE");

    c.pressed("AAA");
    clock += 1_000;
    // Not urgent on purpose: only the press may lift the thirty seconds.
    await c.tick([input({ actual: "rest", hasSession: true })]);
    expect(wake).toHaveBeenCalledTimes(1);
  });
});

describe("the main process withdraws between attempts", () => {
  afterEach(() => vi.useRealTimers());

  test("withdrawn before the first attempt: nothing reaches the console", async () => {
    const attempt = vi.fn(async () => ({ ok: true }));
    const result = await standby("192.168.1.10", {} as never, "AAA", () => true, attempt as never);
    expect(result).toEqual(STANDBY_CANCELLED);
    expect(attempt).not.toHaveBeenCalled();
  });

  test("withdrawn after a refused attempt: no second attempt", async () => {
    vi.useFakeTimers();
    let withdrawn = false;
    const attempt = vi.fn(async () => {
      withdrawn = true; // the session starts while attempt 1 is out
      return { ok: false, code: "FAILED" as const };
    });

    const pending = standby("192.168.1.10", {} as never, "AAA", () => withdrawn, attempt as never);
    await vi.advanceTimersByTimeAsync(5_000);

    expect(await pending).toEqual(STANDBY_CANCELLED);
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  test("not withdrawn: the retries are what they always were", async () => {
    vi.useFakeTimers();
    const attempt = vi.fn()
      .mockResolvedValueOnce({ ok: false, code: "FAILED" })
      .mockResolvedValueOnce({ ok: true });

    const pending = standby("192.168.1.10", {} as never, "AAA", () => false, attempt as never);
    await vi.advanceTimersByTimeAsync(5_000);

    expect(await pending).toEqual({ ok: true });
    expect(attempt).toHaveBeenCalledTimes(2);
  });
});

describe("Start wakes a console that has not answered yet (2026-10-19)", () => {
  test("inside the press window the wake goes to the last known address", async () => {
    const c = new Ps5Controller(ports);
    await c.tick([input({ actual: "unreachable", hasSession: true, urgent: true })]);
    expect(wake).toHaveBeenCalledWith("AAA", "192.168.1.10");
  });

  test("after the window, silence sends nothing: no stream at a console that is really off", async () => {
    const c = new Ps5Controller(ports);
    for (let i = 0; i < 20; i++) {
      await c.tick([input({ actual: "unreachable", hasSession: true })]);
      clock += 10_000;
    }
    expect(wake).not.toHaveBeenCalled();
  });
});
