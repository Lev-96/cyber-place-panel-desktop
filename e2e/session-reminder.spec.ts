import { expect, test, type Page } from "@playwright/test";
import { LANGS, WIDTHS, at, fitsWidth, json, noRawKeys, openBoard, runningSession, seedBoard, shot, signIn, type Lang } from "./helpers/moneySession";

/**
 * E (2026-11-15): the player's reminder. Shapes as in SessionReminderTest:
 * `PUT /sessions/{id}/reminder {minutes, note}` → the session with
 * `reminder {at, set_at, minutes, note, set_by_user_id, fired_at}`; the
 * notification `session.reminder` (`SessionReminderDue::toArray`) → the card
 * «Место №3 (Арам): игрок просил напомнить, прошло 2 ч» with «Понятно / Ещё
 * 30 мин / Открыть место»; «Понятно» = read + `DELETE …/reminder`.
 */
const AT = new Date(Date.now() + 2 * 3600_000).toISOString();
const reminder = (fired: string | null = null) => ({ at: AT, set_at: new Date().toISOString(), minutes: 120, note: "Арам", set_by_user_id: 1, fired_at: fired });
const notification = {
  id: "r-5", type: "Место №3 (Арам): игрок просил напомнить", read_at: null, created_at: new Date().toISOString(),
  data: {
    type: "session.reminder", session_id: 5, branch_id: 1, company_id: 1, pc_id: 3, place_id: 13, place_number: 3,
    player_name: "Арам", note: "позвонить маме", minutes: 120, set_at: new Date(Date.now() - 2 * 3600_000).toISOString(),
    remind_at: new Date().toISOString(), set_by_user_id: 1, set_by_name: "Owner One", company_name: "Club", branch_address: "Abovyan 1",
  },
};
const SET: Record<Lang, string> = { en: "Remind in 2 h", ru: "Напомнить через 2 ч", am: "Հիշեցնել 2 ժ հետո" };
const CARD: Record<Lang, RegExp> = {
  en: /Seat №3 \(Арам\): the player asked to be reminded, 2 h have passed/,
  ru: /Место №3 \(Арам\): игрок просил напомнить, прошло 2 ч/,
  am: /Տեղ №3 \(Арам\)՝ խաղացողը խնդրել էր հիշեցնել, անցել է 2 ժ/,
};
const OK: Record<Lang, string> = { en: "Got it", ru: "Понятно", am: "Հասկանալի է" };

const open = async (page: Page, lang: Lang, width: number, withNotice: boolean) => {
  let current = runningSession();
  const calls: { put: unknown[]; del: number; read: string[] } = { put: [], del: 0, read: [] };
  await signIn(page, lang, width, "company_owner", async () => {
    await page.route(at("/notifications"), (r) => r.fulfill(json({
      data: withNotice ? [notification] : [], meta: { current_page: 1, last_page: 1, per_page: 50, total: withNotice ? 1 : 0, unread_count: withNotice ? 1 : 0 },
    })));
    await page.route(at("/notifications/unread-count"), (r) => r.fulfill(json({ unread_count: withNotice ? 1 : 0 })));
    await page.route((u) => u.hostname !== "localhost" && /^\/notifications\/.+\/read$/.test(u.pathname), (r) => {
      calls.read.push(r.request().url());
      return r.fulfill(json({ id: "r-5", read_at: new Date().toISOString() }));
    });
  });
  await seedBoard(page, { session: () => current });
  await page.route(at("/sessions/5/reminder"), (r) => {
    if (r.request().method() === "PUT") {
      calls.put.push(r.request().postDataJSON());
      current = runningSession({ reminder: reminder() });
    } else {
      calls.del += 1;
      current = runningSession({ reminder: null });
    }
    return r.fulfill(json({ session: current }));
  });
  await openBoard(page);
  return calls;
};

for (const lang of LANGS) {
  for (const width of WIDTHS) {
    test(`set a reminder in «+ Время»: 2 h with a name; the card shows 🔔 (${lang}, ${width})`, async ({ page }) => {
      const calls = await open(page, lang, width, false);
      await page.locator('[data-action="add-time"]').first().click();
      const section = page.getByTestId("reminder-section");
      await section.scrollIntoViewIfNeeded();
      await page.getByTestId("reminder-duration-hours").fill("2");
      await page.getByTestId("reminder-note").fill("Арам");
      await expect(page.getByTestId("reminder-set")).toHaveText(SET[lang]);
      await noRawKeys(page, "[role=dialog]");
      await fitsWidth(page, "[data-testid=reminder-section]");
      await shot(page, `reminder-set-${lang}-${width}`);
      await page.getByTestId("reminder-set").click();
      await expect.poll(() => calls.put).toEqual([{ minutes: 120, note: "Арам" }]);
      await expect(page.getByTestId("reminder-pending")).toContainText("Арам");
      await shot(page, `reminder-pending-${lang}-${width}`);
      await page.keyboard.press("Escape");
      await expect(page.getByTestId("card-reminder-chip")).toContainText("🔔");
      await shot(page, `reminder-chip-${lang}-${width}`, page.locator(".place-cell").first());
    });

    test(`the reminder rang: the card, the bell's buttons, «Понятно» clears it (${lang}, ${width})`, async ({ page }) => {
      const calls = await open(page, lang, width, true);
      const card = page.getByTestId("reminder-stack").getByRole("alert");
      await expect(card).toBeVisible();
      await expect(card).toContainText(CARD[lang]);
      await expect(card).toContainText("позвонить маме");
      await noRawKeys(page, "[data-testid=reminder-stack]");
      await fitsWidth(page, "[data-testid=reminder-stack]");
      await shot(page, `reminder-card-${lang}-${width}`);
      await card.getByRole("button", { name: OK[lang], exact: true }).click();
      await expect.poll(() => calls.del).toBe(1);
      await expect.poll(() => calls.read.length).toBe(1);
      await expect(page.getByTestId("reminder-stack")).toHaveCount(0);
    });
  }
}

test("the Notifications page reads session.reminder in words (ru, 1280)", async ({ page }) => {
  await open(page, "ru", 1280, true);
  await page.goto("/#/notifications");
  await expect(page.locator("main").getByText(CARD.ru).first()).toBeVisible();
  await noRawKeys(page, "main");
  await shot(page, "reminder-notifications-ru-1280");
});
