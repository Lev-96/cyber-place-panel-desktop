import { afterEach, describe, expect, test, vi } from "vitest";
import { closeSessionsTo, closeSocketOnFailedLogin, openSessionCount, standby } from "../../electron/ps5/playactor";

/**
 * An attempt the panel gives up on must not leave its session open
 * (review of 2026-11-08): playactor waits with no timeout for a login answer,
 * and for the console to drop the connection after a standby. Either can never
 * come, and the console then says "in use" to every later request.
 */

const sessionOf = async (hostId: string) => {
  await closeSocketOnFailedLogin();
  const { TcpDeviceSocket } = await import("playactor/dist/socket/tcp");
  const { RemotePlayLoginProc } = await import("playactor/dist/remoteplay/proc/login");
  const socket = Object.create(TcpDeviceSocket.prototype) as {
    device: { id: string; address: { address: string } };
    stream: { destroy(): void; unref(): void };
    options: Record<string, unknown>; protocol: Record<string, unknown>; stayAliveUntil: number;
    execute(proc: unknown): Promise<unknown>; close(): Promise<void>;
  };
  socket.device = { id: hostId, address: { address: "192.168.1.16" } };
  socket.stream = { destroy: vi.fn(), unref: vi.fn() };
  socket.options = {}; socket.protocol = {}; socket.stayAliveUntil = 0;
  const login = new RemotePlayLoginProc({});
  login.perform = () => new Promise(() => {}); // the console never answers
  void socket.execute(login);
  return socket;
};

afterEach(() => vi.useRealTimers());

describe("sessions left behind", () => {
  test("a login in progress is remembered, by the console's host-id", async () => {
    await sessionOf("AAA111");
    expect(openSessionCount("AAA111")).toBe(1);
    await closeSessionsTo("AAA111");
    expect(openSessionCount("AAA111")).toBe(0);
  });

  test("closing one console's sessions leaves another console's alone", async () => {
    const a = await sessionOf("AAA222");
    const b = await sessionOf("BBB222");
    await closeSessionsTo("AAA222");
    expect(a.stream.destroy).toHaveBeenCalled();
    expect(b.stream.destroy).not.toHaveBeenCalled();
    expect(openSessionCount("BBB222")).toBe(1);
    await closeSessionsTo("BBB222");
  });

  test("a rest attempt that runs out of time closes what it left open", async () => {
    vi.useFakeTimers();
    const left = await sessionOf("CCC333");
    const never = () => new Promise<never>(() => {});

    const result = standby("192.168.1.16", {} as never, "CCC333", () => false, never as never);
    await vi.advanceTimersByTimeAsync(70_000); // two attempts within the 60 s total, and the pause between

    expect((await result).code).toBe("TIMEOUT");
    expect(left.stream.destroy).toHaveBeenCalled();
    expect(openSessionCount("CCC333")).toBe(0);
  });

  test("a withdrawn rest closes what it left open", async () => {
    vi.useFakeTimers();
    const left = await sessionOf("DDD444");
    let withdrawn = false;
    const never = () => new Promise<never>(() => {});

    const result = standby("192.168.1.16", {} as never, "DDD444", () => withdrawn, never as never);
    await vi.advanceTimersByTimeAsync(1_000);
    withdrawn = true;
    await vi.advanceTimersByTimeAsync(1_000);

    expect((await result).code).toBe("CANCELLED");
    expect(left.stream.destroy).toHaveBeenCalled();
  });
});
