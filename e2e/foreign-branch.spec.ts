import { expect, test, type Page } from "@playwright/test";
import { installBackendMocks, seedLanguageChosen } from "./helpers/mockBackend";

/**
 * B11 (audit 2026-11-13): a manager of branch 1 opening a link to branch 2
 * saw a generic «Что-то пошло не так» with Retry and the server's raw English
 * "This action is unauthorized.". The backend refuses with 403 (StaffBranchScope);
 * the panel now says «Нет доступа к этому филиалу», with no Retry.
 * `FOREIGN_SHOTS=<dir>` also writes screenshots.
 */
const isBackend = (url: URL): boolean => url.hostname !== "localhost" && url.hostname !== "127.0.0.1";
const SHOTS = process.env.FOREIGN_SHOTS;
type Lang = "en" | "ru" | "am";
const COPY: Record<Lang, { title: string; retry: string; signIn: string }> = {
  en: { title: "No access to this branch", retry: "Retry", signIn: "Sign in" },
  ru: { title: "Нет доступа к этому филиалу", retry: "Повторить", signIn: "Вход" },
  am: { title: "Այս մասնաճյուղի հասանելիություն չունեք", retry: "Կրկնել", signIn: "Մուտք" },
};

const signInAsManager = async (page: Page, lang: Lang) => {
  await seedLanguageChosen(page, lang);
  await installBackendMocks(page, { role: "manager", branch_id: 1, company_id: 1, name: "Manager One" });
  // Anything about branch 2 is refused, as StaffBranchScope refuses it.
  await page.route((u) => isBackend(u) && (u.searchParams.get("branch_id") === "2" || u.pathname.startsWith("/branches/2")), (r) =>
    r.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ message: "This action is unauthorized." }) }));
  await page.goto("/");
  await page.getByPlaceholder("your@email.com").fill("m@m");
  await page.getByPlaceholder(/•/).fill("ok");
  await page.getByRole("button", { name: COPY[lang].signIn, exact: true }).click();
  await expect(page.getByText("Manager One").first()).toBeVisible();
};

for (const lang of ["en", "ru", "am"] as const) {
  test(`${lang}: another branch's Active Places link says «no access», no Retry, no server English`, async ({ page }) => {
    await signInAsManager(page, lang);
    await page.goto("/#/branches/2/sessions");
    const main = page.locator("main.main");
    await expect(main.getByText(COPY[lang].title)).toBeVisible();
    await expect(main.getByText("This action is unauthorized.")).toHaveCount(0);
    await expect(main.getByRole("button", { name: COPY[lang].retry, exact: true })).toHaveCount(0);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/foreign-branch-sessions-${lang}.png` });
  });
}

test("ru: another branch's hub link is the «no access» state alone, without its tiles", async ({ page }) => {
  await signInAsManager(page, "ru");
  await page.goto("/#/branches/2");
  const main = page.locator("main.main");
  await expect(main.getByText(COPY.ru.title)).toBeVisible();
  await expect(main.getByText("This action is unauthorized.")).toHaveCount(0);
  await expect(main.getByRole("button", { name: COPY.ru.retry, exact: true })).toHaveCount(0);
  // The branch's tiles would only lead to the same refusal.
  await expect(main.getByText("Активные места")).toHaveCount(0);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/foreign-branch-hub-ru.png` });
});
