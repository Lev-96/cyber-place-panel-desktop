import type { IBranchRevenueSummary, ICompanyRevenueSummary } from "@/api/billing";
import { describe, expect, test } from "vitest";
import { branchFigures, branchLabel, companyFigures, selectableBranches } from "./revenueFigures";

/**
 * The revenue card's rows, picked from the server's keys. Fixture figures are
 * deliberately inconsistent with each other (owner income is NOT total minus
 * commission), so a mapping that computes anything lands on a different
 * number and fails.
 */

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

const BRANCH: IBranchRevenueSummary = {
  branch_id: 4,
  address: "Abovyan 1",
  sessions_count: 3,
  sessions_total: 2734.81,
  pos_total: 250.5,
  tournaments_count: 2,
  tournaments_total: 2000,
  gross_total: 2985.31,
  total_gross: 4985.31,
  commission_amount: 373.9,
  owner_income: 4600,
};

describe("companyFigures", () => {
  test("the current backend: each row is its key", () => {
    const f = companyFigures({
      ...LEGACY,
      tournaments_count: 3,
      tournaments_total: 3500,
      total_gross: 7618.79,
      total_commission_amount: 571.41,
      owner_income: 7000,
    });

    expect(f).toEqual({
      sessionsCount: 5,
      sessionsTotal: 3768.24,
      posTotal: 350.55,
      tournaments: { count: 3, total: 3500 },
      totalRevenue: 7618.79,
      commissionPercent: 7.5,
      owed: 571.41,
      ownerIncome: 7000,
    });
  });

  test("an older backend: the pre-tournament keys, and no row invented", () => {
    expect(companyFigures(LEGACY)).toEqual({
      sessionsCount: 5,
      sessionsTotal: 3768.24,
      posTotal: 350.55,
      tournaments: null,
      totalRevenue: 4118.79,
      commissionPercent: 7.5,
      owed: 308.91,
      ownerIncome: null,
    });
  });
});

describe("branchFigures", () => {
  test("each row is the branch's own key; the rate is the company's", () => {
    expect(branchFigures(BRANCH, 7.5)).toEqual({
      sessionsCount: 3,
      sessionsTotal: 2734.81,
      posTotal: 250.5,
      tournaments: { count: 2, total: 2000 },
      totalRevenue: 4985.31,
      commissionPercent: 7.5,
      owed: 373.9,
      ownerIncome: 4600,
    });
  });
});

describe("branchLabel", () => {
  test("the address, or the id when there is none", () => {
    expect(branchLabel(BRANCH)).toBe("Abovyan 1");
    expect(branchLabel({ ...BRANCH, address: null })).toBe("№4");
    expect(branchLabel({ ...BRANCH, address: "" })).toBe("№4");
  });
});

describe("selectableBranches", () => {
  test.each<[string, ICompanyRevenueSummary | null, number]>([
    ["no response", null, 0],
    ["an older backend without the list", LEGACY, 0],
    ["an empty list", { ...LEGACY, branches: [] }, 0],
    ["one branch", { ...LEGACY, branches: [BRANCH] }, 0],
    ["two branches", { ...LEGACY, branches: [BRANCH, { ...BRANCH, branch_id: 5 }] }, 2],
  ])("%s", (_case, response, count) => {
    expect(selectableBranches(response)).toHaveLength(count);
  });
});
