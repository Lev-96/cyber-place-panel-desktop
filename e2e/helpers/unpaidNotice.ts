import type { Page } from "@playwright/test";

/**
 * «Не оплачено» is ON by default (2026-11-22, owner) and Start / «+ Товар»
 * say so over the form the moment they open (UnpaidOnNotice). A click takes
 * it away — what the cashier does — so a spec that works the form clicks it
 * first. Waits for it (Start draws it once its packages are read); a dialog
 * where the switch is not shown (free, «На сумму») has none, and that is fine.
 */
export const dismissUnpaidNotice = async (page: Page, timeout = 3000): Promise<boolean> => {
  const notice = page.locator('[data-testid="unpaid-on-notice"], [data-testid="items-unpaid-notice"]').first();
  try {
    await notice.waitFor({ state: "visible", timeout });
  } catch {
    return false;
  }
  await notice.click();
  await notice.waitFor({ state: "detached" });
  return true;
};
