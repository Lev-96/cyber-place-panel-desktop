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
   * Whether this machine holds the wake key for this console.
   *
   * A wake is an authenticated datagram: without the key nothing can be sent at
   * all, and the console never hears anything. Left out — or `undefined` — the
   * machine tries, because "we have not asked the vault yet" is not the same as
   * "there is no key" and refusing on an unasked question would break a wake
   * that would have worked. Only a definite `false` stops it.
   *
   * This exists because the honest reason had no way to reach the screen: the
   * attempt failed instantly, the next observation cleared the error, and
   * forty-five seconds later the tile blamed the console's own "turn on from
   * network" setting — sending staff into the PS5's menus for a key that was
   * never on this machine.
   */
  canWake?: boolean;
  /**
   * The reason the last command for this console failed, while it is still
   * failing. Cleared by the caller the moment one succeeds.
   *
   * Without it the screen lies by omission: a sleep the console refuses
   * ("Remote Play is already in use") left the tile saying "going to rest…"
   * for as long as the panel kept retrying, which reads as "working on it"
   * when the truth is "the console is saying no". Measured on real hardware —
   * a console powered on by hand refuses the request outright.
   */
  commandError?: string | null;
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
  /** When this console was first asked to wake, while it is still asleep. */
  wakingSince: number | null;
  /**
   * When the current sleep was started, or null when none is under way.
   *
   * A sleep takes seconds, not an instant, and during those seconds an awake
   * console is a command that has not landed — not somebody switching it on.
   * But that reading has to EXPIRE, or a console switched on by hand moments
   * after a stop is silently put back to sleep and the owner is never asked,
   * which is the whole point of asking.
   */
  restingSince: number | null;
  /** Set when a command could not be carried out. Shown, never swallowed. */
  error: string | null;
}

export interface Step {
  next: MachineSnapshot;
  commands: Command[];
}

/** How long the owner has to answer before the console is put back to sleep. */
export const UNEXPECTED_WAKE_GRACE_MS = 10_000;

/**
 * How long a console may be asked to wake before the asking is called a
 * failure.
 *
 * A console that has been sent a wake and is still asleep three quarters of a
 * minute later is not slow — it is ignoring us, and there is exactly one common
 * reason: "Enable Turning On PS5 from Network" is off in its own settings. Two
 * independent implementations sending the same packet with the same genuine
 * registration both get nowhere against a console with that switch off, so it
 * is worth naming rather than leaving as "waking…" forever.
 */
export const WAKE_GIVE_UP_MS = 45_000;

/**
 * How long a sleep counts as still under way.
 *
 * Measured on a real console: from the command leaving this machine to the
 * console reporting rest is 7-27 seconds, depending on what it was doing. Half
 * a minute covers that with room to spare.
 *
 * Past it, an awake console is an awake console. The alternative was found on
 * real hardware: switch a console on by hand a few seconds after a stop, and
 * the panel — still believing its own sleep was in progress — put it back to
 * sleep without ever asking the owner. Safe, and wrong: being asked is the
 * entire feature.
 */
export const REST_SETTLE_MS = 30_000;

export const initialSnapshot = (): MachineSnapshot => ({
  state: "UNKNOWN",
  desired: "rest",
  wakeEventId: null,
  wakeSeenAt: null,
  approvedEventId: null,
  wakingSince: null,
  restingSince: null,
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
  // A failure that is still current stays on the screen; the branches below
  // may still name something more specific.
  const next: MachineSnapshot = { ...prev, error: obs.commandError ?? null };

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
    next.wakingSince = null;
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
      // Nothing can be sent without the key, so nothing is — and the reason is
      // named instead of being spent on datagrams that never leave. Checked
      // before `wakingSince` is set, so a console that cannot be woken never
      // starts a give-up clock whose verdict would blame the wrong thing.
      if (obs.canWake === false) {
        next.state = "ERROR";
        next.error = "NO_CREDENTIAL";
        next.wakingSince = null;
        return { next, commands };
      }

      next.wakingSince = prev.wakingSince ?? obs.now;

      if (obs.now - next.wakingSince >= WAKE_GIVE_UP_MS) {
        // Asked, repeatedly, and still asleep. The packet is leaving this
        // machine — the missing-key case returned above — so what is left is
        // the console's own "turn on from network" setting.
        next.state = "ERROR";
        next.error = "WAKE_IGNORED";
        return { next, commands };
      }

      next.state = "WAKING";
      next.restingSince = null;
      commands.push({ kind: "wake" });
    } else {
      next.state = "REST";
      next.restingSince = null;
      next.wakingSince = null;
    }

    return { next, commands };
  }

  // From here the console is awake.
  if (desired === "active") {
    next.state = "ACTIVE";
    next.restingSince = null;
    next.wakingSince = null;
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
    next.restingSince = null;
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
    next.restingSince = prev.restingSince ?? obs.now;
    commands.push({ kind: "rest" });
    return { next, commands };
  }

  // A console we already told to sleep, still awake. This is a command that has
  // not landed yet — not somebody switching it on — and calling it a new
  // unexpected wake is how a manager's Stop turned into the owner being asked
  // "is this you?" about a console they had just stopped. That happened once
  // the local "stopping" intent lapsed after a minute, which a slow rest path
  // easily outlived.
  //
  // The rest is re-issued rather than merely waited on: the previous one is
  // known not to have worked. The controller's own cooldown decides how often
  // that actually reaches the wire.
  if (
    prev.state === "GOING_TO_REST"
    && prev.restingSince !== null
    && obs.now - prev.restingSince < REST_SETTLE_MS
  ) {
    if (!obs.canRest) {
      next.state = "ERROR";
      next.error = "UNSUPPORTED_BY_TRANSPORT";
      return { next, commands };
    }

    next.state = "GOING_TO_REST";
    next.restingSince = prev.restingSince ?? obs.now;
    // Carried so the answer this sleep belongs to is still named, when it began
    // as an owner's refusal.
    commands.push(prev.wakeEventId ? { kind: "rest", eventId: prev.wakeEventId } : { kind: "rest" });
    return { next, commands };
  }

  // An unexpected wake. The id is minted once and kept until the situation
  // ends, so the owner's answer can be matched to the question they were asked.
  if (prev.wakeEventId === null || prev.wakeSeenAt === null) {
    next.state = "UNEXPECTED_WAKE";
    next.restingSince = null;
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
    next.restingSince = prev.restingSince ?? obs.now;
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
