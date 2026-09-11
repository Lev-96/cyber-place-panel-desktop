// @vitest-environment jsdom
import type { IBranchRevenueSummary, ICompanyRevenueSummary } from "@/api/billing";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import CompanyRevenueScreen from "./CompanyRevenueScreen";

const api = vi.hoisted(() => ({ summary: vi.fn() }));

vi.mock("@/api/billing", () => ({
  apiCompanyRevenueSummary: (companyId: number, range: unknown) => api.summary(companyId, range),
}));

// Real English strings (so the "Closed: {0}" templates are exercised), and a
// `money` that prints the number it was handed EXACTLY as it arrived — the real
// one rounds to whole units, which would hide a client that re-derives a figure
// and lands on a nearby value. `undefined`/`NaN` would print as such.
vi.mock("@/i18n/LanguageContext", async () => {
  const { t } = await vi.importActual<typeof import("@/i18n/translations")>("@/i18n/translations");
  return {
    useLang: () => ({ t: (key: string) => t(key, "en"), money: (amount: number) => `${amount} AMD` }),
  };
});

/** The response as an older backend sends it: the nine pre-tournament keys only. */
const LEGACY: ICompanyRevenueSummary = {
  company_id: 1,
  from: "2026-08-01T00:00:00+04:00",
  to: "2026-08-31T23:59:59+04:00",
  sessions_count: 5,
  sessions_total: 3768.24,
  pos_total: 350.55,
  gross_total: 4118.79,
  commission_percent: 7.5,
  commission_amount: 308.91,
};

const BRANCH_ABOVYAN: IBranchRevenueSummary = {
  branch_id: 1,
  address: "Abovyan 1",
  sessions_count: 3,
  sessions_total: 2734.81,
  pos_total: 250.5,
  tournaments_count: 2,
  tournaments_total: 2000,
  gross_total: 2985.31,
  total_gross: 4985.31,
  commission_amount: 373.9,
  // Deliberately NOT total_gross − commission_amount (4611.41): a client that
  // works owner income out for itself prints the wrong number and fails.
  owner_income: 4600,
};

const BRANCH_EMPTY: IBranchRevenueSummary = {
  branch_id: 2,
  address: null,
  sessions_count: 0,
  sessions_total: 0,
  pos_total: 0,
  tournaments_count: 0,
  tournaments_total: 0,
  gross_total: 0,
  total_gross: 0,
  commission_amount: 0,
  owner_income: 0,
};

/** The response as the current backend sends it (real figures from its tests). */
const CURRENT: ICompanyRevenueSummary = {
  ...LEGACY,
  tournaments_count: 3,
  tournaments_total: 3500,
  tournaments_commission_amount: 262.5,
  total_gross: 7618.79,
  total_commission_amount: 571.41,
  // Deliberately NOT total_gross − total_commission_amount (7047.38), as above.
  owner_income: 7000,
  branches: [BRANCH_ABOVYAN],
};

afterEach(() => cleanup());
beforeEach(() => {
  api.summary.mockReset();
});

const renderScreen = async () => {
  render(<CompanyRevenueScreen companyId={1} companyName="Arena" initialPercent={7.5} />);
  return screen.findByRole("region", { name: "Revenue for the month" });
};

/** The value printed on the summary row labelled `label`. */
const rowValue = (card: HTMLElement, label: string) =>
  within(card).getByText(label).closest(".kv-row")?.querySelector(".v")?.textContent;

const highlight = (card: HTMLElement) => card.querySelector(".kv-row .v.hi")?.textContent;

/** The amount of a table cell, without the count printed under it. */
const amountOf = (cell: HTMLElement) => cell.firstChild?.textContent;

describe("CompanyRevenueScreen — the month's summary", () => {
  test("prints every figure of the response on its own row", async () => {
    api.summary.mockResolvedValue(CURRENT);
    const card = await renderScreen();

    expect(api.summary).toHaveBeenCalledWith(1, expect.objectContaining({ from: expect.any(String), to: expect.any(String) }));
    expect(rowValue(card, "Closed sessions")).toBe("5");
    expect(rowValue(card, "Sessions")).toBe("3768.24 AMD");
    expect(rowValue(card, "POS orders")).toBe("350.55 AMD");
    expect(rowValue(card, "Paid tournament entries")).toBe("3");
    expect(rowValue(card, "Tournament entry fees")).toBe("3500 AMD");
    expect(rowValue(card, "Total revenue")).toBe("7618.79 AMD");
    expect(rowValue(card, "Cyber Place commission")).toBe("7.5%");
    expect(rowValue(card, "Owner income")).toBe("7000 AMD");
  });

  test("the amount owed is the commission on everything, tournaments included", async () => {
    api.summary.mockResolvedValue(CURRENT);
    const card = await renderScreen();

    expect(rowValue(card, "You owe us this period")).toBe("571.41 AMD");
    expect(highlight(card)).toBe("571.41 AMD");
  });

  test("an older backend: the owed amount and total fall back to the keys it has, and no row is invented", async () => {
    api.summary.mockResolvedValue(LEGACY);
    const card = await renderScreen();

    expect(highlight(card)).toBe("308.91 AMD");
    expect(rowValue(card, "Total revenue")).toBe("4118.79 AMD");
    expect(within(card).queryByText("Paid tournament entries")).toBeNull();
    expect(within(card).queryByText("Tournament entry fees")).toBeNull();
    // No owner income on a backend that does not send it — never derived here.
    expect(within(card).queryByText("Owner income")).toBeNull();
    expect(screen.queryByRole("table")).toBeNull();
    expect(document.body.textContent).not.toMatch(/undefined|NaN/);
  });

  test("a month without tournament fees still shows the tournament rows, as zeros", async () => {
    api.summary.mockResolvedValue({ ...CURRENT, tournaments_count: 0, tournaments_total: 0 });
    const card = await renderScreen();

    expect(rowValue(card, "Paid tournament entries")).toBe("0");
    expect(rowValue(card, "Tournament entry fees")).toBe("0 AMD");
    expect(document.body.textContent).not.toMatch(/undefined|NaN/);
  });
});

