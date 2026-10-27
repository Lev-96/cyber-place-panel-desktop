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
  /** The machine's interfaces; injected by tests, read from the OS otherwise. */
  interfaces?: ReturnType<typeof networkInterfaces>;
}

export interface DiscoveryResult {
  consoles: PsConsole[];
  /** Where the probe was actually sent, for diagnosing a silent network. */
  probed: string[];
  /** Non-fatal problems: a refused broadcast, an interface that would not send. */
  warnings: string[];
}

/** The limited broadcast. Leaves through ONE interface unless the socket is bound to one. */
const LIMITED_BROADCAST = "255.255.255.255";

/**
 * One way out of this machine for a sweep: a socket bound to `bind` (or to
 * every address when absent) and the addresses it sends the probe to.
 */
export interface SweepLane {
  /** Names the lane in the result: the interface, or "any". */
  label: string;
  bind?: string;
  targets: string[];
}

/** An interface left out of a sweep, and why. Reported, never silent. */
export interface SkippedInterface { label: string; reason: string }

/**
 * Which interfaces a sweep goes out of, one lane each (2026-10-18).
 *
 * A club PC can have the console LAN with no gateway and a USB modem carrying
 * the default route. A limited broadcast (255.255.255.255) sent from a socket
 * bound to every address leaves through the default-route interface only — on
 * Windows that is the modem, and the console on the LAN never hears it. Bound
 * to the LAN's own address, the same datagrams leave on the LAN. So each usable
 * IPv4 interface gets its own socket, sending to its directed broadcast and to
 * the limited one. Routes, gateways and interface metrics are only read, never
 * changed, and no interface is chosen by its name.
 *
 * Left out, by what they are rather than what they are called:
 * - loopback (`internal`) — would only probe ourselves;
 * - link-local 169.254.0.0/16 — an adapter that got no address, not a network;
 * - /31 and /32 — point-to-point links such as VPN tunnels have no broadcast
 *   domain, so there is no console "on" them to find.
 */
export const discoveryLanes = (
  interfaces: ReturnType<typeof networkInterfaces> = networkInterfaces(),
): { lanes: SweepLane[]; skipped: SkippedInterface[] } => {
  const lanes: SweepLane[] = [];
  const skipped: SkippedInterface[] = [];
  const seen = new Set<string>();

  for (const [name, addresses] of Object.entries(interfaces)) {
    for (const address of addresses ?? []) {
      if (address.family !== "IPv4") continue;
      const label = `${name} ${address.address}`;
      if (address.internal) { skipped.push({ label, reason: "loopback" }); continue; }

      const ip = (address.address ?? "").split(".").map(Number);
      const mask = (address.netmask ?? "").split(".").map(Number);
      if (ip.length !== 4 || mask.length !== 4 || [...ip, ...mask].some(Number.isNaN)) {
        skipped.push({ label, reason: "malformed" });
        continue;
      }
      if (ip[0] === 169 && ip[1] === 254) { skipped.push({ label, reason: "link-local" }); continue; }
      const prefix = mask.reduce((bits, octet) => bits + octet.toString(2).replace(/0/g, "").length, 0);
      if (prefix >= 31) { skipped.push({ label, reason: "point-to-point" }); continue; }
      if (seen.has(address.address)) continue;
      seen.add(address.address);

      const directed = ip.map((octet, i) => octet | (~mask[i] & 0xff)).join(".");
      lanes.push({ label, bind: address.address, targets: [directed, LIMITED_BROADCAST] });
    }
  }

  return { lanes, skipped };
};

/**
 * One discovery sweep, out of every usable interface at once.
 *
 * Every answer is keyed by host id, so a console that replies on two
 * interfaces appears once rather than twice — and so a list of three consoles
 * is three consoles, not three copies of one.
 *
 * With no usable interface it falls back to what it always did: one socket on
 * every address, sending the limited broadcast. Extra targets (unicast) go out
 * of that socket too, where the routing table picks the way.
 *
 * Every socket is closed, on every path. A leaked UDP socket in a process that
 * runs all shift is a slow leak of file descriptors.
 */
export const discover = async (options: DiscoveryOptions = {}): Promise<DiscoveryResult> => {
  const { lanes, skipped } = discoveryLanes(options.interfaces);
  const extra = [
    ...(options.extraTargets ?? []),
    // A development escape hatch for testing against a simulated console on
    // this machine. Unset in every build we ship, and additive when set — it
    // can only cause one more datagram to be sent, never fewer.
    ...(process.env.CYBERPLACE_PS_EXTRA_TARGETS?.split(",").map((t) => t.trim()).filter(Boolean) ?? []),
  ];
  const any = [...(lanes.length === 0 ? [LIMITED_BROADCAST] : []), ...extra];
  if (any.length > 0) lanes.push({ label: "any", targets: any });

  const result = await sweepLanes(lanes, options.timeoutMs ?? 2_000, { resend: true });
  // Diagnostics without secrets: interface names and addresses of this
  // machine, what was skipped and why. Nothing here is a key or a token.
  result.warnings.push(...skipped.map((s) => `skipped ${s.label}: ${s.reason}`));
  console.info("[ps5] discovery", {
    lanes: lanes.map((l) => `${l.label} -> ${l.targets.join(",")}`),
    skipped: skipped.map((s) => `${s.label}: ${s.reason}`),
    found: result.consoles.map((c) => `${c.hostId}@${c.address}`),
    warnings: result.warnings,
  });
  return result;
};

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
/**
 * How long a status check waits, and why it asks three times (2026-10-27).
 *
 * Measured on a PS5 awake on a club's Wi-Fi: 21 answers to 60 one-second
 * probes (35 %), replies 13–1285 ms late. One datagram with a 1.2 s wait missed
 * most ticks and an awake console was shown as "unavailable" every few
 * seconds. Three copies inside 1.8 s are a retry, not a flood, and the check
 * still ends as soon as every console has answered.
 */
