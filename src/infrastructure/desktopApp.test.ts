import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { buildVersion, desktopAppVersion, isDesktopApp } from "./desktopApp";

/**
 * Where the panel runs (2026-11-14). The desktop app is the bundle inside the
 * Electron shell, recognised by the preload's `desktopAPI` bridge, the same
 * test `KeyValueStore` picks its store by. The owner web serves the same
 * components in a browser, with no bridge and its OWN package version, so the
 * build version is the desktop app's only where that bridge is present.
 */

const PKG_VERSION = (JSON.parse(readFileSync(path.resolve(__dirname, "../../package.json"), "utf8")) as { version: string }).version;

afterEach(() => {
  vi.unstubAllGlobals();
});

const bridge = () => ({ get: async () => null, set: async () => {}, remove: async () => {}, wakeOnLan: async () => ({ ok: true, mac: "", sent: 0, errors: [], message: "" }) });

describe("isDesktopApp", () => {
  test("false in a browser: no window at all, or a window without the bridge", () => {
    expect(isDesktopApp()).toBe(false);
    vi.stubGlobal("window", {});
    expect(isDesktopApp()).toBe(false);
  });

  test("true under the Electron preload", () => {
    vi.stubGlobal("window", { desktopAPI: bridge() });
    expect(isDesktopApp()).toBe(true);
  });
});

describe("buildVersion", () => {
  test("null when the bundler injected none (tests, a misconfigured build)", () => {
    expect(buildVersion()).toBeNull();
  });

  test("the injected package.json version", () => {
    vi.stubGlobal("__APP_VERSION__", PKG_VERSION);
    expect(buildVersion()).toBe(PKG_VERSION);
  });
});

describe("desktopAppVersion", () => {
  test("the version inside the desktop app", () => {
    vi.stubGlobal("__APP_VERSION__", PKG_VERSION);
    vi.stubGlobal("window", { desktopAPI: bridge() });
    expect(desktopAppVersion()).toBe(PKG_VERSION);
  });

  test("null on the web, even though the web build injects a version of its own", () => {
    vi.stubGlobal("__APP_VERSION__", "0.1.0");
    vi.stubGlobal("window", {});
    expect(desktopAppVersion()).toBeNull();
  });

  test("null in the desktop app when no version was injected", () => {
    vi.stubGlobal("window", { desktopAPI: bridge() });
    expect(desktopAppVersion()).toBeNull();
  });
});

test("vite injects package.json's version, the one electron-builder stamps into app.getVersion()", () => {
  const config = readFileSync(path.resolve(__dirname, "../../vite.config.ts"), "utf8");
  expect(config).toMatch(/__APP_VERSION__:\s*JSON\.stringify\(pkg\.version\)/);
  expect(config).toMatch(/resolve\(__dirname,\s*"package\.json"\)/);
});
