import { expect, test, type Page, type Route } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { LANGS, WIDTHS, at, json, signIn, type Lang } from "./helpers/moneySession";

/**
 * «Обновления агента» per branch (2026-11-17), in a real browser, in en/ru/am,
 * at a desk (1280) and the desktop's smallest window (520):
 *
 *  - the side menu's badge is the server's `pending_branch_count`;
 *  - the toast names the pending branch, and closing it is kept per person;
 *  - one card per branch the Agent concerns: address, approved version, how
 *    many computers are left of how many, «Применить в этом филиале»;
 *  - a branch without a connected computer shows nothing about the Agent;
 *  - the apply sends that branch, and the badge clears at once (the status is
 *    re-read right after the apply, not on the 60-second poll);
 *  - with no such branch at all: the empty state and no Agent block.
 *
 * Fixtures mirror the backend's `tests/Feature/AgentRolloutTest.php`.
 */

const SHOTS = path.join(os.homedir(), "cyber-place-local/reports/updates-private-repos-2026-11-17/panel");
const shot = async (page: Page, name: string) => {
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true });
};

const A = { branch_id: 11, address: "Abovyan 1" };
const B = { branch_id: 12, address: "Komitas 5" };

/** `GET /agent-updates/status` as AgentUpdateStatusResource answers it. */
const status = (pending: boolean, relevantA = true) => ({
  data: {
    current: { version: "1.0.27", mandatory: false, notes: null, github_tag: "v1.0.27", published_at: null, promoted_at: null },
    available: null,
    has_update: pending,
    error: null,
    approved: { version: "1.0.27", github_tag: "v1.0.27", mandatory: false },
    venue_pc_count: relevantA ? 3 : 0,
    applied_version: pending ? null : "1.0.27",
    branches: [
      relevantA
        ? { ...A, agent_relevant: true, agent: { pc_count: 3, pending_pc_count: pending ? 2 : 0, pending } }
        : { ...A, agent_relevant: false, agent: null },
      { ...B, agent_relevant: false, agent: null },
    ],
    pending_branch_count: pending ? 1 : 0,
  },
});

const TEXT: Record<Lang, { pending: string; done: string; apply: string; toast: string; empty: string }> = {
  en: {
    pending: "Computers to update: 2 of 3",
    done: "All computers have received the update.",
    apply: "Apply in this branch",
    toast: "The kiosk Agent update is waiting in: Abovyan 1",
    empty: "No connected computers",
  },
  ru: {
    pending: "Нужно обновить компьютеров: 2 из 3",
    done: "Все компьютеры получили обновление.",
    apply: "Применить в этом филиале",
    toast: "Обновление агента ждёт применения: Abovyan 1",
    empty: "Нет подключённых компьютеров",
  },
  am: {
    pending: "Պետք է թարմացնել 2 համակարգիչ՝ 3-ից",
    done: "Բոլոր համակարգիչները ստացել են թարմացումը։",
    apply: "Կիրառել այս մասնաճյուղում",
    toast: "Agent-ի թարմացումը սպասում է կիրառման՝ Abovyan 1",
    empty: "Միացված համակարգիչներ չկան",
  },
};
const CLOSE: Record<Lang, string> = { en: "Close", ru: "Закрыть", am: "Փակել" };

const agentBadge = (page: Page) => page.locator('a[href="#/settings/agent-updates"] .unread-badge');

/** Nothing on the screen prints a raw dictionary key or an em dash, and nothing pushes past the window. */
const clean = async (page: Page) => {
  const text = await page.locator("main").first().innerText();
  expect(text).not.toMatch(/\b(agentUpdates|updates|state)\.[a-z][A-Za-z_.]+/);
  expect(text).not.toContain("—");
  const overflow = await page.evaluate(() => {
    const main = document.querySelector("main.main") as HTMLElement | null;
    return { doc: document.documentElement.scrollWidth - window.innerWidth, main: main ? main.scrollWidth - main.clientWidth : 0 };
  });
  expect(overflow.doc, "the page scrolls sideways").toBeLessThanOrEqual(1);
  expect(overflow.main, "the screen scrolls sideways").toBeLessThanOrEqual(1);
};

