import {
  initialSnapshot,
  step,
  withError,
  type Command,
  type MachineSnapshot,
  type Observation,
} from "./machine";

/**
 * Runs one state machine per console, and carries out what they decide.
 *
 * The machine says WHAT should happen; this says whether it can happen right
 * now and reports what came of it. Everything it touches the outside world with
 * is injected, so the whole controller — including every failure path — runs in
 * a test with no Electron, no network and no PlayStation.
 *
 * ## One machine per console, never a shared "current console"
 * A venue has several, and they are independent: starting a session on VIP #1
 * must not wake #2, and #2 going offline must not disturb #1. The map is keyed
 * by `hostId`, the console's own identifier, which survives the address changing
 * under it.
 *
 * ## Commands are not fire-and-forget, and not fire-repeatedly
 * A command that is already in flight is not issued again, and a command that
 * failed is not retried on the very next tick — a monitor running every ten
 * seconds would otherwise turn one unreachable console into six wake datagrams
 * a minute. Pressing Start three times produces one wake, not three.
 *
 * ## Nothing here reports success it did not earn
 * `sent` means a datagram left the machine. Whether the console obeyed is
 * decided by the next observation and by nothing else, which is why the state
 * only moves to ACTIVE or REST when the console itself says so.
 */

export interface CommandOutcome {
  sent: boolean;
  code?: string;
  detail?: string;
}

/** The backend's answer to "may this panel rest the console?" See {@link ControllerPorts.claimRest}. */
export type RestClaim = "granted" | "elsewhere" | "unknown";

/** Everything the controller needs from the world outside it. */
export interface ControllerPorts {
  wake(hostId: string, address: string): Promise<CommandOutcome>;
  /**
   * Ask a console to go to rest.
   *
   * Today's transport cannot: the local protocol has no such command, and it
   * answers `UNSUPPORTED_BY_TRANSPORT`. That answer is surfaced, never
   * swallowed — the operator is told the console is still awake rather than
   * shown a sleep that did not happen.
   */
  rest(hostId: string, address: string): Promise<CommandOutcome>;
  /**
   * Withdraw a rest that is still in flight, because the console is wanted
   * awake now. Optional: an older desktop build cannot, and the console is then
   * woken once the rest has run its course.
   */
  cancelRest?(hostId: string): void;
  /**
   * Ask the backend whether THIS panel may put the console to rest now.
   *
   * A rest is a Remote Play session and a PS5 takes one at a time: two panels
   * of one venue resting it together are answered "Remote is already in use"
   * and it stays awake (the club, 2026-11-08). `elsewhere` = another panel
   * holds it and is resting it; `unknown` = the backend could not be asked
   * (offline, an older backend), and the rest goes ahead as it always did.
   * Optional: without it every rest goes ahead.
   */
  claimRest?(deviceId: number): Promise<RestClaim>;
  /** Give the console back after a rest that did not go out. */
  releaseRest?(deviceId: number): void;
  /** Tell the backend a console woke with no session, so the owner can be asked. */
  reportUnexpectedWake(input: { deviceId: number; hostId: string; eventId: string }): Promise<void>;
  /** Structured, and never carrying a key or a token. */
  log(event: string, fields: Record<string, unknown>): void;
  now(): number;
  newId(): string;
}

/** One console, as the board knows it this tick. */
export interface ConsoleInput {
  deviceId: number;
  hostId: string;
  address: string | null;
  actual: Observation["actual"];
  /** When the console last really answered; see {@link Observation.heardAt}. */
  heardAt?: number;
  hasSession: boolean;
  starting: boolean;
  stopping: boolean;
  maintenance: boolean;
  /** Whether the transport can put this console to rest. False today. */
  canRest: boolean;
  /**
   * Whether this machine holds the wake key for this console. `undefined`
   * while the vault has not been asked; see {@link Observation.canWake}.
   */
  canWake?: boolean;
  /**
   * An operator has just pressed Start or Stop on this console.
   *
   * The cooldowns exist so a monitor running all shift does not shout at a
   * console every ten seconds. They must not apply to somebody standing at the
   * counter who has just asked for something: waiting out a backoff that began
   * before they touched anything is exactly what "it takes ages" means.
   */
  urgent?: boolean;
  decision: Observation["decision"];
}

