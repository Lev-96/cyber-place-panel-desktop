import { defineConfig, devices } from "@playwright/test";

/**
 * E2E suite is split out from the unit suite (`vitest`) by separate
 * directory + config. We run against the production-built bundle served
 * by `vite preview`, not the dev server — that way the test exercises
 * the same artefact users get, including the CSP meta tag and the
 * minified bundle.
 *
 * Backend traffic is intercepted per-test via `page.route()` so the
 * suite is deterministic and can be run offline.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: false, // keep ordering predictable for the small suite
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:5174",
    trace: "off",
    headless: true,
    viewport: { width: 1280, height: 800 },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], channel: undefined },
    },
  ],
  webServer: {
    // Build is already produced by `npm run build` in CI (verify-all.sh).
    // We just spin up `vite preview` here against the existing dist.
    command: "npx vite preview --port 5174 --strictPort --outDir dist/web",
    url: "http://localhost:5174",
    reuseExistingServer: false,
    stdout: "ignore",
    stderr: "pipe",
    timeout: 30_000,
  },
});
