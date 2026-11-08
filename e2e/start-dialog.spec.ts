import { expect, test, type Page } from "@playwright/test";
import { installBackendMocks } from "./helpers/mockBackend";

/**
 * The start dialog made simple (owner, 2026-11-05), on the real bundle and
 * CSS: no package choice where the branch sells none, one box for a length
 * typed as it is said ("1ч 30мин") and read back, optional parts that can be
 * hidden and stay hidden for that person, and room between its parts —
 * nothing cramped, nothing past its edge, from a large window to 520px.
 */
const isBackend = (url: URL): boolean => url.hostname !== "localhost" && url.hostname !== "127.0.0.1";
const json = (body: unknown) => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });

const seed = async (page: Page, packages: unknown[]) => {
  await installBackendMocks(page, { role: "company_owner", company_id: 1, name: "Owner One" });
  await page.route((u) => isBackend(u) && u.pathname === "/pcs", (r) => r.fulfill(json({ data: [1, 2].map((n) => ({
    id: n, branch_id: 1, place_id: 100 + n, label: `PS5 ${n}`, kind: "ps", status: "online", is_startable: true,
    hourly_rate: 1200, assigned_hourly_rate: 1200, current_session_id: null,
    place: { id: 100 + n, number: n, name: `Hall ${n}`, type: "standard", platform: "ps5" },
  })) })));
  await page.route((u) => isBackend(u) && u.pathname === "/sessions", (r) => r.fulfill(json({ data: [] })));
  await page.route((u) => isBackend(u) && u.pathname === "/time-packages", (r) => r.fulfill(json({ data: packages })));
  // The server's price for a planned start: 1 200 an hour.
  await page.route((u) => isBackend(u) && u.pathname === "/sessions/start-quote", (r) => {
    const q = new URL(r.request().url()).searchParams;
    // "Until" is the server's to resolve: here always two hours away.
    const until = q.get("until");
    const minutes = until ? 120 : Number(q.get("minutes"));
    const end = until ? { until, ends_at: new Date(Date.now() + 120 * 60_000).toISOString() } : {};
    return r.fulfill(json({ minutes, hourly_rate: 1200, amount: (1200 * minutes) / 60, standard_amount: (1200 * minutes) / 60, ...end }));
  });
};

const openDialog = async (page: Page, width: number, packages: unknown[] = []) => {
  await page.setViewportSize({ width, height: 900 });
  await seed(page, packages);
  await page.goto("/");
  await page.getByPlaceholder("your@email.com").fill("o@o");
  await page.getByPlaceholder(/•/).fill("ok");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Owner One").first()).toBeVisible();
  await page.goto("/#/branches/1/sessions");
  await page.locator('.place-cell [data-action="start"]').first().click();
  await expect(page.locator(".start-dialog")).toBeVisible();
};

/** Clear the field, then type `keys` from the hours box as a person would. */
const typeLength = async (page: Page, keys: string) => {
  const clear = page.getByTestId("planned-duration-input-clear");
  if (await clear.count()) await clear.click();
  await page.getByTestId("planned-duration-input-hours").click();
  await page.keyboard.type(keys, { delay: 30 });
};
const expectBoxes = async (page: Page, hours: string, minutes: string) => {
  await expect(page.getByTestId("planned-duration-input-hours")).toHaveValue(hours);
  await expect(page.getByTestId("planned-duration-input-minutes")).toHaveValue(minutes);
};

const layout = (page: Page) => page.evaluate(() => {
  const d = document.querySelector(".start-dialog") as HTMLElement;
  const kids = Array.from(d.children) as HTMLElement[];
  const gaps = kids.slice(1).map((k, i) => Math.round(k.getBoundingClientRect().top - kids[i].getBoundingClientRect().bottom));
  const r = d.getBoundingClientRect();
  return {
    gaps, overflow: d.scrollWidth - d.clientWidth,
    inWindow: r.left >= 0 && r.right <= window.innerWidth,
    pastEdge: Array.from(d.querySelectorAll<HTMLElement>("*")).filter((el) => {
      const b = el.getBoundingClientRect();
      return b.width > 0 && (b.right > r.right + 1 || b.left < r.left - 1);
    }).map((el) => el.className || el.tagName).slice(0, 5),
  };
});

