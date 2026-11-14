/**
 * Where the panel is running, and which build it is (2026-11-14).
 *
 * The desktop app is this bundle inside the Electron shell. The shell's
 * preload exposes `window.desktopAPI` (the key-value store and Wake-on-LAN);
 * nothing else in a browser does, so its presence is the test: the same one
 * `KeyValueStore` uses to choose the file-backed store over `localStorage`.
 *
 * The owner web serves these same components in a browser: no bridge there,
 * and its own build defines `__APP_VERSION__` from ITS package.json (0.1.0),
 * so that value must never be shown as the panel's version.
 */

/** True inside the Electron desktop app. */
export const isDesktopApp = (): boolean =>
  typeof window !== "undefined" && window.desktopAPI !== undefined;

/**
 * The version this bundle was built as: `vite.config.ts` injects package.json's
 * `version`, the same file electron-builder stamps into `app.getVersion()` and
 * CI matches against the release tag. Null where nothing was injected (tests).
 */
export const buildVersion = (): string | null =>
  typeof __APP_VERSION__ === "string" && __APP_VERSION__ !== "" ? __APP_VERSION__ : null;

/** The desktop app's version, or null anywhere else (the owner web, a browser tab). */
export const desktopAppVersion = (): string | null => (isDesktopApp() ? buildVersion() : null);
