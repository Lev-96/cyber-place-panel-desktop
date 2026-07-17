import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Hard-gate unit test for the panel's electron-updater wrapper.
 *
 * Proves the boundary that keeps owner/manager panels from self-updating
 * ahead of an admin promote: the updater downloads ONLY when the version
 * on the GitHub channel is EXACTLY the admin-promoted version. electron,
 * electron-updater and electron-log are mocked so this runs in plain node.
 */

const { autoUpdaterMock, handlers } = vi.hoisted(() => {
  const handlers: Record<string, (arg: unknown) => void> = {};
  const autoUpdaterMock = {
    autoDownload: true, // will be flipped to false by configure()
    autoInstallOnAppQuit: true, // will be flipped to false by configure()
    logger: null as unknown,
    on: (event: string, cb: (arg: unknown) => void) => { handlers[event] = cb; },
    checkForUpdates: vi.fn(async () => {}),
    downloadUpdate: vi.fn(async () => {}),
    quitAndInstall: vi.fn(),
  };
  return { autoUpdaterMock, handlers };
});

vi.mock("electron-updater", () => ({ autoUpdater: autoUpdaterMock }));
vi.mock("electron", () => ({
  app: { getVersion: () => "1.0.4" },
  BrowserWindow: { getAllWindows: () => [] },
}));
vi.mock("electron-log", () => ({
  default: {
    info: () => {},
    warn: () => {},
    error: () => {},
    transports: { file: { level: "info" } },
  },
}));

import { UpdateService } from "../electron/updates/UpdateService";

const emitAvailable = (version: string) =>
  handlers["update-available"]?.({ version });

describe("UpdateService hard-gate", () => {
  let svc: UpdateService;

  beforeEach(() => {
    autoUpdaterMock.downloadUpdate.mockClear();
    autoUpdaterMock.checkForUpdates.mockClear();
    svc = new UpdateService("test");
  });

  it("never auto-downloads or auto-installs", () => {
    expect(autoUpdaterMock.autoDownload).toBe(false);
    expect(autoUpdaterMock.autoInstallOnAppQuit).toBe(false);
  });

  it("downloads when the channel version equals the promoted version", async () => {
    await svc.checkGated("1.0.5");
    emitAvailable("1.0.5");
    expect(autoUpdaterMock.downloadUpdate).toHaveBeenCalledTimes(1);
  });

  it("does NOT download when the channel version differs from promoted", async () => {
    await svc.checkGated("1.0.5");
    emitAvailable("1.0.6"); // a newer, not-yet-promoted release
    expect(autoUpdaterMock.downloadUpdate).not.toHaveBeenCalled();
  });

  it("does NOT check or download when nothing is promoted", async () => {
    await svc.checkGated(null);
    expect(autoUpdaterMock.checkForUpdates).not.toHaveBeenCalled();
    emitAvailable("1.0.5");
    expect(autoUpdaterMock.downloadUpdate).not.toHaveBeenCalled();
  });

  it("plain check() reports availability but never downloads", async () => {
    await svc.check();
    emitAvailable("1.0.5");
    expect(autoUpdaterMock.downloadUpdate).not.toHaveBeenCalled();
  });

  it("a gated download does not leak into a subsequent plain check", async () => {
    await svc.checkGated("1.0.5");
    emitAvailable("1.0.5");
    expect(autoUpdaterMock.downloadUpdate).toHaveBeenCalledTimes(1);
    // Plain check clears the gate — a later available event must not download.
    await svc.check();
    emitAvailable("1.0.5");
    expect(autoUpdaterMock.downloadUpdate).toHaveBeenCalledTimes(1);
  });
});