for (const width of [1440, 800, 520]) {
  test(`${width}px: no package choice without packages, one box for the length, room between parts`, async ({ page }) => {
    await openDialog(page, width);
    await expect(page.getByTestId("start-mode")).toHaveCount(0);
    await expect(page.getByText("Hours", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("group", { name: "Quick choice" })).toHaveCount(0);

    // Typed key by key, where the focus goes: "1 30" is 1 h 30 min.
    await typeLength(page, "1 30");
    await expectBoxes(page, "1", "30");
    await expect(page.getByTestId("start-summary")).toContainText("90 min · about 1,800 AMD");
    // One line under the field while it is empty, none once it is filled.
    await expect(page.getByText("Leave empty for an open session with no end")).toHaveCount(0);

    const l = await layout(page);
    for (const g of l.gaps) expect(g, JSON.stringify(l)).toBeGreaterThanOrEqual(16);
    expect(l.overflow).toBeLessThanOrEqual(0);
    // …and inside the hourly part: the rate, its change, the length.
    const inner = await page.evaluate(() => {
      const col = document.querySelector(".start-dialog__open") as HTMLElement;
      const kids = Array.from(col.children) as HTMLElement[];
      return kids.slice(1).map((k, i) => Math.round(k.getBoundingClientRect().top - kids[i].getBoundingClientRect().bottom));
    });
    for (const g of inner) expect(g, JSON.stringify(inner)).toBeGreaterThanOrEqual(16);
    expect(l.inWindow).toBe(true);
    expect(l.pastEdge, JSON.stringify(l)).toEqual([]);
  });
}

test("with a package, both choices are offered", async ({ page }) => {
  await openDialog(page, 1440, [{ id: 1, branch_id: 1, name_en: "One hour", name_ru: "Час", name_am: "Ժամ", duration_minutes: 60, price: 1500 }]);
  await expect(page.getByTestId("start-mode")).toBeVisible();
});

test("a part hidden is gone, stays hidden after a reload, and can be shown again", async ({ page }) => {
  await openDialog(page, 1440);
  await page.getByTestId("start-customize").click();
  const l = await layout(page);
  for (const g of l.gaps) expect(g, JSON.stringify(l)).toBeGreaterThanOrEqual(16);
  expect(l.pastEdge, JSON.stringify(l)).toEqual([]);
  await page.getByTestId("start-part-plan").locator("xpath=ancestor::label[1]").click();
  await expect(page.getByTestId("planned-duration")).toHaveCount(0);

  await page.reload();
  await page.locator('.place-cell [data-action="start"]').first().click();
  await expect(page.locator(".start-dialog")).toBeVisible();
  await expect(page.getByTestId("planned-duration")).toHaveCount(0);

  await page.getByTestId("start-customize").click();
  await page.getByTestId("start-part-plan").locator("xpath=ancestor::label[1]").click();
  await expect(page.getByTestId("planned-duration")).toBeVisible();
});

test("the length field reads what a person types, key by key", async ({ page }) => {
  await openDialog(page, 1440);
  await expect(page.getByText("Leave empty for an open session with no end")).toHaveCount(1);
  await expect(page.getByText(/Type 1h/)).toHaveCount(0);

  const cases: Array<[string, string, string, string]> = [
    ["1 30", "1", "30", "90 min · about 1,800 AMD"],
    ["1ч 30мин", "1", "30", "90 min · about 1,800 AMD"],
    ["1 час 30 мин", "1", "30", "90 min · about 1,800 AMD"],
    ["30мин", "", "30", "30 min · about 600 AMD"],
    ["30", "", "30", "30 min · about 600 AMD"],
    // Minutes past 59 stay as typed until the field is left (then 1 | 30).
    ["90", "", "90", "90 min · about 1,800 AMD"],
    ["1.30", "1", "30", "90 min · about 1,800 AMD"],
    // A decimal stays as typed until the field is left (then 1 | 30), and is 90 min.
    ["1.5", "1.5", "", "90 min · about 1,800 AMD"],
    ["2ч", "2", "", "120 min · about 2,400 AMD"],
    ["1:45", "1", "45", "105 min · about 2,100 AMD"],
  ];
  for (const [keys, h, m, summary] of cases) {
    await typeLength(page, keys);
    await expectBoxes(page, h, m);
    await expect(page.getByTestId("start-summary"), keys).toContainText(summary);
  }

  // "1.5" left: laid out as hours and minutes.
  await typeLength(page, "1.5");
  await page.locator(".start-dialog h2").click();
  await expectBoxes(page, "1", "30");

    // Into the minutes box on its own: 45 is 45 minutes.
  await page.getByTestId("planned-duration-input-clear").click();
  await page.getByTestId("planned-duration-input-minutes").click();
  await page.keyboard.type("45", { delay: 30 });
  await expectBoxes(page, "", "45");
  await expect(page.getByTestId("start-summary")).toContainText("45 min · about 900 AMD");

  // Arrows: an hour up in the hours, five minutes up in the minutes.
  await page.getByTestId("planned-duration-input-hours").press("ArrowUp");
  await expectBoxes(page, "1", "45");
  await page.getByTestId("planned-duration-input-minutes").press("ArrowUp");
  await expectBoxes(page, "1", "50");

  // Unreadable: no error while typing, said once the field is left; Start held.
  await typeLength(page, "abc");
  await expect(page.locator(".two-box__error")).toHaveCount(0);
  await expect(page.locator(".start-dialog").getByRole("button", { name: "Start", exact: true })).toBeDisabled();
  await page.locator(".start-dialog h2").click();
  await expect(page.locator(".two-box__error")).toBeVisible();

  // × clears it: an open start again.
  await page.getByTestId("planned-duration-input-clear").click();
  await expect(page.getByText("Leave empty for an open session with no end")).toHaveCount(1);
  await expect(page.getByTestId("start-summary")).not.toContainText("min ·");
});

test("until a time: no colon to type, key by key, written out when left", async ({ page }) => {
  await openDialog(page, 1440);
  await page.getByRole("tab", { name: "Until a time" }).click();
  // One line under the field while it is empty: how to type a time.
  await expect(page.getByText(/the colon is added for you/)).toHaveCount(1);
  await expect(page.getByText("Leave empty for an open session with no end")).toHaveCount(0);
  const hours = page.getByTestId("planned-until-input-hours");
  const minutes = page.getByTestId("planned-until-input-minutes");
  const typeTime = async (keys: string) => {
    const clear = page.getByTestId("planned-until-input-clear");
    if (await clear.count()) await clear.click();
    await hours.click();
    await page.keyboard.type(keys, { delay: 30 });
  };

  for (const [keys, h, m] of [["1430", "14", "30"], ["0040", "00", "40"], ["930", "9", "30"], ["14:30", "14", "30"], ["2359", "23", "59"]] as const) {
    await typeTime(keys);
    await expect(hours, keys).toHaveValue(h);
    await expect(minutes, keys).toHaveValue(m);
    await expect(page.getByTestId("start-summary"), keys).toContainText(`until ${h.padStart(2, "0")}:${m}`);
    await expect(page.getByTestId("start-summary"), keys).toContainText("about 2,400 AMD");
    // Set: the hint has gone, the server's answer is the one line.
    await expect(page.getByText(/the colon is added for you/)).toHaveCount(0);
    await expect(page.getByTestId("planned-until-resolved")).toBeVisible();
  }

  // Half typed: nothing priced, Start held; left, on the hour.
  await typeTime("9");
  await expect(minutes).toBeFocused();
  await expect(page.locator(".start-dialog").getByRole("button", { name: "Start", exact: true })).toBeDisabled();
  await page.locator(".start-dialog h2").click();
  await expect(hours).toHaveValue("09");
  await expect(minutes).toHaveValue("00");
  await expect(page.getByTestId("start-summary")).toContainText("until 09:00");

  // Arrows round the clock.
  await minutes.press("ArrowUp");
  await expect(minutes).toHaveValue("05");
  await hours.press("ArrowDown");
  await expect(hours).toHaveValue("08");

  // Not a time: said once left, Start held.
  await typeTime("ab");
  await expect(page.locator(".two-box__error")).toHaveCount(0);
  await page.locator(".start-dialog h2").click();
  await expect(page.locator(".two-box__error")).toBeVisible();
  await expect(page.locator(".start-dialog").getByRole("button", { name: "Start", exact: true })).toBeDisabled();

  const l = await layout(page);
  expect(l.pastEdge, JSON.stringify(l)).toEqual([]);
});

// A field already filled is corrected by typing over it (review, 2026-11-05):
// the box entered is selected, so new digits REPLACE the old ones and are
// never appended to them (1:30 retyped as "2 15" used to become 7:15).
test("correcting a filled length or time replaces it, never adds to it", async ({ page }) => {
  await openDialog(page, 1440);
  const hours = page.getByTestId("planned-duration-input-hours");
  const minutes = page.getByTestId("planned-duration-input-minutes");
  await typeLength(page, "1 30");
  await expectBoxes(page, "1", "30");

  // Click the hours and type the new length over the old.
  await hours.click();
  await page.keyboard.type("2 15", { delay: 30 });
  await expectBoxes(page, "2", "15");
  await expect(page.getByTestId("start-summary")).toContainText("135 min");

  // Tab into the minutes and type over them.
  await hours.click();
  await page.keyboard.press("Tab");
  await page.keyboard.type("45", { delay: 30 });
  await expectBoxes(page, "2", "45");
  await expect(page.getByTestId("start-summary")).toContainText("165 min");

  // Click the minutes directly.
  await minutes.click();
  await page.keyboard.type("5", { delay: 30 });
  await expectBoxes(page, "2", "5");

  // Minutes the hours box itself writes are still being typed, even when they
  // equal the old ones: "30мин" over 1:30 is 30 min, not an empty field.
  await typeLength(page, "1 30");
  await hours.click();
  await page.keyboard.type("30мин", { delay: 30 });
  await expectBoxes(page, "", "30");
  // "120" typed key by key is 2 hours (as typed until left, then 2 | 00),
  // and "600" is 10 hours — never "60" laid out early and a "0" read after it.
  await hours.click();
  await page.keyboard.type("120", { delay: 30 });
  await expectBoxes(page, "", "120");
  await expect(page.getByTestId("start-summary")).toContainText("120 min");
  await page.locator(".start-dialog h2").click();
  await expectBoxes(page, "2", "00");
  await hours.click();
  await page.keyboard.type("600", { delay: 30 });
  await expect(page.getByTestId("start-summary")).toContainText("600 min");

  // Backspace from empty minutes goes back and deletes ONE digit of the hours.
  await typeLength(page, "10 ");
  await expectBoxes(page, "10", "");
  await expect(page.getByTestId("planned-duration-input-minutes")).toBeFocused();
  await page.keyboard.press("Backspace");
  await page.keyboard.press("Backspace");
  await expectBoxes(page, "1", "");

  // "100" typed key by key is 100 minutes, never 10 hours and a 0.
  await typeLength(page, "100");
  await expect(page.getByTestId("start-summary")).toContainText("100 min");

    // The clock field the same way: 14:30 corrected to 09:40.
  await page.getByRole("tab", { name: "Until a time" }).click();
  const ch = page.getByTestId("planned-until-input-hours");
  await ch.click();
  await page.keyboard.type("1430", { delay: 30 });
  await expect(ch).toHaveValue("14");
  await expect(page.getByTestId("planned-until-input-minutes")).toHaveValue("30");
  await ch.click();
  await page.keyboard.type("0940", { delay: 30 });
  await expect(ch).toHaveValue("09");
  await expect(page.getByTestId("planned-until-input-minutes")).toHaveValue("40");
  await expect(page.getByTestId("start-summary")).toContainText("until 09:40");

  // "147" is 14:07; Backspace takes the padded 07 at once; a new 5 is 14:05.
  await ch.click();
  await page.keyboard.type("147", { delay: 30 });
  await expect(page.getByTestId("planned-until-input-minutes")).toHaveValue("07");
  await page.keyboard.press("Backspace");
  await expect(page.getByTestId("planned-until-input-minutes")).toHaveValue("");
  await page.keyboard.type("05", { delay: 30 });
  await expect(page.getByTestId("start-summary")).toContainText("until 14:05");

  // Typing over a selected 07: "05" is 05 at once (no late quote).
  await page.getByTestId("planned-until-input-minutes").click();
  await page.keyboard.type("0", { delay: 30 });
  await expect(page.getByTestId("planned-until-input-minutes")).toHaveValue("0");
});
