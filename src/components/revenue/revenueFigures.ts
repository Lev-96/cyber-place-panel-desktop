import type { IBranchRevenueSummary, ICompanyRevenueSummary } from "@/api/billing";

/**
 * What the revenue card prints, one field per row, each one of the server's
 * keys as it arrived. This module only PICKS keys; it never adds, subtracts or
 * multiplies. A second copy of a server formula (owner income as "total minus
 * commission") would drift from the server the first time its rounding
 * changes, and the card is read as a statement.
 */
export interface RevenueFigures {
  sessionsCount: number;
  sessionsTotal: number;
  posTotal: number;
  /** Null on a backend older than tournament fees: the two rows are left out, not zeroed. */
  tournaments: { count: number; total: number } | null;
  totalRevenue: number;
  commissionPercent: number;
  /** What Cyber Place is owed for the period (the highlighted row). */
  owed: number;
  /** Null on an older backend: the row is left out, never derived. */
  ownerIncome: number | null;
}

/**
 * The company's month. The keys added with tournament fees are missing on an
 * older backend; each then falls back to the key that meant the same thing
 * before tournament fees existed (`gross_total` WAS the whole takings and
 * `commission_amount` WAS what was owed), or its row is left out.
 */
export const companyFigures = (s: ICompanyRevenueSummary): RevenueFigures => ({
  sessionsCount: s.sessions_count ?? 0,
  sessionsTotal: s.sessions_total,
  posTotal: s.pos_total,
  tournaments:
    s.tournaments_count != null && s.tournaments_total != null
      ? { count: s.tournaments_count, total: s.tournaments_total }
      : null,
  totalRevenue: s.total_gross ?? s.gross_total,
  commissionPercent: s.commission_percent,
  owed: s.total_commission_amount ?? s.commission_amount,
  ownerIncome: s.owner_income ?? null,
});

/**
 * One branch's month, from its row in the same response. The branch's
 * `commission_amount` is the commission on its `total_gross` (tournaments
 * included), charged at the company's rate, which is why the rate printed
 * beside it is the company's `commission_percent`: a branch has no rate of
 * its own. The branch rows always carry the tournament keys.
 */
export const branchFigures = (b: IBranchRevenueSummary, commissionPercent: number): RevenueFigures => ({
  sessionsCount: b.sessions_count,
  sessionsTotal: b.sessions_total,
  posTotal: b.pos_total,
  tournaments: { count: b.tournaments_count, total: b.tournaments_total },
  totalRevenue: b.total_gross,
  commissionPercent,
  owed: b.commission_amount,
  ownerIncome: b.owner_income,
});

/** A branch as the selector and the card title name it; a null address is still identifiable. */
export const branchLabel = (b: IBranchRevenueSummary): string => b.address || `№${b.branch_id}`;

/**
 * The branches worth offering as a choice. None when the response has no list
 * (an older backend) or a single branch: one branch IS the company, and a
 * selector with one entry beside "All branches" would offer the same figures
 * twice.
 */
export const selectableBranches = (s: ICompanyRevenueSummary | null): IBranchRevenueSummary[] => {
  const list = s?.branches ?? [];
  return list.length > 1 ? list : [];
};
