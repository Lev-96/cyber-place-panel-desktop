// @vitest-environment jsdom
import type { IBranchRevenueSummary, ICompanyRevenueSummary } from "@/api/billing";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import BranchRevenueTable from "./BranchRevenueTable";
import RevenueSummaryCard from "./RevenueSummaryCard";

/**
 * How the revenue screen PRINTS the server's figures — the half
 * `CompanyRevenueScreen.test.tsx` deliberately leaves out (its `money` echoes
 * the raw number so a re-derived figure shows up). Here `money` is the REAL
 * formatter, with whatever options the component hands it.
 *
 * The figures are the live E2E's: 9000.50 / 900.05 / 8100.45. Rounded to whole
 * units the card read "9,001 − 900 = 8,100", which does not add up. The rule
 * pinned: an amount whose server value has cents shows exactly two decimals; a
 * whole amount shows none. Decided per amount — nothing is summed here.
 */

vi.mock("@/i18n/LanguageContext", async () => {
  const { t } = await vi.importActual<typeof import("@/i18n/translations")>("@/i18n/translations");
  const { moneyDisplay } = await vi.importActual<typeof import("@/i18n/currency")>("@/i18n/currency");
  return {
    useLang: () => ({
      t: (key: string) => t(key, "en"),
      money: (amount: number, options?: import("@/i18n/currency").MoneyFormatOptions) =>
        moneyDisplay.format(amount, "AMD", "en", options),
    }),
  };
});

afterEach(() => cleanup());

/** Company A after the E2E seeds + one verified player (results.jsonl, step 9). */
const SUMMARY: ICompanyRevenueSummary = {
  company_id: 3,
  from: "2026-09-01T00:00:00+04:00",
  to: "2026-09-30T23:59:59+04:00",
  sessions_count: 4,
  sessions_total: 7500.5,
  pos_total: 0,
  gross_total: 7500.5,
  commission_percent: 10,
  commission_amount: 750.05,
  tournaments_count: 1,
  tournaments_total: 1500,
  tournaments_commission_amount: 150,
  total_gross: 9000.5,
  total_commission_amount: 900.05,
  owner_income: 8100.45,
};

const TUMANYAN: IBranchRevenueSummary = {
  branch_id: 5,
  address: "Tumanyan street 12",
  sessions_count: 3,
  sessions_total: 3500.5,
  pos_total: 0,
  tournaments_count: 1,
  tournaments_total: 1500,
  gross_total: 3500.5,
  total_gross: 5000.5,
  commission_amount: 500.05,
  owner_income: 4500.45,
};

const SAYAT_NOVA: IBranchRevenueSummary = {
  branch_id: 6,
  address: "Sayat-Nova Avenue 19",
  sessions_count: 1,
  sessions_total: 4000,
  pos_total: 0,
  tournaments_count: 0,
  tournaments_total: 0,
  gross_total: 4000,
  total_gross: 4000,
  commission_amount: 400,
  owner_income: 3600,
};

const rowValue = (card: HTMLElement, label: string) =>
  within(card).getByText(label).closest(".kv-row")?.querySelector(".v")?.textContent;

/** `n` with its digits split by an optional group separator, as a regex source. */
const grouped = (whole: string) => whole.replace(/^(\d+)(\d{3})$/, "$1\\D?$2");
const withCents = (whole: string, cents: string) => new RegExp(`^${grouped(whole)}[.,]${cents} AMD$`);
const wholeOnly = (whole: string) => new RegExp(`^${grouped(whole)} AMD$`);

describe("RevenueSummaryCard — amounts to the hundredth", () => {
  test("the three figures that must add up print their cents", () => {
    render(<RevenueSummaryCard summary={SUMMARY} />);
    const card = screen.getByRole("region", { name: "Revenue for the month" });

    expect(rowValue(card, "Total revenue")).toMatch(withCents("9000", "50"));
    expect(rowValue(card, "You owe us this period")).toMatch(withCents("900", "05"));
    expect(rowValue(card, "Owner income")).toMatch(withCents("8100", "45"));
    expect(rowValue(card, "Sessions")).toMatch(withCents("7500", "50"));
  });

  test("a whole amount on the same card prints without decimals", () => {
    render(<RevenueSummaryCard summary={SUMMARY} />);
    const card = screen.getByRole("region", { name: "Revenue for the month" });

    expect(rowValue(card, "Tournament entry fees")).toMatch(wholeOnly("1500"));
  });

  test("a month of whole figures looks exactly as it always did", () => {
    render(
      <RevenueSummaryCard
        summary={{ ...SUMMARY, sessions_total: 7500, total_gross: 9000, total_commission_amount: 900, owner_income: 8100 }}
      />,
    );
    const card = screen.getByRole("region", { name: "Revenue for the month" });

    expect(rowValue(card, "Total revenue")).toMatch(wholeOnly("9000"));
    expect(rowValue(card, "You owe us this period")).toMatch(wholeOnly("900"));
    expect(rowValue(card, "Owner income")).toMatch(wholeOnly("8100"));
  });
});

describe("BranchRevenueTable — amounts to the hundredth", () => {
  test("each cell follows its own server value: cents where it has them, none where it has not", () => {
    render(<BranchRevenueTable branches={[TUMANYAN, SAYAT_NOVA]} />);
    const table = screen.getByRole("table", { name: "By branch" });
    const [, first, second] = within(table).getAllByRole("row");
    const amounts = (row: HTMLElement) => within(row).getAllByRole("cell").map((c) => c.firstChild?.textContent);

    const [sessions, tournaments, total, commission, income] = amounts(first);
    expect(sessions).toMatch(withCents("3500", "50"));
    expect(tournaments).toMatch(wholeOnly("1500"));
    expect(total).toMatch(withCents("5000", "50"));
    expect(commission).toMatch(withCents("500", "05"));
    expect(income).toMatch(withCents("4500", "45"));

    const whole = amounts(second);
    expect(whole[0]).toMatch(wholeOnly("4000"));
    expect(whole[1]).toBe("0 AMD");
    expect(whole[2]).toMatch(wholeOnly("4000"));
    expect(whole[3]).toMatch(wholeOnly("400"));
    expect(whole[4]).toMatch(wholeOnly("3600"));
  });
});
