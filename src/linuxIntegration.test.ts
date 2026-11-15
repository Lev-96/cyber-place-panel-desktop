import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("electron-log", () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import {
  LINUX_DESKTOP_ID,
  desktopEntryBody,
  ensureLinuxDesktopIntegration,
  windowIconOptions,
} from "../electron/linuxIntegration";

/**
 * Linux AppImage icon (2026-11-15): the taskbar showed a generic icon because
 * the window had no _NET_WM_ICON and the .desktop entry's StartupWMClass was
 * the display name, not the WM_CLASS Electron sets from the app name.
 */

// What Electron derives WM_CLASS from: package.json `productName ?? name`.
const pkg = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf8")) as {
  name: string;
  productName?: string;
  desktopName?: string;
};
const ELECTRON_APP_NAME = pkg.productName ?? pkg.name;

const config = {
  appId: LINUX_DESKTOP_ID,
  displayName: "Cyberplace Panel",
  comment: "c",
  iconSourcePath: "/nowhere/icon.png",
  wmClass: ELECTRON_APP_NAME,
};

const field = (body: string, key: string) =>
  body.split("\n").find((l) => l.startsWith(`${key}=`))?.slice(key.length + 1);

describe("desktopEntryBody", () => {
  test("StartupWMClass is the WM_CLASS source, never the display name", () => {
    const body = desktopEntryBody(config, "/apps/Panel.AppImage");
    expect(field(body, "StartupWMClass")).toBe(ELECTRON_APP_NAME);
    expect(field(body, "StartupWMClass")).not.toBe(config.displayName);
    expect(field(body, "Name")).toBe("Cyberplace Panel");
    expect(field(body, "Icon")).toBe(LINUX_DESKTOP_ID);
    expect(field(body, "Exec")).toBe('"/apps/Panel.AppImage" %U');
  });

  test("the observed 1.0.61 WM_CLASS is what the entry now names", () => {
    // xprop on the published AppImage: WM_CLASS = "cyber-place-panel-desktop", "cyber-place-panel-desktop".
    expect(field(desktopEntryBody(config, "/a"), "StartupWMClass")).toBe("cyber-place-panel-desktop");
  });
});

describe("package.json desktopName", () => {
  test("names the .desktop file the integration writes (Wayland app_id, notifications)", () => {
    expect(pkg.desktopName).toBe(`${LINUX_DESKTOP_ID}.desktop`);
  });
});

describe("ensureLinuxDesktopIntegration", () => {
  const saved = { home: process.env.HOME, appimage: process.env.APPIMAGE };
  let dir = "";
  afterEach(() => {
    process.env.HOME = saved.home;
    if (saved.appimage === undefined) delete process.env.APPIMAGE;
    else process.env.APPIMAGE = saved.appimage;
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  test.runIf(process.platform === "linux")("writes the entry with StartupWMClass = wmClass", () => {
    dir = mkdtempSync(join(tmpdir(), "cp-linux-int-"));
    const appImage = join(dir, "Panel.AppImage");
    writeFileSync(appImage, "");
    process.env.HOME = dir;
    process.env.APPIMAGE = appImage;

    ensureLinuxDesktopIntegration(config);

    const written = readFileSync(join(dir, ".local/share/applications", `${LINUX_DESKTOP_ID}.desktop`), "utf8");
    expect(field(written, "StartupWMClass")).toBe(ELECTRON_APP_NAME);
  });
});

describe("windowIconOptions", () => {
  const present = () => true;
  const absent = () => false;

  test("Linux with the bundled icon present: the window gets it", () => {
    expect(windowIconOptions("linux", "/r/build/icon.png", present)).toEqual({ icon: "/r/build/icon.png" });
  });

  test("Windows and macOS are untouched (icon comes from the exe / bundle)", () => {
    expect(windowIconOptions("win32", "/r/build/icon.png", present)).toEqual({});
    expect(windowIconOptions("darwin", "/r/build/icon.png", present)).toEqual({});
  });

  test("a missing icon file (unpackaged run) sets nothing and does not throw", () => {
    expect(windowIconOptions("linux", "/nowhere/icon.png", absent)).toEqual({});
  });
});
