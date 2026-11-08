import { describe, expect, test, vi } from "vitest";
import { closeSocketOnFailedLogin } from "../../electron/ps5/playactor";

/**
 * A failed Remote Play login must close its connection (the club, 2026-11-08).
 *
 * playactor left the control socket open when the login threw (the console
 * asked for its user's login passcode). The socket kept answering heartbeats,
 * the console held the session, and every later request for an hour was
 * "Remote is already in use". Run against the library's real classes.
 */

const realModules = async () => {
  const { TcpDeviceSocket } = await import("playactor/dist/socket/tcp");
  const { RemotePlayLoginProc } = await import("playactor/dist/remoteplay/proc/login");
  return { TcpDeviceSocket, RemotePlayLoginProc };
};

/** A socket of the library's own class, with nothing behind it. */
const socketOf = (TcpDeviceSocket: { prototype: object }) => {
  const socket = Object.create(TcpDeviceSocket.prototype) as {
    execute(proc: unknown): Promise<unknown>;
    close: ReturnType<typeof vi.fn>;
  };
  socket.close = vi.fn(async () => {});
  return socket;
};

describe("a Remote Play login that fails", () => {
  test("closes its socket, and the error still reaches the caller", async () => {
    await closeSocketOnFailedLogin();
    const { TcpDeviceSocket, RemotePlayLoginProc } = await realModules();
    const login = new RemotePlayLoginProc({});
    login.perform = async () => { throw new Error("Error[1] PASSCODE_IS_NEEDED"); };
    const socket = socketOf(TcpDeviceSocket);

    await expect(socket.execute(login)).rejects.toThrow("PASSCODE_IS_NEEDED");
    expect(socket.close).toHaveBeenCalledTimes(1);
  });

  test("a login that succeeds leaves the socket open for the standby", async () => {
    await closeSocketOnFailedLogin();
    const { TcpDeviceSocket, RemotePlayLoginProc } = await realModules();
    const login = new RemotePlayLoginProc({});
    login.perform = async () => undefined;
    const socket = socketOf(TcpDeviceSocket);

    await socket.execute(login);
    expect(socket.close).not.toHaveBeenCalled();
  });

  test("any other procedure that fails is left exactly as before", async () => {
    await closeSocketOnFailedLogin();
    const { TcpDeviceSocket } = await realModules();
    const socket = socketOf(TcpDeviceSocket);
    const other = { perform: async () => { throw new Error("handshake"); } };

    await expect(socket.execute(other)).rejects.toThrow("handshake");
    expect(socket.close).not.toHaveBeenCalled();
  });

  test("the guard is installed once, however often it is asked", async () => {
    const { TcpDeviceSocket } = await realModules();
    await closeSocketOnFailedLogin();
    const wrapped = TcpDeviceSocket.prototype.execute;
    await closeSocketOnFailedLogin();
    await closeSocketOnFailedLogin();
    expect(TcpDeviceSocket.prototype.execute).toBe(wrapped);
  });

  test("a close that itself fails does not hide the login error", async () => {
    await closeSocketOnFailedLogin();
    const { TcpDeviceSocket, RemotePlayLoginProc } = await realModules();
    const login = new RemotePlayLoginProc({});
    login.perform = async () => { throw new Error("Error[1] PASSCODE_IS_NEEDED"); };
    const socket = socketOf(TcpDeviceSocket);
    socket.close.mockRejectedValueOnce(new Error("already gone"));

    await expect(socket.execute(login)).rejects.toThrow("PASSCODE_IS_NEEDED");
  });
});
