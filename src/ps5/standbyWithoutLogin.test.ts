import { describe, expect, test, vi } from "vitest";
import {
  closeSessionsTo,
  closeSocketOnFailedLogin,
  isLoginRefusal,
  markLoginRefusal,
  openForStandby,
  openSessionCount,
} from "../../electron/ps5/playactor";

/**
 * A console with four pads in use refuses the panel's Remote Play login
 * (`Error[4] UNKNOWN_ERROR`, measured 2026-11-24 on the owner's console) and
 * then never sleeps. The rest is sent on a session opened without the login —
 * but ONLY after the console refused the login: every console that accepts it
 * is rested on the unchanged path.
 */

const refusal = (message: string) => {
  const error = new Error(message);
  markLoginRefusal(error);
  return error;
};

describe("opening the session for a rest", () => {
  test("a console that accepts the login is rested exactly as before: one open, with the login", async () => {
    const open = vi.fn(async () => "connection");
    const login = { login: { passCode: "1234" } };

    await expect(openForStandby(open, login)).resolves.toBe("connection");
    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith(login);
  });

  test("no passcode: still one open, with nothing added", async () => {
    const open = vi.fn(async () => "connection");

    await openForStandby(open, undefined);
    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith(undefined);
  });

  test("the console refuses the login (four pads): opened once more without it", async () => {
    const open = vi.fn()
      .mockRejectedValueOnce(refusal("Error[4] UNKNOWN_ERROR"))
      .mockResolvedValueOnce("connection");

    await expect(openForStandby(open, undefined)).resolves.toBe("connection");
    expect(open).toHaveBeenCalledTimes(2);
    expect(open).toHaveBeenNthCalledWith(2, { skipLogin: true });
  });

  test("the saved passcode travels with the second open", async () => {
    const open = vi.fn()
      .mockRejectedValueOnce(refusal("Error[4] UNKNOWN_ERROR"))
      .mockResolvedValueOnce("connection");

    await openForStandby(open, { login: { passCode: "1234" } });
    expect(open).toHaveBeenNthCalledWith(2, { login: { passCode: "1234" }, skipLogin: true });
  });

  test("the passcode answers keep their meaning: no second open", async () => {
    for (const message of ["Error[1] PASSCODE_IS_NEEDED", "Error[1] PASSCODE_IS_UNMATCHED"]) {
      const open = vi.fn().mockRejectedValueOnce(refusal(message));

      await expect(openForStandby(open, undefined)).rejects.toThrow(message);
      expect(open).toHaveBeenCalledTimes(1);
    }
  });

  test("a failure that is not the login's (in use, not found, a timeout) is not retried here", async () => {
    for (const message of ["Remote is already in use", "Unable to locate device", "Error[4] UNKNOWN_ERROR"]) {
      // Not marked: it did not come out of the login step.
      const open = vi.fn().mockRejectedValueOnce(new Error(message));

      await expect(openForStandby(open, undefined)).rejects.toThrow(message);
      expect(open).toHaveBeenCalledTimes(1);
    }
  });

  test("when the open without the login fails too, that failure is the answer", async () => {
    const open = vi.fn()
      .mockRejectedValueOnce(refusal("Error[4] UNKNOWN_ERROR"))
      .mockRejectedValueOnce(new Error("Remote is already in use"));

    await expect(openForStandby(open, undefined)).rejects.toThrow("already in use");
    expect(open).toHaveBeenCalledTimes(2);
  });
});

describe("the login step on the library's real classes", () => {
  const realModules = async () => {
    const { TcpDeviceSocket } = await import("playactor/dist/socket/tcp");
    const { RemotePlayLoginProc } = await import("playactor/dist/remoteplay/proc/login");
    return { TcpDeviceSocket, RemotePlayLoginProc };
  };
  const socketOf = (TcpDeviceSocket: { prototype: object }, id: string) => {
    const socket = Object.create(TcpDeviceSocket.prototype) as {
      execute(proc: unknown): Promise<unknown>;
      close(): Promise<void>;
      device: { id: string };
      closed: ReturnType<typeof vi.fn>;
    };
    socket.device = { id };
    return socket;
  };

  test("a login the console refuses is recognised as its refusal", async () => {
    await closeSocketOnFailedLogin();
    const { TcpDeviceSocket, RemotePlayLoginProc } = await realModules();
    const login = new RemotePlayLoginProc({});
    login.perform = async () => { throw new Error("Error[4] UNKNOWN_ERROR"); };
    const socket = socketOf(TcpDeviceSocket, "REFUSED-1");
    socket.close = vi.fn(async () => {});

    const error = await socket.execute(login).catch((e: unknown) => e);
    expect(isLoginRefusal(error)).toBe(true);
    expect(socket.close).toHaveBeenCalledTimes(1);
  });

  test("asked without the login: nothing is sent, and the session is remembered so an abandoned rest can close it", async () => {
    await closeSocketOnFailedLogin();
    const { TcpDeviceSocket, RemotePlayLoginProc } = await realModules();
    const login = new RemotePlayLoginProc({ skipLogin: true } as never);
    const perform = vi.fn(async () => undefined);
    login.perform = perform;
    const socket = socketOf(TcpDeviceSocket, "SKIP-1");
    const closed = vi.fn(async () => {});
    (socket as unknown as { stream: object }).stream = {};
    Object.defineProperty(socket, "close", { value: async function (this: unknown) {
      await closed();
      return (TcpDeviceSocket.prototype as unknown as { close(this: unknown): Promise<void> }).close.call(this).catch(() => {});
    } });

    await socket.execute(login);
    expect(perform).not.toHaveBeenCalled();
    expect(openSessionCount("SKIP-1")).toBe(1);

    await closeSessionsTo("SKIP-1");
    expect(closed).toHaveBeenCalledTimes(1);
  });

  test("an ordinary login is still performed", async () => {
    await closeSocketOnFailedLogin();
    const { TcpDeviceSocket, RemotePlayLoginProc } = await realModules();
    const login = new RemotePlayLoginProc({});
    const perform = vi.fn(async () => undefined);
    login.perform = perform;

    await socketOf(TcpDeviceSocket, "NORMAL-1").execute(login);
    expect(perform).toHaveBeenCalledTimes(1);
  });
});
