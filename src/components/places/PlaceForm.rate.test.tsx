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
// The branch's tariff matrix, which the modal reads to show what a seat
// inherits. Answered here so a unit test never reaches for a server.
const branch = vi.hoisted(() => ({ byId: vi.fn() }));
vi.mock("@/repositories/BranchRepository", () => ({
  branchRepository: { byId: (...a: unknown[]) => branch.byId(...a) },
}));
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
  branch.byId.mockReset();
  // An ORDINARY branch: one that prices the PlayStation seats it hands out.
  // A branch with no cell at all is a state of its own — the seat cannot be
  // billed and the form says so — and it belongs in the cases below that are
  // about exactly that, not underneath every other question this file asks.
  branch.byId.mockResolvedValue({
    id: 7,
    price_for_branch: { id: 1, branch_id: 7, "ps5-standard": 3000, "ps5-vip": 5000 },
  });
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

  /**
   * Zero is refused, and this is a correction of what this file used to claim.
   *
   * It read "a seat given away costs 0, which is a decision and not an empty
   * box" — a good intention the billing side does not implement. The session
   * price resolver takes a figure only when it is greater than zero, from the
   * seat exactly as from the matrix, so a zero here is stored, shown on this
   * screen, and then quietly not charged: the seat bills at the branch's price
   * while its own form says 0. Giving a seat away is `Free session`, which is
   * explicit, separate, and decided per session rather than per place.
   */
  test("zero is refused rather than stored as a price", async () => {
    await mount(place());
    await type(ownRate(), "0");
    await save();

    // Twice on screen after a save attempt: under the box, and in the form's
    // own error line. Both are the same sentence on purpose — one explains the
    // box, the other answers the click.
    expect(screen.getAllByText("place.zeroNotAPriceHint").length).toBeGreaterThan(0);
    expect(repo.create).not.toHaveBeenCalled();
    expect(repo.update).not.toHaveBeenCalled();
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

/**
 * The branch's default, made visible on the seat that inherits it.
 *
 * The chain is `places.hourly_rate` then the branch's tariff matrix cell for
 * this platform and tier, and the first half became editable before the second
 * half was ever shown — so "use the branch price" was a thing you did by
 * leaving a box empty, with no way to see what that price was.
 *
 * A seat with nothing to bill at is the state this screen must not produce: the
 * server refuses it, and without the warning the operator finds out at the
 * counter, on a seat they thought was finished.
 */
describe("the branch price a place inherits", () => {
  const branchWith = (cells: Record<string, number | null>) => ({
    id: 7, price_for_branch: { id: 1, branch_id: 7, ...cells },
  });

  test("a PlayStation seat shows the branch's price for its tier", async () => {
    branch.byId.mockResolvedValue(branchWith({ "ps5-standard": 3000, "ps5-vip": 5000 }));
    await mount(place());

    expect(screen.getByText("place.branchDefaultRate")).toBeTruthy();
    expect(screen.getByText("3000")).toBeTruthy();
  });

  test("…and the VIP tier shows the VIP cell", async () => {
    branch.byId.mockResolvedValue(branchWith({ "ps5-standard": 3000, "ps5-vip": 5000 }));
    await mount(place({ type: "vip" }));

    expect(screen.getByText("5000")).toBeTruthy();
  });

  /** Leaving the box empty is how a seat says "bill me at the branch price". */
  test("inheriting sends no rate at all", async () => {
    branch.byId.mockResolvedValue(branchWith({ "ps5-standard": 3000 }));
    await mount(place());
    await save();

    expect(sent().hourly_rate).toBeNull();
  });

  /** A branch with no cell for this tier cannot bill the seat. */
  test("warns when the branch has no price for this platform and tier", async () => {
    branch.byId.mockResolvedValue(branchWith({ "ps5-standard": null }));
    await mount(place());

    expect(screen.getByText("place.noBranchRateHint")).toBeTruthy();
    expect(screen.queryByText("place.branchDefaultRate")).toBeNull();
  });

  /** …and the warning goes the moment the seat carries its own price. */
  test("the warning clears once the place names a price", async () => {
    branch.byId.mockResolvedValue(branchWith({ "ps5-standard": null }));
    await mount(place());
    await type(ownRate(), "2500");

    expect(screen.queryByText("place.noBranchRateHint")).toBeNull();
  });

  /**
   * Zero is not a price: a seat resolving to nothing cannot start a paid
   * session, and giving one away is `Free session` — explicit and separate.
   */
  test("a branch cell of zero is not treated as a price", async () => {
    branch.byId.mockResolvedValue(branchWith({ "ps5-standard": 0 }));
    await mount(place());

    expect(screen.getByText("place.noBranchRateHint")).toBeTruthy();
  });

  /**
   * …and a zero TYPED INTO THE SEAT is the same absence wearing a number.
   *
   * The box accepts it, the server steps over it exactly as it steps over an
   * empty column, and the seat is then created looking finished and refused at
   * session start — which is the whole of what this warning exists to prevent.
   */
  test("a price of zero on the place is not treated as a price", async () => {
    branch.byId.mockResolvedValue(branchWith({ "ps5-standard": null }));
    await mount(place());
    await type(ownRate(), "0");

    expect(screen.getByText("place.zeroNotAPriceHint")).toBeTruthy();
  });

  /** …and the form refuses to send it rather than spending a round trip. */
  test("a seat with nothing to bill at is not submitted", async () => {
    branch.byId.mockResolvedValue(branchWith({ "ps5-standard": null }));
    await mount(place());
    await save();

    expect(repo.create).not.toHaveBeenCalled();
    expect(repo.update).not.toHaveBeenCalled();
  });

  /** A PC seat is not warned: computers are not this rule's subject. */
  test("a PC seat is never warned about the branch price", async () => {
    branch.byId.mockResolvedValue(branchWith({ "pc-standard": null }));
    await mount(place({ platform: "pc" }));

    expect(screen.queryByText("place.noBranchRateHint")).toBeNull();
  });
});
