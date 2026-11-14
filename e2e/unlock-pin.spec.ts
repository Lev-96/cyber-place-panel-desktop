import { expect, test, type Page } from "@playwright/test";
import { installBackendMocks, seedLanguageChosen } from "./helpers/mockBackend";

/**
 * N1 (regression 2026-11-14): the emergency-PIN card said «PIN ещё не
 * установлен» while a PIN was set. `GET /branches/{id}` now carries
 * `unlock_pin_updated_at`; and with no date but a PIN from `/unlock-pin`, the
 * card says the PIN is set. `PIN_SHOTS=<dir>` also writes screenshots.
 */
const isBackend = (url: URL): boolean => url.hostname !== "localhost" && url.hostname !== "127.0.0.1";
const json = (body: unknown) => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
const SHOTS = process.env.PIN_SHOTS;

const openEdit = async (page: Page, updatedAt: string | null, pin: string | null) => {
  await seedLanguageChosen(page, "ru");
  await installBackendMocks(page, { role: "company_owner", company_id: 1, name: "Owner One" });
  await page.route((u) => isBackend(u) && u.pathname === "/branches/1", (r) => r.fulfill(json({ branch: {
    id: 1, company_id: 1, city: "Yerevan", country: "AM", address: "Abovyan 5", phone: "+37410123456", status: "active",
    days_of_weeks: [], company: { id: 1, name: "Neon Arena" },
    ...(updatedAt === undefined ? {} : { unlock_pin_updated_at: updatedAt }),
  } })));
  await page.route((u) => isBackend(u) && u.pathname === "/branches/1/unlock-pin", (r) => r.fulfill(json({ data: { pin } })));
  await page.goto("/");
  await page.getByPlaceholder("your@email.com").fill("o@o");
  await page.getByPlaceholder(/•/).fill("ok");
  await page.getByRole("button", { name: "Вход", exact: true }).click();
  await expect(page.getByText("Owner One").first()).toBeVisible();
  await page.goto("/#/branches/1/edit");
  const card = page.locator(".gradient-card", { hasText: "PIN экстренного разблокирования" });
  await expect(card).toBeVisible();
  return card;
};

test("ru: a PIN with no date from the backend reads «PIN установлен», never «ещё не установлен»", async ({ page }) => {
  const card = await openEdit(page, null, "4821");
  await expect(card.getByText("PIN установлен", { exact: true })).toBeVisible();
  await expect(card.getByText("PIN ещё не установлен")).toHaveCount(0);
  if (SHOTS) await card.screenshot({ path: `${SHOTS}/unlock-pin-no-date-ru.png` });
});

test("ru: with the date the backend now sends, «Установлен · date»", async ({ page }) => {
  const card = await openEdit(page, "2026-11-14T10:00:00Z", "4821");
  await expect(card.getByText(/^Установлен · /)).toBeVisible();
  await expect(card.getByText("PIN ещё не установлен")).toHaveCount(0);
});

test("ru: no PIN at all still says «PIN ещё не установлен»", async ({ page }) => {
  const card = await openEdit(page, null, null);
  await expect(card.getByText("PIN ещё не установлен", { exact: true })).toBeVisible();
});