describe("CompanyRevenueScreen — per-branch breakdown", () => {
  test("one branch is the whole company: no breakdown", async () => {
    api.summary.mockResolvedValue(CURRENT);
    await renderScreen();

    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByText("By branch")).toBeNull();
  });

  test("two branches: one row each, every cell the server's figure as sent", async () => {
    api.summary.mockResolvedValue({ ...CURRENT, branches: [BRANCH_ABOVYAN, BRANCH_EMPTY] });
    await renderScreen();

    const table = screen.getByRole("table", { name: "By branch" });
    const [, first, second] = within(table).getAllByRole("row");
    expect(within(table).getAllByRole("row")).toHaveLength(3);

    expect(within(first).getByRole("rowheader").textContent).toBe("Abovyan 1");
    const [sessions, pos, tournaments, total, commission, income] = within(first).getAllByRole("cell");
    expect(amountOf(sessions)).toBe("2734.81 AMD");
    expect(within(sessions).getByText("Closed: 3")).toBeTruthy();
    expect(amountOf(pos)).toBe("250.5 AMD");
    expect(amountOf(tournaments)).toBe("2000 AMD");
    expect(within(tournaments).getByText("Entries: 2")).toBeTruthy();
    expect(amountOf(total)).toBe("4985.31 AMD");
    expect(amountOf(commission)).toBe("373.9 AMD");
    expect(amountOf(income)).toBe("4600 AMD");

    // A branch with no address is still identifiable, and a zero row is a row.
    expect(within(second).getByRole("rowheader").textContent).toBe("№2");
    expect(within(second).getAllByRole("cell").map(amountOf)).toEqual([
      "0 AMD", "0 AMD", "0 AMD", "0 AMD", "0 AMD", "0 AMD",
    ]);
    expect(document.body.textContent).not.toMatch(/undefined|NaN/);
  });

  test("the till column appears only when some branch took till money", async () => {
    const noTill = { ...BRANCH_ABOVYAN, pos_total: 0 };
    api.summary.mockResolvedValue({ ...CURRENT, pos_total: 0, branches: [noTill, BRANCH_EMPTY] });
    await renderScreen();

    const table = screen.getByRole("table", { name: "By branch" });
    expect(within(table).queryByRole("columnheader", { name: "POS orders" })).toBeNull();
    expect(within(within(table).getAllByRole("row")[1]).getAllByRole("cell")).toHaveLength(5);
  });
});

describe("CompanyRevenueScreen — loading the month", () => {
  const nextMonth = async () => {
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Next month" })); });
  };

  test("a failed month clears the previous figures and offers a retry that re-asks", async () => {
    api.summary.mockResolvedValueOnce(CURRENT).mockRejectedValueOnce(new Error("Server unavailable"));
    await renderScreen();

    await nextMonth();

    expect(screen.getByRole("alert").textContent).toContain("Server unavailable");
    expect(screen.queryByRole("region", { name: "Revenue for the month" })).toBeNull();

    api.summary.mockResolvedValueOnce(LEGACY);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Retry" })); });

    const card = await screen.findByRole("region", { name: "Revenue for the month" });
    expect(highlight(card)).toBe("308.91 AMD");
    expect(api.summary).toHaveBeenCalledTimes(3);
  });

  test("a slow answer for an earlier month never overwrites the month on screen", async () => {
    let answerFirst: (value: ICompanyRevenueSummary) => void = () => {};
    api.summary
      .mockImplementationOnce(() => new Promise((resolve) => { answerFirst = resolve; }))
      .mockResolvedValueOnce(LEGACY);
    render(<CompanyRevenueScreen companyId={1} companyName="Arena" initialPercent={7.5} />);

    await nextMonth();
    const card = await screen.findByRole("region", { name: "Revenue for the month" });
    expect(highlight(card)).toBe("308.91 AMD");

    await act(async () => { answerFirst(CURRENT); });

    expect(highlight(screen.getByRole("region", { name: "Revenue for the month" }))).toBe("308.91 AMD");
  });
});
