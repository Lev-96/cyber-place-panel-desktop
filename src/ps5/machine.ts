/**
 * What a console should be doing, and what to do about the difference.
 *
 * A pure function of (previous state, observation) → (next state, commands).
 * No timers, no sockets, no React: everything that can go wrong in this feature
 * — a monitor tick racing a session start, a stale timeout firing after the
 * situation changed, a console that answers late — is a question about this
 * function, and can be asked of it directly in a test with no PlayStation
 * anywhere near.
 *
 * ## Desired versus actual
 * The two are kept apart deliberately. `actual` is the last thing the console
 * said about itself; `desired` is what the venue's own rules say it should be.
 * Every command this machine emits is an attempt to close a gap between them,
 * and every gap has exactly one meaning:
 *
 *  - desired ACTIVE, actual REST → it has not woken yet (or the wake failed)
 *  - desired REST, actual ACTIVE → somebody switched it on themselves
 *
 * ## Why STARTING and STOPPING are not session statuses
 * `gaming_sessions.status` is `active | stopped | expired`, and those three
 * feed billing, revenue and every client. A session that is "starting" is not a
 * billing fact — it is this panel's own intent, held for the seconds between
 * the operator pressing Start and the console answering. So it lives here, in
 * the controller, and the database keeps meaning exactly what it meant before.
 *
 * ## Why a recompute rather than timers
 * The whole state is derived from the current observation on every tick, so a
 * timeout that was armed for a situation which has since changed cannot fire
 * into it: the situation is simply read again. That is what makes the
 * "unexpected wake timeout must not put a console to sleep during the session
 * that started meanwhile" case (a genuine race, and the nastiest one here)
 * fall out of the design instead of needing a guard.
 */

/** What the console last said about itself. */
export type ActualState = "awake" | "rest" | "unreachable" | "unknown";

/** What the venue's rules say it should be. */
export type DesiredState =
  /** A session is running or starting: it must be usable. */
  | "active"
  /** No session: it should be asleep. */
  | "rest"
  /** Maintenance, or an owner-approved manual wake: leave it alone. */
  | "unmanaged";

/** The console's place in its own lifecycle, as this panel understands it. */
export type MachineState =
  | "UNKNOWN"
  | "OFFLINE"
  | "REST"
  | "WAKING"
  | "ACTIVE"
  | "GOING_TO_REST"
  | "UNEXPECTED_WAKE"
  | "ERROR";

export type CommandKind = "wake" | "rest" | "report-unexpected-wake";

export interface Command {
  kind: CommandKind;
  /**
   * Which unexpected wake this belongs to. A command carrying a stale id is one
   * the controller must drop — see `wakeEventId` below.
   */
  eventId?: string;
}

export interface Observation {
  /** The console's own state, from the last probe. */
  actual: ActualState;
  /** A session is running on this place, per the backend. */
  hasSession: boolean;
  /** Start pressed, console not confirmed awake yet. This panel's own intent. */
  starting: boolean;
  /** Stop confirmed on the backend, console not confirmed asleep yet. */
  stopping: boolean;
  /** Owner put this console into maintenance, and the window has not expired. */
  maintenance: boolean;
  /**
   * Whether the transport underneath can put a console to rest at all.
   *
   * False today: the local protocol has no such command. Passing it in rather
   * than assuming keeps the machine honest in both directions — it does not
   * emit a command that cannot be carried out (which is how "going to rest…"
   * became a state a console sat in forever, retried every ten seconds), and it
   * needs no change on the day a transport can.
   */
  canRest: boolean;
  /**
   * The owner's answer to the unexpected wake with this id, if they have given
   * one. `null` while nobody has answered.
   */
  decision: { eventId: string; approved: boolean } | null;
  /** Milliseconds since the epoch. Passed in, never read from the clock here. */
  now: number;
}

export interface MachineSnapshot {
  state: MachineState;
  desired: DesiredState;
  /** The unexpected wake currently being handled, if any. */
  wakeEventId: string | null;
  /** When that wake was first seen — the ten seconds are counted from here. */
  wakeSeenAt: number | null;
  /** An unexpected wake the owner allowed. Cleared the moment the console sleeps. */
  approvedEventId: string | null;
  /** Set when a command could not be carried out. Shown, never swallowed. */
  error: string | null;
}

export interface Step {
  next: MachineSnapshot;
  commands: Command[];
}

/** How long the owner has to answer before the console is put back to sleep. */
export const UNEXPECTED_WAKE_GRACE_MS = 10_000;

export const initialSnapshot = (): MachineSnapshot => ({
  state: "UNKNOWN",
  desired: "rest",
  wakeEventId: null,
  wakeSeenAt: null,
  approvedEventId: null,
  error: null,
});

/**
 * What the console should be, before looking at what it is.
 *
 * Order matters and encodes the venue's priorities: a running session outranks
 * everything (a player must not lose their console because a maintenance window
 * expired mid-game), then maintenance, then the default — no session means
 * asleep.
 */
