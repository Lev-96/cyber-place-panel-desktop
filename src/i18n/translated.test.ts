import { describe, expect, it } from "vitest";
import { Translated, needsAttention, pickLocale, tr, trStatus } from "@/i18n/translated";
import { timePackageNameOf } from "@/i18n/timePackageName";
import { platformPriceNameOf } from "@/i18n/platformPriceName";

/**
 * Pins the read side of automatic translation.
 *
 * The invariant that matters most is the LAST fallback: a staff member who
 * creates a product and looks at the list a second later must see the name they
 * just typed, not a blank row — the translation worker has not run yet, and on
 * an older backend it never will. Every other rule here exists so a value can't
 * render populated in one client and empty in another.
 */
describe("pickLocale", () => {
  it("prefers the requested locale", () => {
    expect(pickLocale({ en: "Drinks", ru: "Напитки", am: "Ըմպելիքներ" }, "ru")).toBe("Напитки");
    expect(pickLocale({ en: "Drinks", ru: "Напитки", am: "Ըմպելիքներ" }, "am")).toBe("Ըմպելիքներ");
  });

  it("falls back en → ru → am when the requested locale is missing", () => {
    // Mid-translation state: the target locale exists as a key but is still null.
    expect(pickLocale({ en: "Drinks", ru: null, am: null }, "ru")).toBe("Drinks");
    expect(pickLocale({ en: null, ru: "Напитки", am: null }, "am")).toBe("Напитки");
    expect(pickLocale({ en: null, ru: null, am: "Ըմպելիքներ" }, "en")).toBe("Ըմպելիքներ");
  });

  it("treats blank and whitespace-only values as missing", () => {
    // A blank column must not win over a populated fallback — otherwise the
    // panel shows an empty label while the data is right there.
    expect(pickLocale({ en: "Drinks", ru: "   ", am: "" }, "ru")).toBe("Drinks");
  });

  it("returns undefined when the bag has nothing at all", () => {
    expect(pickLocale({ en: null, ru: null, am: null }, "en")).toBeUndefined();
    expect(pickLocale(undefined, "en")).toBeUndefined();
    expect(pickLocale(null, "en")).toBeUndefined();
  });
});

describe("tr", () => {
  // Mirrors the shape of a real auto-translated entity (IProduct & friends all
  // `extends Translated`). Declared explicitly because `Translated` is an
  // all-optional "weak" type — a bare object literal with none of its keys is
  // rejected by TS, which is exactly the check that keeps `tr` from being
  // called on entities that never carry an i18n bag.
  type Fixture = Translated & { id: number; name?: string; category?: string };

  const product: Fixture = {
    id: 1,
    name: "Кола",
    category: "Напитки",
    i18n: {
      name: { en: "Coke", ru: "Кола", am: "Կոլա" },
      category: { en: "Drinks", ru: "Напитки", am: null },
    },
  };

  it("resolves the active language", () => {
    expect(tr(product, "name", "en")).toBe("Coke");
    expect(tr(product, "name", "am")).toBe("Կոլա");
  });

  it("falls back within the bag before touching the raw column", () => {
    expect(tr(product, "category", "am")).toBe("Drinks");
  });

  it("falls back to the raw column when there is no bag yet", () => {
    // The critical case: a row created a second ago, before the worker ran.
    const fresh: Fixture = { id: 2, name: "Новый товар", i18n: undefined };
    expect(tr(fresh, "name", "en")).toBe("Новый товар");
  });

  it("falls back to the raw column on a backend that predates the pipeline", () => {
    const legacy: Fixture = { id: 3, name: "Старый товар", i18n: null };
    expect(tr(legacy, "name", "am")).toBe("Старый товар");
  });

  it("never returns undefined", () => {
    // Render sites interpolate this straight into JSX — "undefined" on screen
    // is worse than an empty string.
    expect(tr<Fixture>(null, "name", "en")).toBe("");
    expect(tr<Fixture>(undefined, "name", "en")).toBe("");
    expect(tr<Fixture>({ id: 4, i18n: null }, "name", "en")).toBe("");
  });
});

describe("status helpers", () => {
  const entity: Translated & { id: number; name: string } = {
    id: 1,
    name: "x",
    i18n_status: { name: "failed" },
  };

  it("reads the per-field status", () => {
    expect(trStatus(entity, "name")).toBe("failed");
    expect(trStatus(entity, "missing" as "name")).toBeUndefined();
  });

  it("flags only states a human has to resolve", () => {
    // `stale` and `pending` resolve themselves — badging them would train staff
    // to ignore the indicator that actually matters.
    expect(needsAttention("failed")).toBe(true);
    expect(needsAttention("needs_review")).toBe(true);
    expect(needsAttention("stale")).toBe(false);
    expect(needsAttention("pending")).toBe(false);
    expect(needsAttention("ready")).toBe(false);
    expect(needsAttention(undefined)).toBe(false);
  });
});

describe("legacy three-column resolvers", () => {
  // Tariffs and platform prices still ship name_en/name_ru/name_am. They now
  // delegate to pickLocale, so migrating them onto the i18n bag later cannot
  // change what staff see — these assertions are the proof.
  it("timePackageNameOf follows the shared fallback chain", () => {
    const pkg = { name_en: "1 hour", name_ru: "", name_am: "" };
    expect(timePackageNameOf(pkg, "ru")).toBe("1 hour");
    expect(timePackageNameOf({ name_en: "", name_ru: "", name_am: "" }, "en")).toBe("");
  });

  it("platformPriceNameOf follows the shared fallback chain", () => {
    const price = { name_en: "", name_ru: "Настольный теннис", name_am: "" };
    expect(platformPriceNameOf(price, "am")).toBe("Настольный теннис");
  });
});
