import { expect, test } from "@playwright/test";
import { LANGS, WIDTHS, at, fitsWidth, json, noRawKeys, signIn } from "./helpers/moneySession";

/**
 * «Подтверждение оплаты» (2026-11-20, owner): a seat paid ahead that ended
 * owing more (two Colas) is asked about in a large window — «Да» → how it was
 * paid (starting on the way it was paid ahead), «Нет» → take it now; the
 * answer goes to `POST /sessions/{id}/confirm-due` once. en/ru/am × widths.
 */
const SHOTS = "/home/developer/cyber-place-local/reports/due-confirm-2026-11-20";
const due = {
  session_id: 7, branch_id: 1, place: { id: 104, number: 4, name: "VIP Սրահ" }, ended_at: new Date().toISOString(),
  total: "2000.00", prepaid: "1000.00", due: "1000.00", prepaid_by_method: { card: "1000.00" },
  items: [{ name: "Coca-Cola", qty: 2, price: "500.00" }],
};

for (const lang of LANGS) {
  for (const width of WIDTHS) {
    for (const answer of ["yes", "no"] as const) {
      test(`asked after the seat ended; «${answer}» sends one answer (${lang}, ${width})`, async ({ page }) => {
        let list = [due];
        const sent: unknown[] = [];
        await signIn(page, lang, width, "manager", async () => {
          await page.route(at("/sessions/dues-to-confirm"), (r) => r.fulfill(json({ data: list })));
          await page.route(at("/sessions/7/confirm-due"), (r) => {
            sent.push(r.request().postDataJSON());
            list = [];
            return r.fulfill(json({ session: { id: 7 }, cash: null }));
          });
        });
        const dlg = page.getByTestId("due-confirm");
        await expect(dlg).toBeVisible();
        await expect(page.getByTestId("due-confirm-items")).toContainText("Coca-Cola × 2");
        await noRawKeys(page, "[data-testid=due-confirm]");
        await fitsWidth(page, "[data-testid=due-confirm]");
        await page.waitForTimeout(300);
        await dlg.screenshot({ path: `${SHOTS}/ask-${lang}-${width}.png` });
        await page.getByTestId(answer === "yes" ? "due-confirm-yes" : "due-confirm-no").click();
        await expect(page.getByTestId("payment-editor")).toBeVisible();
        await page.waitForTimeout(300);
        await dlg.screenshot({ path: `${SHOTS}/${answer}-${lang}-${width}.png` });
        await page.getByTestId("due-confirm-save").click();
        await expect.poll(() => sent).toEqual([{ payment_method: answer === "yes" ? "card" : "cash" }]);
        await expect(dlg).toHaveCount(0);
      });
    }
  }
}
