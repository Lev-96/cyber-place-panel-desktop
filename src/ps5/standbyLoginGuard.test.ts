import { expect, test, vi } from "vitest";

/**
 * The guard of loginLeak.test.ts is useless unless the rest path installs it
 * before it opens a connection. Its own file: the guard is once per process.
 */

vi.mock("playactor/dist/device/pending", () => ({
  PendingDevice: class {
    discover = async () => ({ status: "AWAKE" });
    openConnection = async () => { throw new Error("Error[1] PASSCODE_IS_NEEDED"); };
  },
}));
vi.mock("playactor/dist/credentials", () => ({ CredentialManager: class {} }));

test("putting a console to rest installs the failed-login guard first", async () => {
  const { TcpDeviceSocket } = await import("playactor/dist/socket/tcp");
  const original = TcpDeviceSocket.prototype.execute;
  const { standby } = await import("../../electron/ps5/playactor");

  await standby("192.168.1.16", {} as never, "BC3329D4318D");

  expect(TcpDeviceSocket.prototype.execute).not.toBe(original);
});
