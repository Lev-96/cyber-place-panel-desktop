import { Money } from "./Money";

export class RevenueReport {
  constructor(
    readonly companyId: number,
    readonly periodFrom: Date,
    readonly periodTo: Date,
    readonly grossRevenue: Money,
    readonly commissionPercent: number,
    readonly bookingsCount: number,
  ) {}

  amountDue(): Money {
    return this.grossRevenue.percent(this.commissionPercent);
  }
}