const desiredFor = (obs: Observation, approved: boolean): DesiredState => {
  if (obs.hasSession || obs.starting) return "active";
  if (obs.stopping) return "rest";
  if (obs.maintenance) return "unmanaged";
  if (approved) return "unmanaged";
  return "rest";
};

/**
 * One tick.
 *
 * @param prev  What this machine concluded last time.
 * @param obs   What is true right now.
 * @param newEventId  A fresh id, used only if an unexpected wake starts on this
 *   tick. Supplied by the caller so this function stays pure and deterministic.
 */
export const step = (prev: MachineSnapshot, obs: Observation, newEventId: string): Step => {
  const commands: Command[] = [];
  const next: MachineSnapshot = { ...prev, error: null };

  // An owner's approval covers ONE wake — the one they were asked about. A new
  // unexpected wake is a new question, so the approval is dropped as soon as
  // the event it belonged to is over.
  let approved = prev.approvedEventId !== null && prev.approvedEventId === prev.wakeEventId;

  if (obs.decision && obs.decision.eventId === prev.wakeEventId) {
    approved = obs.decision.approved;
    next.approvedEventId = obs.decision.approved ? obs.decision.eventId : null;
  }

  const desired = desiredFor(obs, approved);
  next.desired = desired;

  // A console nobody can reach says nothing about whether it is authorised —
  // it says the network is in the way. Never act on silence.
  if (obs.actual === "unreachable" || obs.actual === "unknown") {
    next.state = obs.actual === "unreachable" ? "OFFLINE" : "UNKNOWN";
    // A pending unexpected wake does not survive the console vanishing: when it
    // comes back it is a new situation and gets asked about again.
    next.wakeEventId = null;
    next.wakeSeenAt = null;
    next.approvedEventId = null;
    return { next, commands };
  }

  if (obs.actual === "rest") {
    // Asleep. Any unexpected wake is over, and so is any approval of it.
    next.wakeEventId = null;
    next.wakeSeenAt = null;
    next.approvedEventId = null;

    if (desired === "active") {
      next.state = "WAKING";
      commands.push({ kind: "wake" });
    } else {
      next.state = "REST";
    }

    return { next, commands };
  }

  // From here the console is awake.
  if (desired === "active") {
    next.state = "ACTIVE";
    next.wakeEventId = null;
    next.wakeSeenAt = null;
    // Reaching ACTIVE through a session ends any approval: the next manual
    // wake, after this session, is a fresh question.
    next.approvedEventId = null;
    return { next, commands };
  }

  if (desired === "unmanaged") {
    // Maintenance, or a wake the owner has approved. Awake is fine.
    next.state = "ACTIVE";
    return { next, commands };
  }

  // Awake with no reason to be. Either the operator has just stopped a session
  // and it has not gone to sleep yet, or somebody switched it on.
  if (obs.stopping) {
    if (!obs.canRest) {
      // Nothing to send. Saying so once beats "going to rest…" on a console
      // that is still on, and beats a command retried every ten seconds for the
      // rest of the shift.
      next.state = "ERROR";
      next.error = "UNSUPPORTED_BY_TRANSPORT";
      return { next, commands };
    }

    next.state = "GOING_TO_REST";
    commands.push({ kind: "rest" });
    return { next, commands };
  }

  // An unexpected wake. The id is minted once and kept until the situation
  // ends, so the owner's answer can be matched to the question they were asked.
  if (prev.wakeEventId === null || prev.wakeSeenAt === null) {
    next.state = "UNEXPECTED_WAKE";
    next.wakeEventId = newEventId;
    next.wakeSeenAt = obs.now;
    commands.push({ kind: "report-unexpected-wake", eventId: newEventId });
    return { next, commands };
  }

  // The owner said no, or said nothing for long enough. Either way it sleeps.
  const refused = obs.decision?.eventId === prev.wakeEventId && obs.decision.approved === false;
  const expired = obs.now - prev.wakeSeenAt >= UNEXPECTED_WAKE_GRACE_MS;

  if (refused || expired) {
    if (!obs.canRest) {
      // The owner said no, or said nothing — and this build cannot act on
      // either. The console stays on and the screen says why, which is the
      // whole of what can honestly be reported.
      next.state = "ERROR";
      next.error = "UNSUPPORTED_BY_TRANSPORT";
      return { next, commands };
    }

    next.state = "GOING_TO_REST";
    commands.push({ kind: "rest", eventId: prev.wakeEventId });
    return { next, commands };
  }

  // Still waiting for an answer.
  next.state = "UNEXPECTED_WAKE";
  return { next, commands };
};

/**
 * A command that failed, folded back into the state.
 *
 * Kept separate from {@link step} because a failure is not an observation: the
 * console did not tell us anything, our own attempt did. The state is left
 * alone and the reason is recorded, so the screen can say what went wrong
 * instead of a silent no-op or, worse, a success it did not earn.
 */
export const withError = (snapshot: MachineSnapshot, error: string): MachineSnapshot =>
  ({ ...snapshot, state: "ERROR", error });
