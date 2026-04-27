import { Booking } from "@/domain/Booking";
import { Money } from "@/domain/Money";
import { IBranchApi } from "@/types/api";

export interface IPricingPolicy {
  priceFor(booking: Booking, branch?: IBranchApi): Money;
}

export class BranchAveragePricing implements IPricingPolicy {
  priceFor(booking: Booking, branch?: IBranchApi): Money {
    const rate = this.hourlyRate(booking, branch);
    return new Money(rate * booking.durationHours() * booking.placeCount);
  }

  private hourlyRate(booking: Booking, branch?: IBranchApi): number {
    const prices = branch?.price_for_branch;
    if (!prices) return 0;
    const platform = booking.platform || "";
    const candidates = [`${platform}-vip`, `${platform}-standard`] as const;
    const values = candidates
      .map((k) => prices[k as keyof typeof prices])
      .filter((v): v is number => typeof v === "number");
    if (!values.length) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }
}
