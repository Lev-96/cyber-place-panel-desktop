import { Booking } from "@/domain/Booking";
import { Money } from "@/domain/Money";
import { RevenueReport } from "@/domain/Revenue";
import { bookingRepository } from "@/repositories/BookingRepository";
import { branchRepository } from "@/repositories/BranchRepository";
import { IBranchApi } from "@/types/api";
import { commissionStore, CommissionStore } from "./CommissionStore";
import { BranchAveragePricing, IPricingPolicy } from "./PricingPolicy";

export interface MonthSelection {
  year: number;
  month: number; // 1..12
}

/** Ports — the calculator depends on these abstractions, not concrete singletons. */
export interface IBookingsSource {
  listAll(params: { company_id?: number; date_from?: string; date_to?: string }): Promise<Booking[]>;
}
export interface IBranchesSource {
  list(params: { company_id?: number }): Promise<IBranchApi[]>;
}

export interface RevenueDeps {
  bookings: IBookingsSource;
  branches: IBranchesSource;
  commissions: Pick<CommissionStore, "getPercent">;
  pricing: IPricingPolicy;
  now: () => Date;
}

export class RevenueCalculator {
  private deps: RevenueDeps;

  constructor(deps: Partial<RevenueDeps> = {}) {
    this.deps = {
      bookings: deps.bookings ?? bookingRepository,
      branches: deps.branches ?? branchRepository,
      commissions: deps.commissions ?? commissionStore,
      pricing: deps.pricing ?? new BranchAveragePricing(),
      now: deps.now ?? (() => new Date()),
    };
  }

  async forCompanyMonth(companyId: number, sel: MonthSelection, percentOverride?: number): Promise<RevenueReport> {
    const { from, to, fromIso, toIso } = monthRange(sel);
    const [bookings, branches, storedPercent] = await Promise.all([
      this.deps.bookings.listAll({ company_id: companyId, date_from: from, date_to: to }),
      this.deps.branches.list({ company_id: companyId }),
      this.deps.commissions.getPercent(companyId),
    ]);
    const percent = percentOverride != null && Number.isFinite(percentOverride) ? percentOverride : storedPercent;

    const branchById = new Map<number, IBranchApi>(branches.map((b) => [b.id, b]));
    const now = this.deps.now();
    const completed = bookings.filter((b) => b.isCompletedBy(now));

    const gross = completed.reduce(
      (acc, b) => acc.add(this.deps.pricing.priceFor(b, branchById.get(b.branchId))),
      Money.zero(),
    );

    return new RevenueReport(companyId, fromIso, toIso, gross, percent, completed.length);
  }
}

const monthRange = ({ year, month }: MonthSelection) => {
  const fromIso = new Date(Date.UTC(year, month - 1, 1));
  const toIso = new Date(Date.UTC(year, month, 0, 23, 59, 59));
  const fmt = (d: Date) =>
    `${pad(d.getUTCDate())}-${pad(d.getUTCMonth() + 1)}-${d.getUTCFullYear()}`;
  return { from: fmt(fromIso), to: fmt(toIso), fromIso, toIso };
};
const pad = (n: number) => String(n).padStart(2, "0");

export const revenueCalculator = new RevenueCalculator();
