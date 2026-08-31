import { describe, expect, test } from "vitest";
import {
  initialSnapshot,
  step,
  UNEXPECTED_WAKE_GRACE_MS,
  WAKE_GIVE_UP_MS,
  type MachineSnapshot,
  type Observation,
} from "./machine";

/**
 * The console lifecycle, asked directly.
 *
 * Every scenario the venue cares about — a session starting, a session
 * stopping, somebody switching a console on themselves, the owner answering or
 * not answering, a maintenance window, a console falling off the network — is a
 * question about one pure function, so all of it is exercised here with no
 * PlayStation and no network.
 *
 * What these tests CANNOT show is that a real console obeys. That is a
 * hardware gate, and nothing here is written as though it had been passed.
 */

const observe = (over: Partial<Observation> = {}): Observation => ({
  actual: "rest",
  hasSession: false,
  starting: false,
  stopping: false,
  maintenance: false,
  // The tests below describe the lifecycle a rest-capable transport produces —
  // the one this is written against. The cases where it cannot rest are their
  // own block at the end.
  canRest: true,
  decision: null,
  now: 1_000_000,
  ...over,
});

/** Run several ticks, threading the snapshot, and return everything that happened. */
const run = (start: MachineSnapshot, ticks: Array<Partial<Observation>>, ids = ["e1", "e2", "e3", "e4"]) => {
  let snapshot = start;
  const steps = ticks.map((over, i) => {
    const result = step(snapshot, observe(over), ids[i] ?? `e${i}`);
    snapshot = result.next;
    return result;
  });

  return { snapshot, steps };
};

describe("a console with a session on it", () => {
  test("a resting console is woken when a session starts", () => {
    const { next, commands } = step(initialSnapshot(), observe({ actual: "rest", starting: true }), "e1");

    expect(next.desired).toBe("active");
    expect(next.state).toBe("WAKING");
    expect(commands).toEqual([{ kind: "wake" }]);
  });

  test("it is ACTIVE only once the console itself says it is awake", () => {
    // The operator pressing Start is not the console waking up. Until it
    // answers, the machine stays in WAKING and keeps asking.
    const { snapshot, steps } = run(initialSnapshot(), [
      { actual: "rest", starting: true },
      { actual: "rest", starting: true },
      { actual: "awake", hasSession: true },
    ]);

    expect(steps[0].next.state).toBe("WAKING");
    expect(steps[1].next.state).toBe("WAKING");
    expect(steps[1].commands).toEqual([{ kind: "wake" }]);
    expect(snapshot.state).toBe("ACTIVE");
  });

  test("an awake console with a session is left alone", () => {
    const { commands, next } = step(initialSnapshot(), observe({ actual: "awake", hasSession: true }), "e1");

    expect(next.state).toBe("ACTIVE");
    expect(commands).toEqual([]);
  });
});

describe("a console that will not wake", () => {
  test("after three quarters of a minute it stops being called waking", () => {
    // The console is asleep, has been asked, and is still asleep. Two separate
    // implementations behave this way against a console whose "turn on from
    // network" setting is off — so at some point "waking…" is a lie.
    const { steps } = run(initialSnapshot(), [
      { actual: "rest", starting: true },
      { actual: "rest", starting: true, now: 1_000_000 + WAKE_GIVE_UP_MS - 1 },
      { actual: "rest", starting: true, now: 1_000_000 + WAKE_GIVE_UP_MS },
    ]);

    expect(steps[1].next.state).toBe("WAKING");
    expect(steps[2].next.state).toBe("ERROR");
    expect(steps[2].next.error).toBe("WAKE_IGNORED");
    // And it stops asking, rather than shouting at a console that is not
    // listening for the rest of the shift.
    expect(steps[2].commands).toEqual([]);
  });

  test("a console that does wake never reaches that state", () => {
    const { steps } = run(initialSnapshot(), [
      { actual: "rest", starting: true },
      { actual: "awake", hasSession: true, now: 1_000_000 + WAKE_GIVE_UP_MS + 10_000 },
    ]);

    expect(steps[1].next.state).toBe("ACTIVE");
    expect(steps[1].next.error).toBeNull();
  });

  test("the clock starts again for the next session, not from the last one", () => {
    // A console that ignored a wake this morning must still be asked properly
    // this afternoon.
    const { steps } = run(initialSnapshot(), [
      { actual: "rest", starting: true },
      { actual: "rest", now: 1_000_000 + 60_000 },
      { actual: "rest", starting: true, now: 1_000_000 + 61_000 },
    ]);

    expect(steps[1].next.state).toBe("REST");
    expect(steps[2].next.state).toBe("WAKING");
    expect(steps[2].commands).toEqual([{ kind: "wake" }]);
  });
});