export const PROBE_TIMEOUT_MS = 1_800;

export const probe = async (addresses: string[], timeoutMs = PROBE_TIMEOUT_MS): Promise<DiscoveryResult> => {
  const targets = [...new Set(addresses.map((a) => a.trim()).filter(Boolean))];
  if (targets.length === 0) {
    return { consoles: [], probed: [], warnings: [] };
  }

  // Every named address is expected to answer, so the sweep can stop the
  // moment they all have — a console on a club LAN answers in about 130ms,
  // and waiting out the full timeout would make each status check ten times
  // longer than it needs to be.
  return sweepLanes([{ label: "any", targets }], timeoutMs, { finishWhenAllAnswer: true, resend: true });
};

/**
 * When a broadcast probe is sent again within one sweep, as fractions of its
 * timeout. A datagram can be dropped and UDP will not say so; three copies
 * spread over the window is a retry, not a flood (three per target per press).
 */
const RESEND_AT = [0, 0.25, 0.5];

/**
 * One sweep over a fixed set of lanes — the machinery both entry points share,
 * so a fix to the socket handling can only be made once.
 *
 * A lane that cannot open (its address went away a moment ago, say) or errors
 * mid-sweep is reported in `warnings` and closed; the others carry on, because
 * any of them may be the one the consoles are on.
 *
 * @param finishWhenAllAnswer  Stop early once every target has replied. Only
 *   meaningful for a unicast list: a broadcast has no idea how many consoles
 *   are out there, so it must always wait out its timeout.
 * @param resend  Send the probe again within the window (sweeps and status
 *   checks alike: a console on Wi-Fi drops answers).
 */
export const sweepLanes = async (
  lanes: SweepLane[],
  timeoutMs: number,
  { finishWhenAllAnswer = false, resend = false }: { finishWhenAllAnswer?: boolean; resend?: boolean } = {},
): Promise<DiscoveryResult> => {
  const found = new Map<string, PsConsole>();
  const warnings: string[] = [];
  const probed = [...new Set(lanes.flatMap((l) => l.targets))];
  const sockets: ReturnType<typeof createSocket>[] = [];
  const timers: ReturnType<typeof setTimeout>[] = [];

  return new Promise<DiscoveryResult>((resolve) => {
    let settled = false;
    let grace: ReturnType<typeof setTimeout> | null = null;
    const finish = () => {
      if (settled) return;
      settled = true;
      for (const t of timers) clearTimeout(t);
      if (grace) clearTimeout(grace);
      for (const socket of sockets) {
        try { socket.close(); } catch { /* already closed */ }
      }
      resolve({ consoles: [...found.values()], probed, warnings });
    };

    timers.push(setTimeout(finish, timeoutMs));

    // Which of the addresses we asked have replied. Kept separately from
    // `found`, which is keyed by console: two addresses can turn out to be one
    // console, and then a count of consoles would never reach the count of
    // addresses and the early finish would never fire.
    const answered = new Set<string>();
    let open = lanes.length;
    const laneDone = () => { if (--open <= 0) finish(); };

    if (lanes.length === 0) { finish(); return; }

    for (const lane of lanes) {
      const socket = createSocket({ type: "udp4", reuseAddr: true });
      sockets.push(socket);
      let closed = false;

      socket.on("message", (message, remote) => {
        const console_ = parseDiscoveryResponse(message.toString("utf8"), remote.address);
        // A packet we cannot read is not an error: anything on the LAN may send
        // us something. It is simply not a console.
        if (!console_) return;

        found.set(console_.hostId, console_);
        answered.add(remote.address);

        // Everyone we asked has spoken. Finish — but on a short grace rather
        // than this instant: answers arrive in a burst, and closing the socket
        // on the first of them would drop the ones already on the wire.
        if (finishWhenAllAnswer && probed.every((t) => answered.has(t)) && grace === null) {
          grace = setTimeout(finish, ALL_ANSWERED_GRACE_MS);
        }
      });

      socket.on("error", (error: Error) => {
        warnings.push(`${lane.label}: ${error.message}`);
        if (closed) return;
        closed = true;
        try { socket.close(); } catch { /* already closed */ }
        laneDone();
      });

      const send = () => {
        if (closed || settled) return;
        const packet = probePacket();
        for (const target of lane.targets) {
          socket.send(packet, PS_DISCOVERY_PORT, target, (error) => {
            // One unreachable target must not end the lane — the others may
            // still be the one the consoles are on.
            if (error) warnings.push(`${lane.label} -> ${target}: ${error.message}`);
          });
        }
      };

      socket.bind({ port: 0, ...(lane.bind ? { address: lane.bind } : {}) }, () => {
        try {
          socket.setBroadcast(true);
        } catch (error) {
          warnings.push(`${lane.label} broadcast: ${(error as Error).message}`);
        }

        for (const at of resend ? RESEND_AT : [0]) {
          if (at === 0) send();
          else timers.push(setTimeout(send, Math.round(timeoutMs * at)));
        }
      });
    }
  });
};
