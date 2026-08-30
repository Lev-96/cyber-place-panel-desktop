import { createSocket } from "node:dgram";
import { networkInterfaces } from "node:os";
import { PS_DISCOVERY_PORT, parseDiscoveryResponse, probePacket, type PsConsole } from "./protocol";

/**
 * Find the PlayStations on this machine's own network.
 *
 * Runs in the Electron MAIN process, which is the only place it can: the
 * renderer has no sockets, and the backend is in a datacentre that shares no
 * broadcast domain with any club. The manager's computer is in the room with
 * the consoles, so it is the only component we have that can ask them
 * anything — the same reason `wol:send` lives here.
 *
 * Read-only by construction. This module can find a console and report what it
 * said; it cannot wake one, rest one, or change anything about it. Waking
 * needs a credential that Phase 1 deliberately does not carry.
 */

/**
 * How long a unicast sweep keeps listening after the last address it asked has
 * answered. Long enough for a burst of answers to land together, short enough
 * to be invisible beside a ten-second cadence.
 */
const ALL_ANSWERED_GRACE_MS = 120;

export interface DiscoveryOptions {
  /** How long to keep listening for answers. Consoles reply within a few hundred ms. */
  timeoutMs?: number;
  /** Probe these addresses as well — a console on another subnet, say. */
  extraTargets?: string[];
}

export interface DiscoveryResult {
  consoles: PsConsole[];
  /** Where the probe was actually sent, for diagnosing a silent network. */
  probed: string[];
  /** Non-fatal problems: a refused broadcast, an interface that would not send. */
  warnings: string[];
}

/**
 * Broadcast addresses derived from this machine's real interfaces.
 *
 * Derived rather than assumed, because a club on 10.x is as likely as one on
 * 192.168.x and a hard-coded list finds nothing on the wrong network. The
 * global 255.255.255.255 is included as a fallback for the case where an
 * interface reports no usable broadcast address of its own.
 */
export const broadcastTargets = (
  interfaces: ReturnType<typeof networkInterfaces> = networkInterfaces(),
): string[] => {
  const targets = new Set<string>(["255.255.255.255"]);

  for (const addresses of Object.values(interfaces)) {
    for (const address of addresses ?? []) {
      // IPv4 only: the discovery protocol is v4, and a link-local v6 address
      // would just be a packet sent nowhere.
      if (address.family !== "IPv4" || address.internal) continue;
      if (!address.address || !address.netmask) continue;

      const ip = address.address.split(".").map(Number);
      const mask = address.netmask.split(".").map(Number);
      if (ip.length !== 4 || mask.length !== 4 || [...ip, ...mask].some(Number.isNaN)) continue;

      targets.add(ip.map((octet, i) => octet | (~mask[i] & 0xff)).join("."));
    }
  }

  return [...targets];
};

/**
 * One discovery sweep.
 *
 * Every answer is keyed by host id, so a console that replies on two
 * interfaces appears once rather than twice — and so a list of three consoles
 * is three consoles, not three copies of one.
 *
 * The socket is always closed, on every path. A leaked UDP socket in a process
 * that runs all shift is a slow leak of file descriptors.
 */
export const discover = async (options: DiscoveryOptions = {}): Promise<DiscoveryResult> =>
  sweep([
    ...broadcastTargets(),
    ...(options.extraTargets ?? []),
    // A development escape hatch for testing against a simulated console on
    // this machine. Unset in every build we ship, and additive when set — it
    // can only cause one more datagram to be sent, never fewer.
    ...(process.env.CYBERPLACE_PS_EXTRA_TARGETS?.split(",").map((t) => t.trim()).filter(Boolean) ?? []),
  ], options.timeoutMs ?? 2_000);

/**
 * Ask named consoles directly, without touching the rest of the network.
 *
 * This is what the ten-second status check uses. A broadcast every ten seconds
 * would put a packet in front of every device in the club all shift for the
 * sake of two consoles; a unicast to the addresses we already know costs one
 * datagram each and is answered just as fast.
 *
 * Addresses go stale — a console keeps its `host-id` across a new DHCP lease
 * but not its address — so a caller that finds a console missing here is
 * expected to fall back to {@link discover}, which finds it wherever it moved.
 *
 * An empty list is not an error and does not open a socket: there is simply
 * nothing bound yet.
 */
export const probe = async (addresses: string[], timeoutMs = 1_200): Promise<DiscoveryResult> => {
  const targets = [...new Set(addresses.map((a) => a.trim()).filter(Boolean))];
  if (targets.length === 0) {
    return { consoles: [], probed: [], warnings: [] };
  }

  // Every named address is expected to answer, so the sweep can stop the
  // moment they all have — a console on a club LAN answers in about 130ms,
  // and waiting out the full timeout would make each status check ten times
  // longer than it needs to be.
  return sweep(targets, timeoutMs, true);
};

/**
 * One sweep over a fixed list of targets — the machinery both entry points
 * share, so a fix to the socket handling can only be made once.
 *
 * @param finishWhenAllAnswer  Stop early once every target has replied. Only
 *   meaningful for a unicast list: a broadcast has no idea how many consoles
 *   are out there, so it must always wait out its timeout.
 */
const sweep = async (targets: string[], timeoutMs: number, finishWhenAllAnswer = false): Promise<DiscoveryResult> => {
  const found = new Map<string, PsConsole>();
  const warnings: string[] = [];

  const socket = createSocket({ type: "udp4", reuseAddr: true });

  return new Promise<DiscoveryResult>((resolve) => {
    let settled = false;
    let grace: ReturnType<typeof setTimeout> | null = null;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (grace) clearTimeout(grace);
      try { socket.close(); } catch { /* already closed */ }
      resolve({ consoles: [...found.values()], probed: targets, warnings });
    };

    const timer = setTimeout(finish, timeoutMs);

    // Which of the addresses we asked have replied. Kept separately from
    // `found`, which is keyed by console: two addresses can turn out to be one
    // console, and then a count of consoles would never reach the count of
    // addresses and the early finish would never fire.
    const answered = new Set<string>();

    socket.on("message", (message, remote) => {
      const console_ = parseDiscoveryResponse(message.toString("utf8"), remote.address);
      // A packet we cannot read is not an error: anything on the LAN may send
      // us something. It is simply not a console.
      if (!console_) return;

      found.set(console_.hostId, console_);
      answered.add(remote.address);

      // Everyone we asked has spoken. Finish — but on a short grace rather
      // than this instant: answers arrive in a burst, and closing the socket
      // on the first of them would drop the ones already on the wire. A
      // console answers in about 130ms, so the grace is invisible next to the
      // ten-second cadence and still far faster than sitting out the timeout.
      if (finishWhenAllAnswer && targets.every((t) => answered.has(t)) && grace === null) {
        grace = setTimeout(finish, ALL_ANSWERED_GRACE_MS);
      }
    });

    socket.on("error", (error: Error) => {
      warnings.push(`socket: ${error.message}`);
      finish();
    });

    socket.bind(0, () => {
      try {
        socket.setBroadcast(true);
      } catch (error) {
        warnings.push(`broadcast: ${(error as Error).message}`);
      }

      const packet = probePacket();
      for (const target of targets) {
        socket.send(packet, PS_DISCOVERY_PORT, target, (error) => {
          // One unreachable interface must not end the sweep — the others may
          // still be the one the consoles are on.
          if (error) warnings.push(`${target}: ${error.message}`);
        });
      }
    });
  });
};
