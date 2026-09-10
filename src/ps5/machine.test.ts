import { describe, expect, test } from "vitest";
import {
  initialSnapshot,
  step,
  UNEXPECTED_WAKE_GRACE_MS,
  REST_SETTLE_MS,
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

  test("a console with no wake key on this machine is not asked, and says why", () => {
    // The datagram is authenticated: with no key nothing can be sent, so
    // nothing is. Reported as the missing key rather than as silence from the
    // console, which is what sent staff into the PlayStation's own menus.
    const { next, commands } = step(
      initialSnapshot(),
      observe({ actual: "rest", hasSession: true, canWake: false }),
      "e1",
    );

    expect(commands).toEqual([]);
    expect(next.state).toBe("ERROR");
    expect(next.error).toBe("NO_CREDENTIAL");
    expect(next.wakingSince).toBeNull();
  });

  test("a missing key never becomes a verdict about the console's settings", () => {
    // The give-up message names the console's "turn on from network" switch,
    // and it may only do that when packets really were leaving this machine.
    const { snapshot, steps } = run(initialSnapshot(), [
      { actual: "rest", hasSession: true, canWake: false },
      { actual: "rest", hasSession: true, canWake: false, now: 1_000_000 + WAKE_GIVE_UP_MS + 1_000 },
    ]);

    expect(steps.every((s) => s.commands.length === 0)).toBe(true);
    expect(snapshot.error).toBe("NO_CREDENTIAL");
  });

  test("a key nobody has asked about yet is still tried", () => {
    // `undefined` is "not asked", not "absent". Refusing on an unasked question
    // would break every wake on a build whose bridge cannot answer.
    const { next, commands } = step(
      initialSnapshot(),
      observe({ actual: "rest", hasSession: true }),
      "e1",
    );

    expect(commands).toEqual([{ kind: "wake" }]);
    expect(next.state).toBe("WAKING");
  });

  test("a console still finishing its sleep is not mistaken for a manual switch-on", () => {
    // A sleep takes seconds. During them an awake console is a command that has
    // not landed yet, and asking the owner "is this you?" about a console their
    // manager just stopped is both wrong and, on a busy floor, indistinguishable
    // from the real thing.
    const { steps, snapshot } = run(initialSnapshot(), [
      { actual: "awake", stopping: true },
      { actual: "awake", now: 1_010_000 },
      { actual: "awake", now: 1_020_000 },
    ]);

    expect(steps.map((s) => s.next.state)).toEqual(["GOING_TO_REST", "GOING_TO_REST", "GOING_TO_REST"]);
    expect(steps.flatMap((s) => s.commands).some((c) => c.kind === "report-unexpected-wake")).toBe(false);
    expect(steps[1].commands).toEqual([{ kind: "rest" }]);
    expect(snapshot.wakeEventId).toBeNull();
  });

  test("but a console still awake LONG after that IS asked about", () => {
    // Found on real hardware, and it is the reason the window above has an end.
    // Switch a console on by hand a few seconds after a stop and the panel, still
    // believing its own sleep was under way, put it back to sleep and never asked
    // the owner. Safe, and wrong: being asked is the entire feature.
    const { steps, snapshot } = run(initialSnapshot(), [
      { actual: "awake", stopping: true },
      { actual: "awake", now: 1_000_000 + REST_SETTLE_MS + 1_000 },
    ]);

    expect(steps[0].next.state).toBe("GOING_TO_REST");
    expect(steps[1].next.state).toBe("UNEXPECTED_WAKE");
    expect(steps[1].commands).toEqual([{ kind: "report-unexpected-wake", eventId: "e2" }]);
    expect(snapshot.wakeEventId).toBe("e2");
  });

  test("a later sleep gets its own window, not the first one's", () => {
    // The window is stamped when a sleep begins and must be cleared when the
    // console actually sleeps. Left behind, the NEXT sleep inherits a stamp
    // that is already expired, its protection never applies, and the false
    // "is this you?" during a slow sleep comes straight back.
    const { steps } = run(initialSnapshot(), [
      // First sleep, completed.
      { actual: "awake", stopping: true },
      { actual: "rest", now: 1_010_000 },
      // Much later — well past one window — a second sleep begins.
      { actual: "awake", stopping: true, now: 1_600_000 },
      // …and is still in progress a few seconds in.
      { actual: "awake", now: 1_610_000 },
    ]);

    expect(steps[1].next.state).toBe("REST");
    expect(steps[1].next.restingSince).toBeNull();
    expect(steps[2].next.state).toBe("GOING_TO_REST");
    // The one that matters: still protected, not turned into a question.
    expect(steps[3].next.state).toBe("GOING_TO_REST");
    expect(steps[3].commands).toEqual([{ kind: "rest" }]);
  });

  test("a refusal the console keeps giving stays on the screen", () => {
    // Measured on real hardware: a console powered on by hand answers "403
    // Forbidden: Remote is already in use" to every sleep request. The panel
    // kept retrying and the tile kept saying "going to rest…", which reads as
    // "working on it" when the truth is "the console is saying no".
    const { next } = step(
      { ...initialSnapshot(), state: "GOING_TO_REST", restingSince: 1_000_000 },
      observe({ actual: "awake", now: 1_005_000, commandError: "IN_USE" }),
      "e1",
    );

    expect(next.state).toBe("GOING_TO_REST");
    expect(next.error).toBe("IN_USE");
  });

  test("and disappears the moment a command works again", () => {
    const { next } = step(
      { ...initialSnapshot(), state: "GOING_TO_REST", restingSince: 1_000_000, error: "IN_USE" },
      observe({ actual: "awake", now: 1_005_000 }),
      "e1",
    );

    expect(next.error).toBeNull();
  });

  test("a console that reaches rest and is then switched on IS a manual switch-on", () => {
    // The other half of the rule above: once the console has actually slept,
    // the stop is over and the next wake is a new situation with nobody behind
    // it. Losing this would mean never asking the owner again after one stop.
    const { steps, snapshot } = run(initialSnapshot(), [
      { actual: "awake", stopping: true },
      { actual: "rest", now: 1_020_000 },
      { actual: "awake", now: 1_040_000 },
    ]);

    expect(steps[1].next.state).toBe("REST");
    expect(steps[2].commands).toEqual([{ kind: "report-unexpected-wake", eventId: "e3" }]);
    expect(snapshot.state).toBe("UNEXPECTED_WAKE");
  });

  test("a sleep that began as a refusal keeps naming the answer it belongs to", () => {
    // The rest carries the event id so a late-arriving command can still be
    // matched to the question the owner answered.
    const { steps } = run(initialSnapshot(), [
      { actual: "awake" },
      { actual: "awake", now: 1_002_000, decision: { eventId: "e1", approved: false } },
      { actual: "awake", now: 1_004_000 },
    ]);

    expect(steps[1].commands).toEqual([{ kind: "rest", eventId: "e1" }]);
    expect(steps[2].commands).toEqual([{ kind: "rest", eventId: "e1" }]);
  });

  test("a session starting beats a sleep already under way", () => {
    // The new "still going to rest" rule must not trap a console: a player
    // sitting down at that seat outranks a sleep that has not landed, exactly
    // as a running session outranks everything else.
    const { steps } = run(initialSnapshot(), [
      { actual: "awake", stopping: true },
      { actual: "awake", hasSession: true, now: 1_010_000 },
    ]);

    expect(steps[0].next.state).toBe("GOING_TO_REST");
    expect(steps[1].next.state).toBe("ACTIVE");
    expect(steps[1].commands).toEqual([]);
  });

  test("a maintenance window beats a sleep already under way", () => {
    // Same rule from the other direction: an owner who opens the console for
    // servicing has said it may be awake, and a sleep still being retried from
    // an earlier stop must not go on fighting them.
    const { steps } = run(initialSnapshot(), [
      { actual: "awake", stopping: true },
      { actual: "awake", maintenance: true, now: 1_010_000 },
    ]);

    expect(steps[0].next.state).toBe("GOING_TO_REST");
    expect(steps[1].next.state).toBe("ACTIVE");
    expect(steps[1].commands).toEqual([]);
  });

  test("an unrecognised answer is UNKNOWN, not OFFLINE", () => {
    // The protocol moved, rather than the console. Different fact, different
    // state, and neither is grounds for acting.
    const { next, commands } = step(initialSnapshot(), observe({ actual: "unknown" }), "e1");

    expect(next.state).toBe("UNKNOWN");
    expect(commands).toEqual([]);
  });
});
