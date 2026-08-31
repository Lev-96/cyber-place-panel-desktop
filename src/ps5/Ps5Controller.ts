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
  hasSession: boolean;
  starting: boolean;
  stopping: boolean;
  maintenance: boolean;
  /** Whether the transport can put this console to rest. False today. */
  canRest: boolean;
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

export class Ps5Controller {
  private readonly snapshots = new Map<string, MachineSnapshot>();
  private readonly inFlight = new Map<string, Command["kind"]>();
  private readonly failedAt = new Map<string, number>();
  /** When each command was last put on the wire, keyed by console and kind. */
  private readonly sentAt = new Map<string, number>();
  /** Wakes the backend has accepted, so the owner is asked once per event. */
  private readonly reported = new Set<string>();

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
      this.sentAt.delete(`${hostId}:wake`);
      this.sentAt.delete(`${hostId}:rest`);
    }
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
      decision: input.decision,
      now: this.ports.now(),
    }, this.ports.newId());

    this.snapshots.set(input.hostId, next);

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
    // Pressing Start three times must produce one wake, not three.
    if (this.inFlight.has(input.hostId)) return;

    const failedAt = this.failedAt.get(input.hostId);
    if (failedAt !== undefined && this.ports.now() - failedAt < RETRY_BACKOFF_MS) return;

    // The same command, to the same console, is a retry — worth doing, but not
    // on every tick of a ten-second monitor.
    const sentKey = `${input.hostId}:${command.kind}`;
    const sentAt = this.sentAt.get(sentKey);
    if (sentAt !== undefined && this.ports.now() - sentAt < RESEND_COOLDOWN_MS) return;

    if (!input.address) {
      // Bound but never located. Nothing to aim at until a sweep finds it.
      this.snapshots.set(input.hostId, withError(this.view(input.hostId).snapshot, "DEVICE_NOT_FOUND"));
      this.ports.log("PS5_TRANSPORT_ERROR", { hostId: input.hostId, code: "DEVICE_NOT_FOUND" });
      return;
    }

    this.inFlight.set(input.hostId, command.kind);
    this.sentAt.set(sentKey, this.ports.now());
    this.ports.log(command.kind === "wake" ? "PS5_WAKE_REQUESTED" : "PS5_REST_REQUESTED", {
      hostId: input.hostId, deviceId: input.deviceId,
    });

    try {
      const outcome = command.kind === "wake"
        ? await this.ports.wake(input.hostId, input.address)
        : await this.ports.rest(input.hostId, input.address);

      if (outcome.sent) {
        // Sent, NOT confirmed. Confirmation is the next observation's job, and
        // the state stays WAKING or GOING_TO_REST until the console says so.
        this.failedAt.delete(input.hostId);
        return;
      }

      this.failedAt.set(input.hostId, this.ports.now());
      this.snapshots.set(
        input.hostId,
        withError(this.snapshots.get(input.hostId) ?? initialSnapshot(), outcome.code ?? "TRANSPORT_ERROR"),
      );
      this.ports.log("PS5_TRANSPORT_ERROR", {
        hostId: input.hostId, command: command.kind, code: outcome.code, detail: outcome.detail,
      });
    } catch (error) {
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
      this.inFlight.delete(input.hostId);
    }
  }
}
