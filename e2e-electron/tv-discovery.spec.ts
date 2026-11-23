import { _electron as electron, expect, test, type ElectronApplication, type Page } from "@playwright/test";
import { createSocket, type Socket } from "node:dgram";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { platformBillingOverview } from "../e2e/helpers/mockBackend";

/**
 * Club TVs found on the network, in the real Electron app (2026-11-23): the
 * main process's `tv:discover` and the `cyberplaceTV` bridge against a fake
 * waiting TV on UDP 47231 on this machine. The TV app is not offered in the
 * panel (TV_SCREENS off, owner: only PSN), so the dialog must not search.
 */
const isBackend = (url: URL): boolean => url.protocol.startsWith("http");

let app: ElectronApplication;
let page: Page;
let userDataDir: string;
let tv: Socket | null = null;
let asked = 0;
/** What the fake TV says it runs; the app under test is the production bundle. */
let tvEnv = "production";
const posted: unknown[] = [];

const startFakeTv = async (): Promise<void> => {
  const s = createSocket({ type: "udp4", reuseAddr: true });
  tv = s;
  s.on("message", (msg, rinfo) => {
    if (msg.length < 256 || !msg.toString("ascii").startsWith("CPTV-DISCOVER 1")) return;
    asked++;
    s.send(JSON.stringify({ app: "cyberplace-tv", v: 1, env: tvEnv, code: "654321", maker: "Sony", model: "BRAVIA 4K" }), rinfo.port, rinfo.address);
  });
  await new Promise<void>((res) => s.bind(47231, "0.0.0.0", () => res()));
};

test.beforeEach(async () => {
  asked = 0;
  tvEnv = "production";
  posted.length = 0;
  await startFakeTv();
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "cp-panel-e2e-"));
  fs.writeFileSync(path.join(userDataDir, "cyberplace.kv.json"), JSON.stringify({
    "cp.lang": JSON.stringify("en"), "cp.lang.chosen": JSON.stringify(true), "u1:cp.lang": JSON.stringify("en"),
  }));
  app = await electron.launch({
    args: [path.join(__dirname, ".."), `--user-data-dir=${userDataDir}`],
    env: { ...process.env, ELECTRON_DEV_URL: "", ELECTRON_DEVTOOLS: "" },
  });
  page = await app.firstWindow();
  const user = { id: 1, name: "Owner One", email: "o@o", role: "company_owner" };
  const screens: unknown[] = [];
  await page.route((url) => isBackend(url), async (route) => {
    const p = new URL(route.request().url()).pathname;
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (p === "/user/me") return json({ user: { ...user, dashboard: { branch_id: null, company_id: 1 } } });
    if (p === "/session/login") return json({ login: user, token: "t", messages: "ok" });
    if (/^\/company\/\d+\/platform-billing$/.test(p)) return json(platformBillingOverview(1));
    if (p === "/places") {
      return json({ data: [{ id: 7, branch_id: 1, number: 7, name: null, platform: "ps5", type: "standard", status: "active" }], meta: { total: 1 } });
    }
    if (p === "/branches/1/tv-screens") {
      if (route.request().method() === "POST") {
        const body = route.request().postDataJSON();
        posted.push(body);
        const made = { id: 3, branch_id: 1, place_id: body.place_id, place_name: null, place_number: 7, name: body.name, paired_at: new Date().toISOString(), last_seen_at: null, online: false };
        screens.push(made);
        return json({ data: made }, 201);
      }
      return json({ data: screens });
    }
    return json({ data: [], meta: { total: 0 } });
  });
  await page.reload();
});

test.afterEach(async () => {
  await app?.close();
  tv?.close();
  tv = null;
  if (userDataDir) fs.rmSync(userDataDir, { recursive: true, force: true });
});

test("the TV bridge exists next to the others and answers with what it found", async () => {
  const found = await page.evaluate(async () => {
    const w = window as never as { cyberplaceTV?: { discover: (ms: number) => Promise<unknown> }; cyberplacePS5?: unknown };
    return { tv: typeof w.cyberplaceTV, ps5: typeof w.cyberplacePS5, result: await w.cyberplaceTV?.discover(800) };
  });
  expect(found.tv).toBe("object");
  expect(found.ps5).toBe("object");
  expect(found.result).toEqual([expect.objectContaining({ code: "654321", maker: "Sony", model: "BRAVIA 4K", env: "production" })]);
});

test("with TVs off (owner: only PSN) the dialog never searches the network", async () => {
  await page.getByPlaceholder("your@email.com").fill("o@o");
  await page.getByPlaceholder(/•/).fill("ok");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Owner One").first()).toBeVisible();
  await page.evaluate(() => { window.location.hash = "#/branches/1/places"; });
  await page.getByTestId("tv-open").click();
  await expect(page.getByRole("heading", { name: "Player messages", exact: true })).toBeVisible();
  await page.waitForTimeout(800);
  await expect(page.getByTestId("tv-network")).toHaveCount(0);
  expect(asked).toBe(0);
});
