import { Money } from "@/domain/Money";
import { RevenueReport } from "@/domain/Revenue";
import { bookingRepository } from "@/repositories/BookingRepository";
import { branchRepository } from "@/repositories/BranchRepository";
import { IBranchApi } from "@/types/api";
import { commissionStore } from "./CommissionStore";
import { BranchAveragePricing, IPricingPolicy } from "./PricingPolicy";

export interface MonthSelection {
  year: number;
  month: number; // 1..12
}

export class RevenueCalculator {
  constructor(private pricing: IPricingPolicy = new BranchAveragePricing()) {}

  async forCompanyMonth(companyId: number, sel: MonthSelection): Promise<RevenueReport> {
    const { from, to, fromIso, toIso } = monthRange(sel);
    const [bookings, branches, percent] = await Promise.all([
      bookingRepository.listAll({ company_id: companyId, date_from: from, date_to: to }),
      branchRepository.list({ company_id: companyId }),
      commissionStore.getPercent(companyId),
    ]);

    const branchById = new Map<number, IBranchApi>(branches.map((b) => [b.id, b]));
    const completed = bookings.filter((b) => b.isCompletedBy(new Date()));

    const gross = completed.reduce(
      (acc, b) => acc.add(this.pricing.priceFor(b, branchById.get(b.branchId))),
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
