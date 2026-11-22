import { createSocket, type Socket } from "node:dgram";
import { networkInterfaces, type NetworkInterfaceInfo } from "node:os";

/**
 * Finding the club's Cyber Place TVs on the local network (2026-11-23).
 *
 * Entirely separate from `electron/ps5`: its own UDP port, its own socket, no
 * shared helper. It asks and listens; it cannot change anything on a TV. The
 * answer only carries the pairing code a waiting TV already shows on screen;
 * the pairing itself is the existing server call (`POST
 * /branches/{id}/tv-screens`), made by the owner from the renderer.
 *
 * Protocol (v1), UDP port {@link TV_DISCOVERY_PORT}:
 *  - request: `CPTV-DISCOVER 1` padded with spaces to {@link REQUEST_BYTES};
 *  - reply (unicast to the asker, only from a TV still waiting for a place):
 *    `{"app":"cyberplace-tv","v":1,"env":"staging","code":"123456",
 *      "maker":"Sony","model":"BRAVIA 4K"}`.
 * A reply is never longer than the request, so a TV can never be used to
 * amplify traffic.
 */
export const TV_DISCOVERY_PORT = 47231;
export const REQUEST_BYTES = 256;
const MAGIC = "CPTV-DISCOVER 1";
const MAX_REPLY_BYTES = 512;
const MAX_FOUND = 64;

export type TvEnv = "staging" | "production";

export interface FoundTv {
  address: string;
  code: string;
  env: TvEnv;
  maker: string;
  model: string;
}

export const discoveryRequest = (): Buffer => Buffer.from(MAGIC.padEnd(REQUEST_BYTES, " "), "ascii");

/** 10/8, 172.16/12, 192.168/16, 169.254/16 and loopback: a club's own network. */
export const isPrivateIpv4 = (ip: string): boolean => {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
  if (!m) return false;
  const [a, b, c, d] = m.slice(1).map(Number);
  if ([a, b, c, d].some((n) => n > 255)) return false;
  return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254);
};

/** Printable text of at most `max` characters, or "" — what a TV says about itself is untrusted. */
const label = (value: unknown, max: number): string =>
  typeof value === "string" ? value.replace(/[^\p{L}\p{N} ._()+\-/]/gu, "").trim().slice(0, max) : "";

/** A valid reply from a waiting TV, or null for anything else. */
export const parseReply = (payload: Buffer, address: string): FoundTv | null => {
  if (payload.length === 0 || payload.length > MAX_REPLY_BYTES || !isPrivateIpv4(address)) return null;
  let body: unknown;
  try {
    body = JSON.parse(payload.toString("utf8"));
  } catch {
    return null;
  }
  if (typeof body !== "object" || body === null) return null;
  const r = body as Record<string, unknown>;
  if (r.app !== "cyberplace-tv" || r.v !== 1) return null;
  if (typeof r.code !== "string" || !/^\d{6}$/.test(r.code)) return null;
  if (r.env !== "staging" && r.env !== "production") return null;
  return { address, code: r.code, env: r.env, maker: label(r.maker, 40), model: label(r.model, 60) };
};

/**
 * Where to send the request: the directed broadcast address of every IPv4
 * network this machine is on (a club PC may have Wi-Fi and Ethernet), and the
 * limited broadcast. Directed ones matter: some routers drop 255.255.255.255.
 */
export const broadcastTargets = (
  ifaces: NodeJS.Dict<NetworkInterfaceInfo[]> = networkInterfaces(),
): string[] => {
  const out = new Set<string>(["255.255.255.255"]);
  for (const list of Object.values(ifaces)) {
    for (const i of list ?? []) {
      if (i.family !== "IPv4" || i.internal) continue;
      const addr = i.address.split(".").map(Number);
      const mask = i.netmask.split(".").map(Number);
      if (addr.length !== 4 || mask.length !== 4 || [...addr, ...mask].some((n) => !Number.isInteger(n) || n < 0 || n > 255)) continue;
      out.add(addr.map((n, k) => (n & mask[k]) | (~mask[k] & 255)).join("."));
    }
  }
  return [...out];
};

export interface DiscoverOptions {
  timeoutMs?: number;
  /** Tests send to 127.0.0.1; the app uses {@link broadcastTargets}. */
  targets?: string[];
  port?: number;
}

/**
 * Ask, listen for `timeoutMs`, return what answered (one entry per address,
 * the latest reply wins). Never throws: a socket that cannot open is an empty
 * list, so the dialog says "nothing found" instead of failing.
 */
export const discoverTvs = async ({
  timeoutMs = 1500,
  targets = broadcastTargets(),
  port = TV_DISCOVERY_PORT,
}: DiscoverOptions = {}): Promise<FoundTv[]> => {
  const wait = Math.min(5000, Math.max(300, timeoutMs));
  const found = new Map<string, FoundTv>();
  let sock: Socket | null = null;
  try {
    sock = createSocket("udp4");
    const s = sock;
    s.on("message", (msg, rinfo) => {
      const tv = parseReply(msg, rinfo.address);
      if (tv && (found.has(tv.address) || found.size < MAX_FOUND)) found.set(tv.address, tv);
    });
    s.on("error", () => { /* a send to an unreachable network is not fatal */ });
    await new Promise<void>((res, rej) => {
      s.once("error", rej);
      s.bind(0, () => { s.setBroadcast(true); res(); });
    });
    const request = discoveryRequest();
    for (const ip of targets) {
      await new Promise<void>((res) => s.send(request, port, ip, () => res()));
    }
    await new Promise((res) => setTimeout(res, wait));
  } catch {
    // Socket could not open: nothing found.
  } finally {
    try { sock?.close(); } catch { /* already closed */ }
  }
  return [...found.values()];
};