export interface ConsoleView {
  snapshot: MachineSnapshot;
  /** Set while a command is on the wire, so the screen can say "waking…". */
  pending: Command["kind"] | null;
}

/** How long to leave a FAILED command alone before trying it again. */
const RETRY_BACKOFF_MS = 30_000;

/**
 * How long before the same command is sent to the same console again.
 *
 * A console that has not woken yet should be asked again — a datagram can be
 * dropped, and UDP will not tell us. But asking every ten seconds for the whole
 * shift is how one console that will never wake becomes constant traffic in a
 * venue. Twice a minute is a retry; six times is a problem.
 */
const RESEND_COOLDOWN_MS = 20_000;

/**
 * Right after a press the cooldowns are lifted, but the same datagram is still
 * not sent more than once a second: the board re-renders several times a
 * second and each render is a tick (measured: five wakes in one second).
 */
const URGENT_RESEND_MS = 1_000;

/**
 * How long to leave a console alone after the backend said another panel is
 * resting it — a press included. That panel's rest takes 6-12 s on Wi-Fi
 * (measured); asking again sooner would only be refused again, and asking
 * the CONSOLE is exactly what gets everybody "already in use".
 */
const REST_ELSEWHERE_RECHECK_MS = 10_000;

/**
 * How long to leave a console alone after it asked for its user's login
 * passcode, a press included. Nothing the panel sends changes that answer; a
 * player signing in on the console does, and that takes seconds, not one.
 * Measured 2026-11-08: without it a press re-asked every 1.5 s for 45 s.
 */
const PASSCODE_RECHECK_MS = 15_000;

export class Ps5Controller {
  private readonly snapshots = new Map<string, MachineSnapshot>();
  private readonly inFlight = new Map<string, Command["kind"]>();
  private readonly failedAt = new Map<string, number>();
  /** Why the last command failed, while it is still failing. */
  private readonly lastError = new Map<string, string>();
  /** When each command was last put on the wire, keyed by console and kind. */
  private readonly sentAt = new Map<string, number>();
  /** When the backend last said another panel is resting each console. */
  private readonly restElsewhereAt = new Map<string, number>();
  /** When each console last asked for a login passcode the panel does not have. */
  private readonly passcodeAskedAt = new Map<string, number>();
  /** Wakes the backend has accepted, so the owner is asked once per event. */
  private readonly reported = new Set<string>();
  /**
   * What each console's machine wanted on its latest tick. A command that comes
   * back after the wish has turned the other way (a rest still retrying when a
   * session started) is stale: its failure says nothing about the command that
   * is wanted now, so it must not start a backoff or paint an error.
   */
  private readonly desired = new Map<string, MachineSnapshot["desired"]>();
  /** Consoles whose in-flight rest has already been withdrawn, so it is asked once. */
  private readonly cancelAsked = new Set<string>();

  constructor(private readonly ports: ControllerPorts) {}

  view(hostId: string): ConsoleView {
    return {
      snapshot: this.snapshots.get(hostId) ?? initialSnapshot(),
      pending: this.inFlight.get(hostId) ?? null,
    };
  }

  /** Consoles that have gone away, so their state does not linger on a screen. */
  forget(hostIds: string[]): void {
    for (const hostId of hostIds) {
      this.snapshots.delete(hostId);
      this.inFlight.delete(hostId);
      this.failedAt.delete(hostId);
      this.lastError.delete(hostId);
      this.sentAt.delete(`${hostId}:wake`);
      this.sentAt.delete(`${hostId}:rest`);
      this.desired.delete(hostId);
      this.cancelAsked.delete(hostId);
      this.restElsewhereAt.delete(hostId);
      this.passcodeAskedAt.delete(hostId);
    }
  }

