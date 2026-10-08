// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { IBranchPlatformPrice } from "@/types/api";
import type { ITimePackage } from "@/types/sessions";

/**
 * Which platform a tariff can target.
 *
 * It was a closed pc/ps4/ps5 list, so a branch with a billiards table could
 * sell it a tariff only as "All platforms". The backend now takes any slug;
 * the form offers the branch's own custom platforms — the same rows Branch →
 * Prices and the place form read — by their name in the operator's language.
 */

const repo = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn() }));
vi.mock("@/repositories/TimePackageRepository", () => ({
  timePackageRepository: {
    create: (...a: unknown[]) => repo.create(...a),
    update: (...a: unknown[]) => repo.update(...a),
  },
}));
vi.mock("@/i18n/LanguageContext", () => ({
  useLang: () => ({ t: (k: string) => k, lang: "ru", currency: "AMD" }),
}));
vi.mock("@/components/ui/Modal", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
// Names are a component of their own; filled in so the form can submit.
vi.mock("@/components/ui/MultiLangInput", () => ({
  default: () => null,
  hasAnyValue: () => true,
  langValuesFrom: () => ({ en: "Hour", ru: "Час", am: "Ժամ" }),
}));

import PackageForm from "./PackageForm";

const billiards = {
  id: 3, branch_id: 7, platform: "billiards", name_en: "Billiards", name_ru: "Бильярд", name_am: "Բիլիարդ",
  name: "Billiards", price_standard: 1500, price_vip: null,
} as IBranchPlatformPrice;

const mount = async (initial?: ITimePackage, prices: IBranchPlatformPrice[] = [billiards]) => {
  await act(async () => {
    render(<PackageForm branchId={7} initial={initial} platformPrices={prices} onClose={() => {}} onSaved={() => {}} />);
  });
};
const select = () => document.querySelector("select")!;
/** A new tariff needs a price before the browser lets the form submit. */
const priced = async () => {
  const box = document.querySelector<HTMLInputElement>('input[inputmode="decimal"]')!;
  await act(async () => { fireEvent.change(box, { target: { value: "1500" } }); });
};
const options = () => [...select().querySelectorAll("option")].map((o) => [o.value, o.textContent]);

beforeEach(() => {
  repo.create.mockReset().mockResolvedValue({ id: 1 });
  repo.update.mockReset().mockResolvedValue({ id: 1 });
});
afterEach(cleanup);

describe("a tariff's platform", () => {
  test("offers All, the three known platforms and the branch's custom ones, translated", async () => {
    await mount();

    expect(options()).toEqual([
      ["", "tariff.platformAll"], ["pc", "PC"], ["ps4", "PS4"], ["ps5", "PS5"], ["billiards", "Бильярд"],
    ]);
  });

  test("a custom platform is sent as its slug", async () => {
    await mount();
    await priced();
    await act(async () => { fireEvent.change(select(), { target: { value: "billiards" } }); });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "action.save" })); });

    expect(repo.create.mock.calls[0][0]).toMatchObject({ branch_id: 7, platform: "billiards" });
  });

  test("All platforms is still null", async () => {
    await mount();
    await priced();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "action.save" })); });

    expect(repo.create.mock.calls[0][0]).toMatchObject({ platform: null });
  });

  /** A tariff on a slug the branch no longer prices keeps it, instead of being re-targeted. */
  test("editing a tariff on an unlisted slug keeps that slug selected", async () => {
    await mount(
      { id: 9, name_en: "Hour", name_ru: "Час", name_am: "Ժամ", duration_minutes: 60, price: 1000, platform: "table-tennis" },
      [],
    );

    expect(select().value).toBe("table-tennis");
    expect(options()).toContainEqual(["table-tennis", "Table Tennis"]);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "action.save" })); });
    expect(repo.update.mock.calls[0][1]).toMatchObject({ platform: "table-tennis" });
  });
});
