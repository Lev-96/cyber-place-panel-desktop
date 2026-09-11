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
    expect(screen.queryByRole("combobox")).toBeNull();
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

/** A third branch, for the months in which the first one is not listed. */
const BRANCH_KOMITAS: IBranchRevenueSummary = {
  ...BRANCH_EMPTY,
  branch_id: 3,
  address: "Komitas 40",
  sessions_count: 1,
  sessions_total: 1000,
  gross_total: 1000,
  total_gross: 1000,
  commission_amount: 75,
  owner_income: 925,
};

const TWO: ICompanyRevenueSummary = { ...CURRENT, branches: [BRANCH_ABOVYAN, BRANCH_EMPTY] };

const COMPANY_TITLE = "Revenue for the month";
const branchTitle = (label: string) => `Revenue for the month: ${label}`;

const picker = () => screen.getByRole("combobox", { name: "Branch" }) as HTMLSelectElement;
const pick = async (value: string) => {
  await act(async () => { fireEvent.change(picker(), { target: { value } }); });
};
const optionLabels = () => Array.from(picker().options).map((o) => o.textContent);
const shownOption = () => picker().selectedOptions[0]?.textContent;

const nextMonth = async () => {
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Next month" })); });
};

describe("CompanyRevenueScreen: the branch selector", () => {
  // One branch IS the company: a selector would offer the same figures twice.
  test.each([
    ["one branch", CURRENT],
    ["an empty list", { ...CURRENT, branches: [] }],
    ["an older backend without the list", LEGACY],
  ])("%s: no selector, the company card", async (_case, response) => {
    api.summary.mockResolvedValue(response);
    await renderScreen();

    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByText("All branches")).toBeNull();
  });

  test("two branches: All branches by default, every branch offered by its address", async () => {
    api.summary.mockResolvedValue(TWO);
    const card = await renderScreen();

    expect(picker().value).toBe("");
    expect(shownOption()).toBe("All branches");
    // A null address is still identifiable.
    expect(optionLabels()).toEqual(["All branches", "Abovyan 1", "№2"]);
    // The company's card, exactly as without a selector.
    expect(highlight(card)).toBe("571.41 AMD");
    expect(rowValue(card, "Total revenue")).toBe("7618.79 AMD");
    expect(rowValue(card, "Owner income")).toBe("7000 AMD");
  });

  test("picking a branch prints that branch's row as sent, in the same card, without a request", async () => {
    api.summary.mockResolvedValue(TWO);
    await renderScreen();

    await pick("1");

    expect(screen.queryByRole("region", { name: COMPANY_TITLE })).toBeNull();
    const card = screen.getByRole("region", { name: branchTitle("Abovyan 1") });
    expect(rowValue(card, "Closed sessions")).toBe("3");
    expect(rowValue(card, "Sessions")).toBe("2734.81 AMD");
    expect(rowValue(card, "POS orders")).toBe("250.5 AMD");
    expect(rowValue(card, "Paid tournament entries")).toBe("2");
    expect(rowValue(card, "Tournament entry fees")).toBe("2000 AMD");
    expect(rowValue(card, "Total revenue")).toBe("4985.31 AMD");
    // The company's rate: a branch has none of its own.
    expect(rowValue(card, "Cyber Place commission")).toBe("7.5%");
    // The branch's own commission, highlighted where the company's owed amount was.
    expect(highlight(card)).toBe("373.9 AMD");
    // 4600, not total_gross − commission_amount (4611.41): never derived here.
    expect(rowValue(card, "Owner income")).toBe("4600 AMD");
    expect(shownOption()).toBe("Abovyan 1");
    // A filter over the answer on screen, never a second request.
    expect(api.summary).toHaveBeenCalledTimes(1);
  });

  test("a branch with nothing this month prints zeros, and no till row", async () => {
    api.summary.mockResolvedValue(TWO);
    await renderScreen();

    await pick("2");

    const card = screen.getByRole("region", { name: branchTitle("№2") });
    expect(rowValue(card, "Closed sessions")).toBe("0");
    expect(rowValue(card, "Sessions")).toBe("0 AMD");
    expect(within(card).queryByText("POS orders")).toBeNull();
    expect(rowValue(card, "Paid tournament entries")).toBe("0");
    expect(rowValue(card, "Tournament entry fees")).toBe("0 AMD");
    expect(rowValue(card, "Total revenue")).toBe("0 AMD");
    expect(highlight(card)).toBe("0 AMD");
    expect(rowValue(card, "Owner income")).toBe("0 AMD");
    expect(document.body.textContent).not.toMatch(/undefined|NaN/);
  });

  test("back to All branches restores the company's figures", async () => {
    api.summary.mockResolvedValue(TWO);
    await renderScreen();
    await pick("1");

    await pick("");

    const card = screen.getByRole("region", { name: COMPANY_TITLE });
    expect(highlight(card)).toBe("571.41 AMD");
    expect(rowValue(card, "Closed sessions")).toBe("5");
    expect(api.summary).toHaveBeenCalledTimes(1);
  });
});

