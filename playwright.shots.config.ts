import { defineConfig, devices } from "@playwright/test";

/**
 * Marketing screenshots, not tests.
 *
 * Same machinery as the e2e suite — the real built bundle, real router, real
 * CSS, backend traffic intercepted — but pointed at capturing PNGs instead of
 * asserting. Kept in its own config and directory so `npm run test:*` never
 * runs it and a failed capture never reads as a failed test.
 *
 * ## Why the viewport is what it is
 *
 * 1920×1200 at `deviceScaleFactor: 2` gives 3840×2400 PNGs. A video timeline
 * zooms into these, and a screenshot captured at 1× goes soft the moment a
 * callout pushes past 100%. The panel's own layout is built for 1280→2560, so
 * 1920 is a width it is designed to look right at rather than a stretch.
 */
export default defineConfig({
  testDir: "./shots",
  timeout: 60_000,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  outputDir: "shots/.artifacts",
  use: {
    baseURL: "http://localhost:5174",
    trace: "off",
    headless: true,
    viewport: { width: 1920, height: 1200 },
    deviceScaleFactor: 2,
  },
  projects: [
    {
      name: "panel",
      use: {
        ...devices["Desktop Chrome"],
        channel: undefined,
        // AFTER the device preset on purpose: `devices["Desktop Chrome"]`
        // carries its own 1280×720 at 1×, and a project's `use` wins over the
        // top-level one — which is how the first capture came out at 720p.
        viewport: { width: 1920, height: 1200 },
        deviceScaleFactor: 2,
      },
    },
  ],
  webServer: {
    command: "npx vite preview --port 5174 --strictPort --outDir dist/web",
    url: "http://localhost:5174",
    reuseExistingServer: true,
    stdout: "ignore",
    stderr: "pipe",
    timeout: 60_000,
  },
});
