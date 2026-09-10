/**
 * The wire format a PlayStation speaks on the local network.
 *
 * This is the same exchange Sony's own Remote Play client uses to find a
 * console before connecting to it: a small text datagram to UDP 9302, and a
 * text answer shaped like an HTTP response. Nothing here is authenticated and
 * nothing here changes the console — a probe is a question, and any device on
 * the club's LAN can already ask it.
 *
 * Sony publishes no specification for it. Everything below is transcribed from
 * the behaviour third-party clients rely on, which means two things: it works
 * today because Sony's own apps depend on it, and it could change with a
 * firmware release. So the parser is written to be *disappointed* rather than
 * to throw — an answer it does not recognise produces a console in the
 * `unknown` state, never an exception on a screen.
 */

/** Where a console listens for the probe. */
export const PS_DISCOVERY_PORT = 9302;

/**
 * The probe itself.
 *
 * `SRCH` is the verb; the version tells the console which dialect to answer
 * in. The trailing blank line matters — the console treats the payload as a
 * header block and wants it terminated like one.
 */
export const probePacket = (): Buffer =>
  Buffer.from("SRCH * HTTP/1.1\ndevice-discovery-protocol-version:00030010\n\n", "utf8");

/**
 * What a console is doing, as far as a probe can tell.
 *
 *  - `awake`       — powered on. Someone can play on it right now.
 *  - `rest`        — rest mode: reachable, and the only state it can be woken from.
 *  - `unreachable` — no answer. Off, unplugged, or on another network. These
 *                    are indistinguishable from here and must not be presented
 *                    as different things.
 *  - `unknown`     — it answered, and we did not understand the answer. Kept
 *                    separate from `unreachable` because it means the protocol
 *                    moved, not that the console did.
 */
export type PsState = "awake" | "rest" | "unreachable" | "unknown";

export interface PsConsole {
  /**
   * The console's own identifier, stable across reboots and DHCP leases.
   *
   * This is the identity. An IP address is a hint that changes the first time
   * the router restarts, and binding a place to one is how a manager ends up
   * waking the wrong console.
   */
  hostId: string;
  /** What the console calls itself — what the owner will recognise in a list. */
  name: string;
  /** `PS5`, `PS4`, or whatever a future model reports. Never assumed. */
  type: string;
  /** Where it answered from, this time. A cache, never a key. */
  address: string;
  state: PsState;
  systemVersion: string | null;
  /** Everything the console said, for diagnosing an answer we did not expect. */
  raw: Record<string, string>;
}

/**
 * Turn one datagram into a console, or into nothing.
 *
 * The answer looks like `HTTP/1.1 620 Server Standby` followed by
 * `key:value` lines. The status line carries the state — 200 for awake, 620
 * for rest — and the headers carry the identity.
 */
export const parseDiscoveryResponse = (payload: string, address: string): PsConsole | null => {
  const lines = payload.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;

  const statusLine = lines[0];
  // Anything that is not an HTTP-shaped status line is not a console talking
  // to us — another service on the LAN, or a stray packet.
  const status = /^HTTP\/[\d.]+\s+(\d{3})\b/.exec(statusLine);
  if (!status) return null;

  const raw: Record<string, string> = {};
  for (const line of lines.slice(1)) {
    const at = line.indexOf(":");
    if (at <= 0) continue;
    raw[line.slice(0, at).trim().toLowerCase()] = line.slice(at + 1).trim();
  }

  const hostId = raw["host-id"] ?? "";
  // Without an identity there is nothing to bind a place to, and inventing one
  // would produce a binding that breaks the next time the console reboots.
  if (!hostId) return null;

  return {
    hostId,
    name: raw["host-name"] || hostId,
    type: raw["host-type"] || "unknown",
    address,
    state: stateFor(status[1]),
    systemVersion: raw["system-version"] ?? null,
    raw,
  };
};

const stateFor = (code: string): PsState => {
  switch (code) {
    case "200": return "awake";
    case "620": return "rest";
    // A code we have not seen before means the protocol has something new to
    // say. Reporting it as `unknown` keeps the console visible and the screen
    // honest, instead of guessing at a meaning.
    default: return "unknown";
  }
};