describe("stopping a session", () => {
  test("a stop asks the console to sleep", () => {
    const { next, commands } = step(initialSnapshot(), observe({ actual: "awake", stopping: true }), "e1");

    expect(next.desired).toBe("rest");
    expect(next.state).toBe("GOING_TO_REST");
    expect(commands).toEqual([{ kind: "rest" }]);
  });

  test("a console that is stopping is never reported as an unexpected wake", () => {
    // It is awake with no session, which is exactly the shape of an unexpected
    // wake — and it would be a nonsense to ask the owner whether they switched
    // on a console the operator has just stopped.
    const { commands } = step(initialSnapshot(), observe({ actual: "awake", stopping: true }), "e1");

    expect(commands.map((c) => c.kind)).not.toContain("report-unexpected-wake");
  });

  test("REST is reached only when the console says so", () => {
    const { snapshot } = run(initialSnapshot(), [
      { actual: "awake", stopping: true },
      { actual: "rest" },
    ]);

    expect(snapshot.state).toBe("REST");
  });
});

describe("a console somebody switched on themselves", () => {
  test("it is reported once, not on every tick", () => {
    const { steps } = run(initialSnapshot(), [
      { actual: "awake" },
      { actual: "awake", now: 1_000_500 },
      { actual: "awake", now: 1_001_000 },
    ]);

    expect(steps[0].commands).toEqual([{ kind: "report-unexpected-wake", eventId: "e1" }]);
    expect(steps[0].next.state).toBe("UNEXPECTED_WAKE");
    // Reporting it three times would ask the owner the same question three
    // times over two seconds.
    expect(steps[1].commands).toEqual([]);
    expect(steps[2].commands).toEqual([]);
  });

  test("the owner saying yes keeps it awake", () => {
    const { steps, snapshot } = run(initialSnapshot(), [
      { actual: "awake" },
      { actual: "awake", now: 1_002_000, decision: { eventId: "e1", approved: true } },
      { actual: "awake", now: 1_030_000 },
    ]);

    expect(steps[1].next.desired).toBe("unmanaged");
    expect(steps[1].commands).toEqual([]);
    // Well past the ten seconds, and it is still awake: an approval is not a
    // pause, it settles the question.
    expect(snapshot.state).toBe("ACTIVE");
    expect(steps[2].commands).toEqual([]);
  });

  test("the owner saying no puts it to sleep", () => {
    const { steps } = run(initialSnapshot(), [
      { actual: "awake" },
      { actual: "awake", now: 1_002_000, decision: { eventId: "e1", approved: false } },
    ]);

    expect(steps[1].next.state).toBe("GOING_TO_REST");
    expect(steps[1].commands).toEqual([{ kind: "rest", eventId: "e1" }]);
  });

  test("no answer within ten seconds puts it to sleep", () => {
    const { steps } = run(initialSnapshot(), [
      { actual: "awake" },
      { actual: "awake", now: 1_000_000 + UNEXPECTED_WAKE_GRACE_MS - 1 },
      { actual: "awake", now: 1_000_000 + UNEXPECTED_WAKE_GRACE_MS },
    ]);

    expect(steps[1].commands).toEqual([]);
    expect(steps[2].commands).toEqual([{ kind: "rest", eventId: "e1" }]);
  });

  test("an approval covers that one wake and not the next", () => {
    // Approved, then it sleeps, then somebody switches it on again. The second
    // time is a new question — otherwise one "yes, that was me" would open the
    // console up for good.
    const { steps } = run(initialSnapshot(), [
      { actual: "awake" },
      { actual: "awake", decision: { eventId: "e1", approved: true } },
      { actual: "rest" },
      { actual: "awake", now: 2_000_000 },
    ]);

    expect(steps[3].next.state).toBe("UNEXPECTED_WAKE");
    expect(steps[3].commands).toEqual([{ kind: "report-unexpected-wake", eventId: "e4" }]);
  });
});

describe("the races", () => {
  test("a monitor tick during a start does not put the console back to sleep", () => {
    // The one that would be worst in a venue: the operator starts a session,
    // the console is awake before the backend row is visible, and a monitor
    // tick sees "awake, no session" and helpfully switches it off under the
    // player.
    const { next, commands } = step(
      initialSnapshot(),
      observe({ actual: "awake", hasSession: false, starting: true }),
      "e1",
    );

    expect(next.state).toBe("ACTIVE");
    expect(commands).toEqual([]);
  });

  test("a session starting cancels a pending unexpected wake and its timeout", () => {
    // A stale timeout that fires into a live session is the nastiest bug this
    // feature could have. The machine recomputes from what is true now, so the
    // pending wake simply stops existing — there is no timer left to fire.
    const { steps, snapshot } = run(initialSnapshot(), [
      { actual: "awake" },
      { actual: "awake", now: 1_001_000, starting: true },
      { actual: "awake", now: 1_000_000 + UNEXPECTED_WAKE_GRACE_MS + 5_000, hasSession: true },
    ]);

    expect(steps[1].next.state).toBe("ACTIVE");
    expect(steps[1].next.wakeEventId).toBeNull();
    // Long past the grace window, with a session running: no rest command anywhere.
    expect(steps[2].commands).toEqual([]);
    expect(snapshot.state).toBe("ACTIVE");
  });

  test("an answer to an older wake cannot decide a newer one", () => {
    const { steps } = run(initialSnapshot(), [
      { actual: "awake" },              // e1 reported
      { actual: "rest" },               // slept; e1 is over
      { actual: "awake", now: 2_000_000 }, // e3 reported
      // The owner's tab was slow and answered the FIRST question.
      { actual: "awake", now: 2_001_000, decision: { eventId: "e1", approved: true } },
    ]);

    expect(steps[2].next.wakeEventId).toBe("e3");
    // The stale approval is ignored: the console is still awaiting an answer
    // about e3, not authorised by an answer about e1.
    expect(steps[3].next.state).toBe("UNEXPECTED_WAKE");
    expect(steps[3].next.approvedEventId).toBeNull();
  });
});

