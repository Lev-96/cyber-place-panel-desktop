import { defineConfig } from "@playwright/test";

/**
 * The Electron runtime, separately from the browser suite.
 *
 * `playwright.config.ts` serves the built bundle over `vite preview` and drives
 * Chromium. That proves the application code; it cannot prove the SHELL — the
 * `app://` protocol, the preload bridge, the CSP in `index.html`, and the fact
 * that a dialog is an in-app React modal rather than a native `confirm()` that
 * blocks the renderer. Those only exist in Electron.
 *
 * No `webServer` here: the main process loads `app://localhost/index.html` from
 * `dist/web` when it is unpackaged and `ELECTRON_DEV_URL` is unset, so the only
 * prerequisite is `npm run build`.
 *
 * Needs a display. `npm run test:electron` wraps it in `xvfb-run`.
 */
export default defineConfig({
  testDir: "./e2e-electron",
  timeout: 60_000,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: { trace: "off" },
});
