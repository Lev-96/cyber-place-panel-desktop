// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { IBranchPlace, IBranchPlatformPrice } from "@/types/api";

/**
 * A place's own price per hour.
 *
 * ## What it is, and what it is not
 *
 * The server has always resolved a seat's rate in this order — the place's own
 * `hourly_rate`, then the branch's tariff matrix cell for its platform and tier
 * (`ResolveSessionRateService`). The first half of that chain had no control in
 * the panel: a PlayStation or a PC billed from the matrix and there was nowhere
 * to say "this seat costs more". This box is that nowhere filled in.
 *
 * ## The rule that keeps it from becoming a second price
 *
 * The form already asks for a rate in two cases, and in both of them the box on
 * screen IS this place's rate: an unpriced sub-category, and a custom platform
 * whose tier has no price yet. Showing a second one there would be two fields
 * for one number, so it is shown everywhere ELSE and only there.
 *
 * Empty means inherit, which is what every place is on and what keeps this
 * addition invisible to every seat nobody edits.
 */

const repo = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn(), nextNumber: vi.fn() }));
vi.mock("@/repositories/PlaceRepository", () => ({
  placeRepository: {
    create: (...a: unknown[]) => repo.create(...a),
    update: (...a: unknown[]) => repo.update(...a),
    nextNumber: (...a: unknown[]) => repo.nextNumber(...a),
  },
}));
vi.mock("@/repositories/GameRepository", () => ({ gameRepository: { list: async () => [] } }));
vi.mock("@/repositories/SubplatformRepository", () => ({
  subplatformRepository: {
    listByPlatform: async () => [
      { id: 1, name_en: "Default", name_ru: "Default", name_am: "Default", is_default: true, price_standard: null, price_vip: null },
    ],
  },
}));
vi.mock("@/api/translations", () => ({ apiSaveEntityTranslations: vi.fn() }));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: { id: 1, role: "company_owner" } }) }));
vi.mock("@/ui/notify", () => ({ notify: { message: vi.fn() } }));
vi.mock("@/i18n/LanguageContext", () => ({
  useLang: () => ({ t: (k: string) => k, money: (n: number) => String(n), currency: "AMD", lang: "ru" }),
}));
vi.mock("@/components/ui/Modal", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/ui/MultiLangInput", () => ({
  default: () => null,
  langValuesFromField: () => ({ en: "", ru: "", am: "" }),
  primaryValue: () => "Seat",
}));
vi.mock("@/components/ui/SubplatformTabs", () => ({ default: () => null }));

import PlaceForm from "./PlaceForm";

const place = (over: Partial<IBranchPlace> = {}): IBranchPlace => ({
  id: 12, branch_id: 7, number: 3, name: "Seat 3", type: "standard",
  status: "active", platform: "ps5", subplatform_id: 1, games: [], ...over,
});

let dom: HTMLElement;

const mount = async (initial?: IBranchPlace, platformPrices: IBranchPlatformPrice[] = []) => {
  await act(async () => {
    const r = render(
      <PlaceForm branchId={7} initial={initial} platformPrices={platformPrices}
        onClose={() => {}} onSaved={() => {}} />,
    );
    dom = r.container;
  });
};

/** The box under a given label, so two prices on one form stay told apart. */
const boxFor = (label: string): HTMLInputElement | null => {
  const heading = [...dom.querySelectorAll("span.label")].find((el) => el.textContent === label);
  return heading?.parentElement?.querySelector<HTMLInputElement>('input[inputmode="decimal"]') ?? null;
};
const ownRate = () => {
  const box = boxFor("place.ownRate");
  expect(box, "the place's own rate box is not on screen").toBeTruthy();
  return box!;
};
const type = async (box: HTMLInputElement, v: string) => {
  await act(async () => { fireEvent.change(box, { target: { value: v } }); });
};
const save = async () => {
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "action.save" })); });
};
const sent = () => (repo.update.mock.calls[0]?.[1] ?? repo.create.mock.calls[0]?.[0]) as Record<string, unknown>;

beforeEach(() => {
  repo.create.mockReset(); repo.update.mockReset(); repo.nextNumber.mockReset();
  repo.create.mockResolvedValue({ id: 12 });
  repo.update.mockResolvedValue({ id: 12 });
  repo.nextNumber.mockResolvedValue(3);
});
afterEach(cleanup);

describe("a place's own price per hour", () => {
  test("a known platform is offered the box, empty by default", async () => {
    await mount(place());

    expect(ownRate().value).toBe("");
  });

  /** Editable when the place is being created, too — there is no row yet. */
  test("a place being created is offered it as well", async () => {
    await mount();

    expect(ownRate()).toBeTruthy();
  });

  test("left empty it sends null, which is the price above applying", async () => {
    await mount(place());
    await save();

    expect(sent().hourly_rate).toBeNull();
  });

  test("a typed figure travels as a number, for this place only", async () => {
    await mount(place());
    await type(ownRate(), "2500");
    await save();

    expect(sent().hourly_rate).toBe(2500);
  });

  /** A seat given away costs 0, which is a decision and not an empty box. */
  test("zero is a price and not inherit", async () => {
    await mount(place());
    await type(ownRate(), "0");
    await save();

    expect(sent().hourly_rate).toBe(0);
  });

  test("a saved price comes back in the box", async () => {
    await mount(place({ hourly_rate: 1800 }));

    expect(ownRate().value).toBe("1800");
  });

  /** …and survives a round trip untouched, so opening a place cannot lose it. */
  test("opening and saving without touching it keeps the price", async () => {
    await mount(place({ hourly_rate: 1800 }));
    await save();

    expect(sent().hourly_rate).toBe(1800);
  });

  /**
   * The custom-platform flow is untouched: there the box that exists already
   * prices the PLATFORM, and a second one would be two fields for one number.
   */
  test("a brand-new custom platform is not given a second price box", async () => {
    await mount(place({ platform: "table-tennis" }));

    expect(boxFor("place.ownRate")).toBeNull();
  });

  /** A custom platform whose tier IS priced keeps that figure and gains the box. */
  test("a locked custom tier keeps sending its platform's figure", async () => {
    await mount(
      place({ platform: "table-tennis" }),
      [{ id: 3, branch_id: 7, platform: "table-tennis", name_en: "Table Tennis",
         name_ru: "Настольный теннис", name_am: "Սեղանի թենիս",
         price_standard: 900, price_vip: null } as IBranchPlatformPrice],
    );
    await save();

    expect(sent().hourly_rate).toBe(900);
  });

  test("…and its own price beats that figure when one is typed", async () => {
    await mount(
      place({ platform: "table-tennis" }),
      [{ id: 3, branch_id: 7, platform: "table-tennis", name_en: "Table Tennis",
         name_ru: "Настольный теннис", name_am: "Սեղանի թենիս",
         price_standard: 900, price_vip: null } as IBranchPlatformPrice],
    );
    await type(ownRate(), "1200");
    await save();

    expect(sent().hourly_rate).toBe(1200);
  });
});
