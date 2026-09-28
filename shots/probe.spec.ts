import { test } from "@playwright/test";
import { logIn, settle, signedIn } from "./harness";

/** Not a capture: learns which endpoints each screen reads. */
const ROUTES = [
  "/", "/branches", "/branches-map", "/branches/1", "/branches/1/live",
  "/branches/1/places", "/branches/1/sessions", "/branches/1/sessions/history",
  "/branches/1/pcs", "/branches/1/tariffs", "/branches/1/products",
  "/branches/1/members", "/branches/1/managers", "/branches/1/tournaments",
  "/bookings", "/bookings/1", "/tournaments", "/notifications", "/support",
  "/managers", "/owners", "/games", "/expenses", "/metrics", "/revenue",
  "/my-company", "/settings", "/settings/agent-updates",
];

test("probe: which endpoints each screen reads", async ({ page }) => {
  const seen = new Map<string, Set<string>>();
  let current = "/";

  page.on("request", (r) => {
    const u = new URL(r.url());
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") return;
    if (!seen.has(current)) seen.set(current, new Set());
    seen.get(current)!.add(`${r.method()} ${u.pathname}${u.search ? "?" + u.searchParams.toString().slice(0, 60) : ""}`);
  });

  await signedIn(page, "company_owner", "Արամ Հովհաննիսյան");
  await logIn(page);

  for (const route of ROUTES) {
    current = route;
    await page.goto(`/#${route}`);
    await settle(page, 500);
  }

  for (const [route, paths] of seen) {
    console.log(`ROUTE ${route} :: ${[...paths].join(" | ")}`);
  }
});
