import { _electron as electron, expect, test, type ElectronApplication, type Page } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { platformBillingOverview } from "../e2e/helpers/mockBackend";

/**
 * An update restarts the app; the manager must come back signed in
 * (2026-11-20, owner: «после поступления новых обновлений менеджеру не должен
 * выкидывать из сессии логина»).
 *
 * In the real Electron main process, on a THROWAWAY profile seeded the way the
 * app writes it (`cyberplace.kv.json`, values JSON-encoded):
 *
 *  1. signed in from the saved token; the window is resized (so the close
 *     writes `window.state`, the write the updater's quit used to race), then
 *     the app quits the way `quitAndInstall` quits it (`app.quit()`);
 *  2. the file is whole, still holds the sign-in and the language, and no
 *     `.tmp` is left behind;
 *  3. the next start meets a backend answering 404 for `/user/me` (an edge or a
 *     backend mid-deploy) — the saved sign-in is kept, not dropped.
 *
 * What it cannot show: Windows' NSIS installer closing the app, which only an
 * update installed on a Windows machine proves.
 */

const isBackend = (url: URL): boolean => url.protocol.startsWith("http");
const user = { id: 1, name: "Manager Ani", email: "m@m", role: "manager" };
const dashboard = { branch_id: 1, company_id: 1 };

let userDataDir = "";
const kvFile = () => path.join(userDataDir, "cyberplace.kv.json");

const launch = async (meStatus: number): Promise<{ app: ElectronApplication; page: Page }> => {
  const app = await electron.launch({
    args: [path.join(__dirname, ".."), `--user-data-dir=${userDataDir}`],
    env: { ...process.env, ELECTRON_DEV_URL: "", ELECTRON_DEVTOOLS: "" },
  });
  const page = await app.firstWindow();
  await page.route((url) => isBackend(url), async (route) => {
    const p = new URL(route.request().url()).pathname;
    if (p === "/user/me") {
      return meStatus === 200
        ? route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ user: { ...user, dashboard } }) })
        : route.fulfill({ status: meStatus, contentType: "text/html", body: "Not Found" });
    }
    if (/^\/company\/\d+\/platform-billing$/.test(p)) {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(platformBillingOverview(1)) });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [], meta: { total: 0, unread_count: 0 } }) });
  });
  // The routes above must answer the start-up read: start it again under them.
  await page.reload();
  return { app, page };
};

test.beforeEach(() => {
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "cp-panel-restart-"));
  fs.writeFileSync(kvFile(), JSON.stringify({
    "cp.token": JSON.stringify("1|saved-token"),
    "cp.user": JSON.stringify(user),
    "cp.lang": JSON.stringify("en"),
    "cp.lang.chosen": JSON.stringify(true),
    "u1:cp.lang": JSON.stringify("en"),
  }));
});

test.afterEach(() => {
  if (userDataDir) fs.rmSync(userDataDir, { recursive: true, force: true });
});

test("the sign-in and settings survive the update's restart, and a 404 at start does not sign out", async () => {
  const first = await launch(200);
  await expect(first.page.getByText("Manager Ani").first()).toBeVisible();
  // A resize: the close then writes `window.state`.
  await first.app.evaluate(({ BrowserWindow }) => { BrowserWindow.getAllWindows()[0]?.setSize(900, 700); });
  await first.page.waitForTimeout(800);
  // The way electron-updater's quitAndInstall ends the process.
  await first.app.evaluate(({ app }) => { setImmediate(() => app.quit()); });
  await first.app.waitForEvent("close");

  const saved = JSON.parse(fs.readFileSync(kvFile(), "utf8")) as Record<string, string>;
  expect(saved["cp.token"]).toBe(JSON.stringify("1|saved-token"));
  expect(saved["cp.lang"]).toBe(JSON.stringify("en"));
  expect(saved["window.state"]).toBeTruthy();
  expect(fs.existsSync(`${kvFile()}.tmp`)).toBe(false);

  const second = await launch(404);
  await expect(second.page.getByText("Manager Ani").first()).toBeVisible();
  await expect(second.page.getByPlaceholder("your@email.com")).toHaveCount(0);
  await second.app.close();
  const after = JSON.parse(fs.readFileSync(kvFile(), "utf8")) as Record<string, string>;
  expect(after["cp.token"]).toBe(JSON.stringify("1|saved-token"));
});
