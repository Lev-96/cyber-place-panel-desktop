export class Money {
  constructor(readonly amount: number, readonly currency: string = "AMD") {}

  static zero(currency = "AMD"): Money {
    return new Money(0, currency);
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(round2(this.amount + other.amount), this.currency);
  }

  multiply(factor: number): Money {
    return new Money(round2(this.amount * factor), this.currency);
  }

  percent(percent: number): Money {
    return this.multiply(percent / 100);
  }

  format(locale = "en-US"): string {
    return new Intl.NumberFormat(locale, {
      style: "decimal",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(this.amount) + " " + this.currency;
  }

  private assertSameCurrency(other: Money) {
    if (other.currency !== this.currency) throw new Error("currency mismatch");
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100;