  /**
   * An operator has just pressed Start or Stop on this console: a fresh intent.
   *
   * What went wrong before the press belongs to the previous intent. A rest that
   * failed must not hold the wake back for thirty seconds, and a wake that gave
   * up an hour ago must not stop this one being tried; the give-up clock starts
   * again from this press. The machine still decides only from what the console
   * is observed to be.
   */
  pressed(hostId: string): void {
    this.failedAt.delete(hostId);
    this.lastError.delete(hostId);
    const snapshot = this.snapshots.get(hostId);
    if (snapshot) this.snapshots.set(hostId, { ...snapshot, wakingSince: null, error: null });
  }

  /**
   * One pass over every bound console.
   *
   * Consoles are stepped independently and their commands are issued
   * concurrently: a console that is slow to answer must not hold up the one
   * beside it, and a venue with six of them cannot afford six sequential
   * timeouts on one ten-second tick.
   */
  async tick(inputs: ConsoleInput[]): Promise<void> {
    await Promise.all(inputs.map((input) => this.tickOne(input)));
  }

  private async tickOne(input: ConsoleInput): Promise<void> {
    const previous = this.snapshots.get(input.hostId) ?? initialSnapshot();
    const { next, commands } = step(previous, {
      actual: input.actual,
      hasSession: input.hasSession,
      starting: input.starting,
      stopping: input.stopping,
      maintenance: input.maintenance,
      canRest: input.canRest,
      canWake: input.canWake,
      commandError: this.lastError.get(input.hostId) ?? null,
      decision: input.decision,
      pressed: input.urgent === true,
      heardAt: input.heardAt,
      now: this.ports.now(),
    }, this.ports.newId());

    this.snapshots.set(input.hostId, next);
    this.desired.set(input.hostId, next.desired);

    // The latest wish wins: a rest still being retried is withdrawn as soon as
    // the console is wanted for anything other than rest.
    if (this.inFlight.get(input.hostId) === "rest" && next.desired !== "rest" && !this.cancelAsked.has(input.hostId)) {
      this.cancelAsked.add(input.hostId);
      this.ports.log("PS5_REST_WITHDRAWN", { hostId: input.hostId, desired: next.desired });
      try {
        this.ports.cancelRest?.(input.hostId);
      } catch {
        // Best effort: the rest then runs its course and the console is woken
        // from what it is observed to be.
      }
    }

    if (previous.state !== next.state) {
      this.ports.log("PS5_STATE_CHANGED", {
        hostId: input.hostId, from: previous.state, to: next.state, desired: next.desired,
      });
    }

    // Reporting is driven by the state rather than by the transition command:
    // a report that failed to reach the backend must be tried again, and the
    // machine only emits that command once, when the wake is first seen.
    if (next.state === "UNEXPECTED_WAKE" && next.wakeEventId) {
      await this.ensureReported(input, next.wakeEventId);
    }

    for (const command of commands) {
      if (command.kind === "report-unexpected-wake") continue;
      await this.execute(input, command);
    }
  }