describe("maintenance", () => {
  test("an awake console with no session is left alone during maintenance", () => {
    const { next, commands } = step(initialSnapshot(), observe({ actual: "awake", maintenance: true }), "e1");

    expect(next.desired).toBe("unmanaged");
    expect(next.state).toBe("ACTIVE");
    expect(commands).toEqual([]);
  });

  test("when maintenance ends, protection comes back", () => {
    const { steps } = run(initialSnapshot(), [
      { actual: "awake", maintenance: true },
      { actual: "awake", maintenance: false, now: 1_005_000 },
    ]);

    expect(steps[1].next.state).toBe("UNEXPECTED_WAKE");
    expect(steps[1].commands).toEqual([{ kind: "report-unexpected-wake", eventId: "e2" }]);
  });

  test("maintenance never wakes a sleeping console", () => {
    // Maintenance means "leave it be", not "switch everything on".
    const { commands } = step(initialSnapshot(), observe({ actual: "rest", maintenance: true }), "e1");

    expect(commands).toEqual([]);
  });

  test("a running session outranks maintenance ending mid-game", () => {
    const { next, commands } = step(
      initialSnapshot(),
      observe({ actual: "awake", hasSession: true, maintenance: false }),
      "e1",
    );

    expect(next.state).toBe("ACTIVE");
    expect(commands).toEqual([]);
  });
});

describe("a transport that cannot put a console to rest", () => {
  test("a stop says so once instead of trying forever", () => {
    // What the owner actually saw: "going to rest…" on a console that was
    // still on, for as long as they watched, because the command was reissued
    // every ten seconds and refused every time.
    const { next, commands } = step(
      initialSnapshot(),
      observe({ actual: "awake", stopping: true, canRest: false }),
      "e1",
    );

    expect(commands).toEqual([]);
    expect(next.state).toBe("ERROR");
    expect(next.error).toBe("UNSUPPORTED_BY_TRANSPORT");
  });

  test("the owner refusing an unexpected wake is answered honestly", () => {
    const { steps } = run(initialSnapshot(), [
      { actual: "awake", canRest: false },
      { actual: "awake", canRest: false, now: 1_002_000, decision: { eventId: "e1", approved: false } },
    ]);

    expect(steps[1].commands).toEqual([]);
    expect(steps[1].next.state).toBe("ERROR");
    expect(steps[1].next.error).toBe("UNSUPPORTED_BY_TRANSPORT");
  });

  test("a countdown that runs out is answered the same way", () => {
    const { steps } = run(initialSnapshot(), [
      { actual: "awake", canRest: false },
      { actual: "awake", canRest: false, now: 1_000_000 + UNEXPECTED_WAKE_GRACE_MS },
    ]);

    expect(steps[1].commands).toEqual([]);
    expect(steps[1].next.state).toBe("ERROR");
  });

  test("waking still works — only the sleeping half is missing", () => {
    const { next, commands } = step(
      initialSnapshot(),
      observe({ actual: "rest", starting: true, canRest: false }),
      "e1",
    );

    expect(next.state).toBe("WAKING");
    expect(commands).toEqual([{ kind: "wake" }]);
  });
});

describe("a console that cannot be reached", () => {
  test("silence is never treated as an unexpected wake", () => {
    const { next, commands } = step(initialSnapshot(), observe({ actual: "unreachable" }), "e1");

    expect(next.state).toBe("OFFLINE");
    expect(commands).toEqual([]);
  });

  test("a pending question is dropped when the console disappears", () => {
    // It comes back as a new situation; asking the owner about a console that
    // has since left the network is asking about nothing.
    const { steps, snapshot } = run(initialSnapshot(), [
      { actual: "awake" },
      { actual: "unreachable", now: 1_001_000 },
      { actual: "awake", now: 1_002_000 },
    ]);

    expect(steps[1].next.wakeEventId).toBeNull();
    expect(steps[2].commands).toEqual([{ kind: "report-unexpected-wake", eventId: "e3" }]);
    expect(snapshot.state).toBe("UNEXPECTED_WAKE");
  });

  test("an unrecognised answer is UNKNOWN, not OFFLINE", () => {
    // The protocol moved, rather than the console. Different fact, different
    // state, and neither is grounds for acting.
    const { next, commands } = step(initialSnapshot(), observe({ actual: "unknown" }), "e1");

    expect(next.state).toBe("UNKNOWN");
    expect(commands).toEqual([]);
  });
});
