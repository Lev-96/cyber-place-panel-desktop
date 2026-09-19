import { Page, test } from "@playwright/test";
import { settle, shotPath } from "./harness";

/**
 * The public site: what a club owner meets before anything else.
 *
 * Served from the repository over a local static server, so what is captured
 * is the page as committed rather than whatever happens to be deployed.
 *
 * ⚠️ No `fullPage` here. The landing is several thousand pixels tall and at
 * 2× a single strip is a surface the headless renderer segfaults on. Sections
 * are better for video anyway: a zoom lives inside one screen, not inside a
 * 30 000px ribbon.
 */
const SITE = "http://127.0.0.1:8088";

const sections = async (page: Page, name: string, count: number) => {
  for (let i = 0; i < count; i++) {
    await page.evaluate((n) => window.scrollTo({ top: n * window.innerHeight, behavior: "instant" as ScrollBehavior }), i);
    await page.waitForTimeout(600);
    await page.screenshot({ path: shotPath("site", i === 0 ? name : `${name}-${i + 1}`) });
  }
};

const PAGES: Array<[string, string, number]> = [
  ["/", "site-hy-home", 5],
  ["/ru/", "site-ru-home", 3],
  ["/en/", "site-en-home", 3],
  ["/club-management/", "site-club-management", 3],
  ["/playstation-club/", "site-playstation", 3],
  ["/booking/", "site-booking", 3],
];

for (const [path, name, count] of PAGES) {
  test(`site: ${name}`, async ({ page }) => {
    await page.goto(SITE + path);
    await settle(page, 1200);
    await sections(page, name, count);
  });
}

test("site: the contact form, where the CTA lands", async ({ page }) => {
  await page.goto(SITE + "/#contact");
  await settle(page, 1500);
  await page.screenshot({ path: shotPath("site", "site-contact") });
});