describe("CompanyRevenueScreen: the selection across months", () => {
  test("a branch still listed next month stays selected, with that month's figures", async () => {
    let answer: (value: ICompanyRevenueSummary) => void = () => {};
    api.summary
      .mockResolvedValueOnce(TWO)
      .mockImplementationOnce(() => new Promise((resolve) => { answer = resolve; }));
    await renderScreen();
    await pick("1");

    await nextMonth();

    // While the month loads: the loading state, no card at all (never last
    // month's figures under this month's label), and the choice locked.
    expect(screen.queryByRole("region")).toBeNull();
    expect(picker().disabled).toBe(true);

    const october = { ...BRANCH_ABOVYAN, sessions_total: 111.11, total_gross: 222.22, commission_amount: 16.67, owner_income: 205 };
    await act(async () => { answer({ ...TWO, branches: [october, BRANCH_EMPTY] }); });

    const card = screen.getByRole("region", { name: branchTitle("Abovyan 1") });
    expect(rowValue(card, "Sessions")).toBe("111.11 AMD");
    expect(highlight(card)).toBe("16.67 AMD");
    expect(rowValue(card, "Owner income")).toBe("205 AMD");
    expect(picker().disabled).toBe(false);
    expect(shownOption()).toBe("Abovyan 1");
  });

  test("a branch not listed next month falls back to All branches, and stays there", async () => {
    api.summary
      .mockResolvedValueOnce(TWO)
      .mockResolvedValueOnce({ ...TWO, branches: [BRANCH_EMPTY, BRANCH_KOMITAS] })
      .mockResolvedValueOnce(TWO);
    await renderScreen();
    await pick("1");

    await nextMonth();

    expect(shownOption()).toBe("All branches");
    expect(highlight(screen.getByRole("region", { name: COMPANY_TITLE }))).toBe("571.41 AMD");

    // The branch is back a month later: the owner chose nothing since, so the
    // screen does not quietly switch back to it.
    await nextMonth();

    expect(shownOption()).toBe("All branches");
    expect(screen.getByRole("region", { name: COMPANY_TITLE })).toBeTruthy();
  });

  test("a month with one branch hides the selector and shows the company", async () => {
    api.summary.mockResolvedValueOnce(TWO).mockResolvedValueOnce(CURRENT).mockResolvedValueOnce(TWO);
    await renderScreen();
    await pick("1");

    await nextMonth();

    expect(screen.queryByRole("combobox")).toBeNull();
    expect(highlight(screen.getByRole("region", { name: COMPANY_TITLE }))).toBe("571.41 AMD");

    await nextMonth();

    expect(shownOption()).toBe("All branches");
  });
});

describe("CompanyRevenueScreen — loading the month", () => {
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
