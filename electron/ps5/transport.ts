import { discover, probe } from "./discovery";
import { standby } from "./playactor";
import { wake } from "./wake";
import type { WakeKeys } from "./credentials";
import type { PsConsole } from "./protocol";

/**
 * Everything that physically touches a PlayStation, behind one seam.
 *
 * The point of the seam is honesty about what a transport can actually do. The
 * protocol a console speaks on the local network — the one Sony's own client
 * uses to find and wake consoles — has exactly two commands, `SRCH` and
 * `WAKEUP`. There is no "go to rest" datagram, and no amount of implementation
 * on our side produces one. Putting a console to rest is a message *inside* an
 * established Remote Play session (`GOTO_BED`, control message 0x50), which
 * means a different transport entirely: TCP 9295, a key exchange, an encrypted
 * channel.
 *
 * So the interface carries `capabilities`, and this transport says `rest:
 * false` and refuses the command with a reason. Everything above it — the state
 * machine, the session lifecycle, the unexpected-wake protection — is written
 * against the interface and does not care which transport is underneath. The
 * day a rest-capable transport exists it is one object swap, with no change to
 * any of the logic that uses it.
 *
 * What must never happen here is the alternative: returning success for a
 * command nothing sent. A screen that says a console went to sleep when it is
 * sitting on the venue's floor still running is worse than one that says it
 * could not.
 */

export type ConsoleObservation = "awake" | "rest" | "unreachable" | "unknown";

/** Why a command did not happen. Each is a different thing to do about it. */
export type Ps5ErrorCode =
  | "IN_USE"
  | "NO_CREDENTIAL"
  | "BAD_CREDENTIAL"
  | "DEVICE_NOT_FOUND"
  | "TRANSPORT_ERROR"
  | "UNSUPPORTED_BY_TRANSPORT"
  | "INVALID_STATE";

export interface CommandResult {
  /**
   * The command left this machine. NOT "the console did it" — these are UDP
   * datagrams and nothing answers them. Confirmation only ever comes from a
   * later observation, which is why every caller has to watch for the state
   * rather than trust this.
   */
  sent: boolean;
  code?: Ps5ErrorCode;
  detail?: string;
}

export interface TransportCapabilities {
  /** Can it find consoles on the network? */
  discover: boolean;
  /** Can it read a console's state? */
  observe: boolean;
  /** Can it wake one from rest? */
  wake: boolean;
  /** Can it put one INTO rest? No LAN transport can — see the note above. */
  rest: boolean;
}

export interface Ps5Transport {
  readonly name: string;
  readonly capabilities: TransportCapabilities;
  /** Sweep the network. Expensive; belongs behind a button, not on a timer. */
  discover(timeoutMs?: number): Promise<PsConsole[]>;
  /** Ask named addresses directly. Cheap; this is what the monitor uses. */
  observe(addresses: string[], timeoutMs?: number): Promise<PsConsole[]>;
  wake(address: string, registKey: string | null): Promise<CommandResult>;
  /**
   * @param hostId  Which console, by its own identity. The address is where it
   *   was last seen; the host-id is what it IS, and with more than one console
   *   in a venue only the second one is safe to act on.
   */
  requestRest(address: string, hostId?: string): Promise<CommandResult>;
}

/**
 * The transport that exists today: Sony's local discovery protocol.
 *
 * Finds consoles, reads their state, wakes them with the owner's own
 * registration key. Cannot put one to rest, and says so.
 */
export class DiscoveryTransport implements Ps5Transport {
  readonly name = "sony-discovery-udp";

  /**
   * @param keys  The vault holding pairing credentials. Resting a console needs
   *   them — it happens inside an authenticated session — so a transport built
   *   without them can find and wake, and says it cannot rest.
   */
  constructor(private readonly keys?: WakeKeys) {}

  get capabilities(): TransportCapabilities {
    return {
      discover: true,
      observe: true,
      wake: true,
      // Resting is not a datagram: it is a request inside a Remote Play session,
      // which exists only for a console that has been paired. Reported as a
      // capability rather than assumed, so the state machine never issues a
      // command that cannot be carried out.
      rest: Boolean(this.keys),
    };
  }

  async discover(timeoutMs?: number): Promise<PsConsole[]> {
    return (await discover(timeoutMs === undefined ? {} : { timeoutMs })).consoles;
  }

  async observe(addresses: string[], timeoutMs?: number): Promise<PsConsole[]> {
    return (await probe(addresses, timeoutMs)).consoles;
  }

  async wake(address: string, registKey: string | null): Promise<CommandResult> {
    const result = await wake(address, registKey);
    if (result.sent) return { sent: true };

    return {
      sent: false,
      code: result.reason === "no-credential" ? "NO_CREDENTIAL"
        : result.reason === "bad-credential" ? "BAD_CREDENTIAL"
          : "TRANSPORT_ERROR",
      detail: result.detail,
    };
  }

  async requestRest(address: string, hostId?: string): Promise<CommandResult> {
    if (!this.keys) {
      return {
        sent: false,
        code: "UNSUPPORTED_BY_TRANSPORT",
        detail: "No credential vault: resting a console needs a paired session.",
      };
    }

    const result = await standby(address, this.keys, hostId);
    if (result.ok) return { sent: true };

    return {
      sent: false,
      // A console nobody paired cannot be rested, and that is a different
      // sentence from one that could not be reached.
      // Each of the console's answers means something different to whoever is
      // standing in front of it.
      code: result.code === "IN_USE" ? "IN_USE"
        : result.code === "REJECTED" ? "NO_CREDENTIAL"
          : result.code === "UNREACHABLE" ? "DEVICE_NOT_FOUND"
            : "TRANSPORT_ERROR",
      detail: result.detail,
    };
  }
}

/**
 * The transport the app runs on.
 *
 * Built once the vault exists, because what it can do depends on having one.
 * Until then it is the find-and-wake half, which is also exactly what a panel
 * with no paired console can honestly offer.
 */
let transport: Ps5Transport = new DiscoveryTransport();

export const activeTransport = (): Ps5Transport => transport;

/** Called at startup, once the credential vault has been loaded. */
export const useCredentialVault = (keys: WakeKeys): void => {
  transport = new DiscoveryTransport(keys);
};