for (const lang of LANGS) {
  for (const width of WIDTHS) {
    test(`a branch to update: badge, toast, card, apply, badge gone at once (${lang}, ${width})`, async ({ page }) => {
      let pending = true;
      let body: unknown = null;
      await signIn(page, lang, width, "company_owner", async () => {
        await page.route(at("/agent-updates/status"), (r: Route) => r.fulfill(json(status(pending))));
        await page.route(at("/agent-updates/promote"), (r: Route) => {
          body = r.request().postDataJSON();
          pending = false;
          return r.fulfill(json({ data: null, applied_pc_count: 3, version: "1.0.27", applied_branch_ids: [A.branch_id] }));
        });
      });

      // The server's count, as sent.
      await expect(agentBadge(page)).toHaveText("1");

      // The toast says where, and closing it is this person's.
      const toast = page.locator(".cp-update-toast");
      await expect(toast).toContainText(TEXT[lang].toast);
      await expect(toast).not.toContainText(B.address);
      await toast.getByRole("button", { name: CLOSE[lang], exact: true }).click();
      await expect(toast).toHaveCount(0);
      expect(await page.evaluate(() => localStorage.getItem("u1:cp.update-toast-dismissed-agent-1.0.27-b11"))).toBe("1");
      expect(await page.evaluate(() => localStorage.getItem("cp.update-toast-dismissed-agent-1.0.27"))).toBeNull();

      await page.goto("/#/settings/agent-updates");
      const cardA = page.getByTestId(`agent-branch-${A.branch_id}`);
      await expect(cardA).toBeVisible();
      await expect(cardA).toContainText(A.address);
      await expect(cardA).toContainText("1.0.27");
      await expect(cardA).toContainText(TEXT[lang].pending);
      // B has no connected computer: nothing about the Agent there.
      await expect(page.getByTestId(`agent-branch-${B.branch_id}`)).toHaveCount(0);
      await expect(page.getByText(B.address)).toHaveCount(0);
      await expect(page.getByRole("button", { name: TEXT[lang].apply })).toHaveCount(1);
      await clean(page);
      await shot(page, `agent-branches-pending-${lang}-${width}`);

      await cardA.getByRole("button", { name: TEXT[lang].apply }).click();

      await expect.poll(() => body).toEqual({ branch_id: A.branch_id });
      await expect(cardA).toContainText(TEXT[lang].done);
      await expect(cardA.getByRole("button", { name: TEXT[lang].apply })).toHaveCount(0);
      // Well inside the 60-second poll: only the re-read after the apply clears it.
      await expect(agentBadge(page)).toHaveCount(0, { timeout: 5_000 });
      await clean(page);
      await shot(page, `agent-branches-applied-${lang}-${width}`);
    });

    test(`no branch with a connected computer: no Agent block at all (${lang}, ${width})`, async ({ page }) => {
      await signIn(page, lang, width, "company_owner", async () => {
        await page.route(at("/agent-updates/status"), (r: Route) => r.fulfill(json(status(false, false))));
      });

      await expect(agentBadge(page)).toHaveCount(0);
      await expect(page.locator(".cp-update-toast")).toHaveCount(0);

      await page.goto("/#/settings/agent-updates");
      await expect(page.getByText(TEXT[lang].empty)).toBeVisible();
      await expect(page.locator("[data-testid^=agent-branch-]")).toHaveCount(0);
      await expect(page.getByText("1.0.27")).toHaveCount(0);
      await expect(page.getByRole("button", { name: TEXT[lang].apply })).toHaveCount(0);
      await clean(page);
      await shot(page, `agent-branches-none-${lang}-${width}`);
    });
  }
}
