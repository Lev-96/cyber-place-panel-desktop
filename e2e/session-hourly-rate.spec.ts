import { expect, test } from "@playwright/test";
import { LANGS, WIDTHS, at, fitsWidth, json, noRawKeys, openBoard, runningSession, seedBoard, shot, signIn } from "./helpers/moneySession";

/**
 * The seat's price per hour changed during the game (2026-11-19). Shapes as in
 * SessionRateChangeTest: `POST /sessions/{id}/rate {rate}` → `{session}` with
 * the new `hourly_rate`; the server bills it from now. The panel sends the
 * typed price once and shows the server's answer.
 */
for (const lang of LANGS) {
  for (const width of WIDTHS) {
    test(`«+ Время»: price per hour 1 000 → 800, sent once, shown back (${lang}, ${width})`, async ({ page }) => {
      let current = runningSession({ hourly_rate: "1000.00", tariff_hourly_rate: 1000 });
      const sent: unknown[] = [];
      await signIn(page, lang, width, "manager");
      await seedBoard(page, { session: () => current });
      await page.route(at("/sessions/5/rate"), (r) => {
        sent.push(r.request().postDataJSON());
        current = runningSession({ hourly_rate: "800.00", tariff_hourly_rate: 800, rate_changed_at: new Date().toISOString() });
        return r.fulfill(json({ session: current, hourly_now: 800 }));
      });
      await openBoard(page);
      await page.locator('[data-action="add-time"]').first().click();
      const section = page.getByTestId("hourly-rate-section");
      await section.scrollIntoViewIfNeeded();
      await expect(page.getByTestId("hourly-rate-now")).toContainText("1");
      await expect(page.getByTestId("hourly-rate-save")).toBeDisabled();
      await section.locator("input").first().fill("800");
      await noRawKeys(page, "[role=dialog]");
      await fitsWidth(page, "[data-testid=hourly-rate-section]");
      await shot(page, `hourly-rate-${lang}-${width}`);
      await page.getByTestId("hourly-rate-save").click();
      await expect.poll(() => sent).toEqual([{ rate: 800 }]);
      await expect(page.getByTestId("hourly-rate-now")).toContainText("800");
      await expect(page.getByTestId("hourly-rate-save")).toBeDisabled();
    });
  }
}
