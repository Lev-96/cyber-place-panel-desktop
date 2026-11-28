import { beforeEach, describe, expect, test, vi, type Mock } from "vitest";
import { Ps5Controller, type ConsoleInput, type ControllerPorts } from "./Ps5Controller";

/**
 * Through the controller that actually sends (2026-11-28, owner): a console
 * the player or the TV put to sleep during the session gets no wake and no
 * rest; a new Start (press) wakes it again; the end of the session on an
 * awake console still rests it.
 */
let clock = 1_000_000;
let ports: ControllerPorts;
let wake: Mock<ControllerPorts["wake"]>;
let rest: Mock<ControllerPorts["rest"]>;

const input = (over: Partial<ConsoleInput> = {}): ConsoleInput => ({
  deviceId: 1, hostId: "AAA", address: "192.168.1.10",
  actual: "awake", hasSession: false, starting: false, stopping: false,
  maintenance: false, canRest: true, decision: null,
  ...over,
});

beforeEach(() => {
  clock = 1_000_000;
  wake = vi.fn(async () => ({ sent: true }));
  rest = vi.fn(async () => ({ sent: true }));
  ports = { wake, rest, cancelRest: vi.fn(), reportUnexpectedWake: async () => {}, log: () => {}, now: () => clock, newId: () => "e1" };
});

describe("asleep by the player's choice, through the controller", () => {
  test("no wake and no rest while it sleeps mid-session; Start wakes it; Stop of an awake one rests it", async () => {
    const c = new Ps5Controller(ports);
    await c.tick([input({ hasSession: true })]); // awake in the session
    for (let i = 1; i <= 6; i++) {
      clock += 60_000;
      await c.tick([input({ actual: "rest", hasSession: true })]); // the TV put it to sleep
    }
    expect(wake).not.toHaveBeenCalled();
    expect(rest).not.toHaveBeenCalled();
    expect(c.view("AAA").snapshot.state).toBe("REST");

    // The session ends (Stop / time up) while it sleeps: nothing to send.
    clock += 60_000;
    await c.tick([input({ actual: "rest", stopping: true, urgent: true })]);
    expect(rest).not.toHaveBeenCalled();

    // A new player: Start pressed → woken as always.
    clock += 5 * 60_000;
    c.pressed("AAA");
    await c.tick([input({ actual: "rest", hasSession: true, starting: true, urgent: true })]);
    expect(wake).toHaveBeenCalledTimes(1);
    expect(c.view("AAA").snapshot.state).toBe("WAKING");

    // Awake again, then the session ends with it awake: rested as before.
    clock += 15_000;
    await c.tick([input({ hasSession: true, starting: true })]);
    clock += 60 * 60_000;
    await c.tick([input({ stopping: true, urgent: true })]);
    expect(rest).toHaveBeenCalledTimes(1);
  });
});