  /**
   * Make sure the owner has been asked about this wake — exactly once, and not
   * never.
   *
   * The success case is one request per event however many ticks the console
   * stays awake. The failure case is a retry on the next tick, because a
   * dropped request otherwise means nobody is ever told a console is running in
   * their venue with no session on it.
   */
  private async ensureReported(input: ConsoleInput, eventId: string): Promise<void> {
    if (this.reported.has(eventId)) return;

    this.ports.log("PS5_UNEXPECTED_WAKE", { hostId: input.hostId, deviceId: input.deviceId, eventId });

    try {
      await this.ports.reportUnexpectedWake({ deviceId: input.deviceId, hostId: input.hostId, eventId });
      this.reported.add(eventId);
    } catch (error) {
      // Left unreported so the next tick tries again. The ten seconds keep
      // running regardless: a console is not left awake because a request
      // failed, and nothing here pretends the owner was notified.
      this.ports.log("PS5_TRANSPORT_ERROR", {
        hostId: input.hostId, stage: "report-unexpected-wake",
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async execute(input: ConsoleInput, command: Command): Promise<void> {
    // ONE command per console at a time, whatever it is (2026-10-27). Pressing
    // Start three times produces one wake, and a wake never goes out while a
    // rest for the same console is still on the wire — even a withdrawn one:
    // until it returns, its standby may still land, and a wake beside it is
    // exactly the "on, off, on" an operator sees. A withdrawn rest returns as
    // soon as its connection is up (it checks the withdrawal once more before
    // asking the console), and the next tick sends the wake.
    if (this.inFlight.has(input.hostId)) return;

    // Another panel of the venue is resting this console: leave it to that
    // panel for a while, a press included (see REST_ELSEWHERE_RECHECK_MS).
    if (command.kind === "rest") {
      const elsewhereAt = this.restElsewhereAt.get(input.hostId);
      if (elsewhereAt !== undefined && this.ports.now() - elsewhereAt < REST_ELSEWHERE_RECHECK_MS) return;
      const passcodeAt = this.passcodeAskedAt.get(input.hostId);
      if (passcodeAt !== undefined && this.ports.now() - passcodeAt < PASSCODE_RECHECK_MS) return;
    }

    const sentKey = `${input.hostId}:${command.kind}`;

    if (input.urgent) {
      const sentAt = this.sentAt.get(sentKey);
      if (sentAt !== undefined && this.ports.now() - sentAt < URGENT_RESEND_MS) return;
    }

    if (!input.urgent) {
      const failedAt = this.failedAt.get(input.hostId);
      if (failedAt !== undefined && this.ports.now() - failedAt < RETRY_BACKOFF_MS) return;

      // The same command, to the same console, is a retry — worth doing, but
      // not on every tick of a ten-second monitor.
      const sentAt = this.sentAt.get(sentKey);
      if (sentAt !== undefined && this.ports.now() - sentAt < RESEND_COOLDOWN_MS) return;
    }

    if (!input.address) {
      // Bound but never located. Nothing to aim at until a sweep finds it.
      this.snapshots.set(input.hostId, withError(this.view(input.hostId).snapshot, "DEVICE_NOT_FOUND"));
      this.ports.log("PS5_TRANSPORT_ERROR", { hostId: input.hostId, code: "DEVICE_NOT_FOUND" });
      return;
    }

    this.inFlight.set(input.hostId, command.kind);
    this.cancelAsked.delete(input.hostId);
    const startedAt = this.ports.now();
    this.sentAt.set(sentKey, startedAt);
    this.ports.log(command.kind === "wake" ? "PS5_WAKE_REQUESTED" : "PS5_REST_REQUESTED", {
      hostId: input.hostId, deviceId: input.deviceId,
    });
    // How the command ended and how long it took, on one line (2026-11-02):
    // the measurement a slow evening is diagnosed from. `sent` is the transport
    // having done its part, never the console having obeyed.
    let result: string = "threw";
    // Held by this panel for this rest. Kept after a rest that went out, so no
    // other panel opens a session to a console on its way down (the lease
    // ends by itself); given back when the rest did not go out.
    let leased = false;
    let restSent = false;

    try {
      if (command.kind === "rest" && this.ports.claimRest) {
        const claim = await this.claimRest(input.deviceId);
        if (claim === "elsewhere") {
          // Not a failure: no backoff, no error on the tile, nothing sent. The
          // console is watched falling asleep like any other.
          result = "ELSEWHERE";
          this.restElsewhereAt.set(input.hostId, this.ports.now());
          // Nothing went out: the resend cooldown is for a rest that did, and
          // would hold this console back 20 s instead of the recheck's 10.
          this.sentAt.delete(sentKey);
          this.ports.log("PS5_REST_ELSEWHERE", { hostId: input.hostId, deviceId: input.deviceId });
          return;
        }
        leased = claim === "granted";
        this.restElsewhereAt.delete(input.hostId);

        // The wish may have turned while the backend was being asked (a
        // session started): the rest must not go out under that player.
        if (this.superseded(input.hostId, "rest") || this.cancelAsked.has(input.hostId)) {
          result = "CANCELLED";
          this.ports.log("PS5_COMMAND_SUPERSEDED", { hostId: input.hostId, command: "rest", code: "BEFORE_SEND" });
          return;
        }
      }

      const outcome = command.kind === "wake"
        ? await this.ports.wake(input.hostId, input.address)
        : await this.ports.rest(input.hostId, input.address);
      result = outcome.sent ? "sent" : (outcome.code ?? "TRANSPORT_ERROR");
      restSent = command.kind === "rest" && outcome.sent;

      if (command.kind === "rest") {
        if (outcome.code === "PASSCODE_REQUIRED" || outcome.code === "PASSCODE_WRONG") this.passcodeAskedAt.set(input.hostId, this.ports.now());
        else this.passcodeAskedAt.delete(input.hostId);
      }

      if (outcome.sent) {
        // Sent, NOT confirmed. Confirmation is the next observation's job, and
        // the state stays WAKING or GOING_TO_REST until the console says so.
        this.failedAt.delete(input.hostId);
        this.lastError.delete(input.hostId);
        return;
      }

      if (outcome.code === "CANCELLED" || this.superseded(input.hostId, command.kind)) {
        // Withdrawn, or answered after the wish turned the other way. Not a
        // failure of what is wanted now, so no backoff and no error on the tile.
        this.ports.log("PS5_COMMAND_SUPERSEDED", { hostId: input.hostId, command: command.kind, code: outcome.code });
        return;
      }

      this.failedAt.set(input.hostId, this.ports.now());
      this.lastError.set(input.hostId, outcome.code ?? "TRANSPORT_ERROR");
      this.snapshots.set(
        input.hostId,
        withError(this.snapshots.get(input.hostId) ?? initialSnapshot(), outcome.code ?? "TRANSPORT_ERROR"),
      );
      this.ports.log("PS5_TRANSPORT_ERROR", {
        hostId: input.hostId, command: command.kind, code: outcome.code, detail: outcome.detail,
      });
    } catch (error) {
      if (this.superseded(input.hostId, command.kind)) {
        this.ports.log("PS5_COMMAND_SUPERSEDED", { hostId: input.hostId, command: command.kind, code: "THREW" });
        return;
      }
      this.failedAt.set(input.hostId, this.ports.now());
      this.snapshots.set(
        input.hostId,
        withError(this.snapshots.get(input.hostId) ?? initialSnapshot(), "TRANSPORT_ERROR"),
      );
      this.ports.log("PS5_TRANSPORT_ERROR", {
        hostId: input.hostId, command: command.kind,
        detail: error instanceof Error ? error.message : String(error),
      });
    } finally {
      if (leased && !restSent) {
        try {
          this.ports.releaseRest?.(input.deviceId);
        } catch {
          // Best effort: an unreleased lease ends by itself.
        }
      }
      this.inFlight.delete(input.hostId);
      this.cancelAsked.delete(input.hostId);
      this.ports.log("PS5_COMMAND_DONE", {
        hostId: input.hostId, command: command.kind, result, ms: this.ports.now() - startedAt,
      });
    }
  }

  /** {@link ControllerPorts.claimRest}, where a port that throws means "could not ask". */
  private async claimRest(deviceId: number): Promise<RestClaim> {
    try {
      return (await this.ports.claimRest?.(deviceId)) ?? "unknown";
    } catch {
      return "unknown";
    }
  }

  /** Whether the console is no longer wanted the way this command would leave it. */
  private superseded(hostId: string, kind: Command["kind"]): boolean {
    const wanted = this.desired.get(hostId);
    if (wanted === undefined) return false;
    return kind === "wake" ? wanted !== "active" : wanted !== "rest";
  }
}
