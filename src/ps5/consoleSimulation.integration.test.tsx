// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { createSocket, type Socket } from "node:dgram";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { probe } from "../../electron/ps5/discovery";
import { PS_DISCOVERY_PORT } from "../../electron/ps5/protocol";
import { wakeWithCredential } from "../../electron/ps5/wake";

/**
 * Stop and Start against a simulated PS5 that behaves the way a real one on
 * Wi-Fi was measured to behave at a club (2026-10-19), over real UDP on
 * loopback, driven by the panel's real watcher, controller and state machine:
 *
 * - awake, it answers every probe; asleep, only one probe in three;
 * - for the first seconds after falling asleep it ignores a wake;
 * - woken, it is up a few seconds later.
 *
 * What the operator sees on the tile is recorded, and the timings are asserted.
 * A real console is still the final word; this is the closest the code can be
 * held to it without one.
 */

vi.mock("@/api/ps5", () => ({ apiReportUnexpectedWake: async () => {} }));
vi.mock("@/i18n/translations", () => ({ tActive: (key: string) => key }));
vi.mock("@/ui/notify", () => ({ notify: { message: () => {} } }));
vi.mock("@/repositories/PcRepository", () => ({ pcRepository: { rememberConsoleAddress: async () => {} } }));

const HOST = "5C9666876D85";
/**
 * Its own loopback address: the discovery tests hold 127.0.0.1:9302, and two
 * files binding the same address in parallel workers hear each other's probes.
 */
const SIM_ADDRESS = "127.0.0.2";
const CREDENTIAL = "1234567890";
/** How long the simulated console ignores a wake after falling asleep. */
const DEAF_AFTER_REST_MS = 6_000;
const WAKE_TAKES_MS = 4_000;
const REST_TAKES_MS = 3_000;

type SimState = "awake" | "falling" | "rest" | "booting";

class SimulatedPs5 {
  state: SimState = "awake";
  private restSince = 0;
  private srchInRest = 0;
  private socket: Socket | null = null;

  async start(): Promise<void> {
    const socket = createSocket({ type: "udp4", reuseAddr: true });
    this.socket = socket;
    socket.on("message", (message, remote) => {
      const text = message.toString("utf8");
      if (text.startsWith("WAKEUP")) {
        const ok = text.includes(`user-credential:${CREDENTIAL}`);
        if (ok && this.state === "rest" && Date.now() - this.restSince >= DEAF_AFTER_REST_MS) {
          this.state = "booting";
          setTimeout(() => { this.state = "awake"; }, WAKE_TAKES_MS);
        }
        return;
      }
      if (!text.startsWith("SRCH")) return;
      if (this.state === "falling" || this.state === "booting") return; // silent mid-change
      if (this.state === "rest" && (this.srchInRest++ % 3) !== 0) return; // Wi-Fi power save
      const status = this.state === "awake" ? "200 Ok" : "620 Server Standby";
      socket.send(Buffer.from([
        `HTTP/1.1 ${status}`, `host-id:${HOST}`, "host-type:PS5", "host-name:PS5-172",
        "device-discovery-protocol-version:00030010", "system-version:1", "",
      ].join("\n")), remote.port, remote.address);
    });
    await new Promise<void>((resolve, reject) => {
      socket.once("error", reject);
      socket.bind(PS_DISCOVERY_PORT, SIM_ADDRESS, resolve);
    });
  }

  /** What the panel's rest command does to a real console. */
  rest(): void {
    if (this.state !== "awake") return;
    this.state = "falling";
    setTimeout(() => { this.state = "rest"; this.restSince = Date.now(); }, REST_TAKES_MS);
  }

  stop(): void { try { this.socket?.close(); } catch { /* closed */ } }
}

let sim: SimulatedPs5;

beforeEach(async () => {
  sim = new SimulatedPs5();
  await sim.start();
  (globalThis as Record<string, unknown>).cyberplacePS5 = {
    probe: (addresses: string[], timeoutMs?: number) => probe(addresses, timeoutMs ?? 800),
    discover: async () => ({ consoles: [], probed: [], warnings: [] }),
    capabilities: async () => ({ discover: true, observe: true, wake: true, rest: true }),
    wake: (_hostId: string, address: string) => wakeWithCredential(address, CREDENTIAL),
    rest: async () => { sim.rest(); return { sent: true }; },
    restCancel: async () => {},
    hasCredential: async () => ({ has: true, available: true, persisted: true }),
  };
});

afterEach(() => {
  sim.stop();
  delete (globalThis as Record<string, unknown>).cyberplacePS5;
});

const DEVICES = [{
  id: 116, branch_id: 4, place_id: 9, label: "PS5", kind: "ps", status: "online", is_startable: true,
  console_host_id: HOST, console_address: SIM_ADDRESS,
  place: { id: 9, number: 9, name: "PS5", type: "standard", platform: "ps5" },
}] as never;

const waitFor = async (check: () => boolean, limitMs: number): Promise<number> => {
  const started = Date.now();
  while (Date.now() - started < limitMs) {
    if (check()) return Date.now() - started;
    await act(async () => { await new Promise((r) => setTimeout(r, 100)); });
  }
  return -1;
};

describe("Stop and Start against a PS5 that answers like one on Wi-Fi", () => {
  test("Stop: asleep in seconds; Start: awake in seconds; the tile never says unavailable", async () => {
    const { useConsoleControl } = await import("./useConsoleControl");
    let ids = new Set<number>([116]);
    const seen: string[] = [];
    const hook = renderHook(() => useConsoleControl({ devices: DEVICES, sessionDeviceIds: ids }));
    const state = () => hook.result.current.views[HOST]?.snapshot.state ?? "none";
    const record = () => { const s = state(); if (seen[seen.length - 1] !== s) seen.push(s); return s; };

    expect(await waitFor(() => record() === "ACTIVE", 10_000)).toBeGreaterThanOrEqual(0);
    seen.length = 0;

    // Stop.
    await act(async () => { hook.result.current.sessionStopped(116); });
    ids = new Set(); hook.rerender();
    const toRest = await waitFor(() => record() === "REST", 20_000);

    // Start two seconds after it is asleep: inside the console's deaf spell.
    await act(async () => { await new Promise((r) => setTimeout(r, 2_000)); });
    record();
    await act(async () => { hook.result.current.sessionStarting(116); });
    ids = new Set([116]); hook.rerender();
    const toActive = await waitFor(() => record() === "ACTIVE", 30_000);

    console.info("[sim] tile:", seen.join(" → "), `| Stop→REST ${toRest} ms | Start→ACTIVE ${toActive} ms`);

    expect(toRest).toBeGreaterThanOrEqual(0);
    expect(toRest).toBeLessThan(REST_TAKES_MS + 5_000);
    expect(toActive).toBeGreaterThanOrEqual(0);
    // What the console itself costs (the rest of its deaf spell, then its boot)
    // plus one wake interval and one look at it, plus a second of slack:
    // nothing else may stand between Start and ACTIVE.
    const WAKE_EVERY_MS = 1_500;
    const LOOK_EVERY_MS = 1_500 + 800;
    expect(toActive).toBeLessThan((DEAF_AFTER_REST_MS - 2_000) + WAKE_EVERY_MS + WAKE_TAKES_MS + LOOK_EVERY_MS + 1_000);
    expect(seen).not.toContain("OFFLINE");
    expect(seen).not.toContain("ERROR");
    hook.unmount();
  }, 90_000);
});
