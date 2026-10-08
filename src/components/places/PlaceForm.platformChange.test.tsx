// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { IBranchPlace, IBranchPlatformPrice } from "@/types/api";

/**
 * Changing a place's platform, and what it must not drag along.
 *
 * On edit the rate boxes open holding the place's stored `hourly_rate` — the
 * price of the OLD platform. Carried over unchanged, a PS5 seat moved to PS4
 * would be saved with its PS5 figure as the PS4 seat's own override, and the
 * PS4 branch price would never apply. Picking another platform empties the
 * boxes; what the operator types after the switch is theirs and is kept.
 *
 * And the inline "+ Create game" must not be offered while the platform is
 * still empty ("Other", nothing named yet): there is no platform to put the
 * game on.
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
// GameForm itself is covered by GameForm.test.tsx; here only whether it opens.
vi.mock("@/components/games/GameForm", () => ({ default: () => null }));
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

const ownRate = () => {
  const heading = [...dom.querySelectorAll("span.label")].find((el) => el.textContent === "place.ownRate");
  const box = heading?.parentElement?.querySelector<HTMLInputElement>('input[inputmode="decimal"]');
  expect(box, "the place's own rate box is not on screen").toBeTruthy();
  return box!;
};
const type = async (box: HTMLInputElement, v: string) => {
  await act(async () => { fireEvent.change(box, { target: { value: v } }); });
};
const pick = async (label: string) => {
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: label })); });
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
  branch.byId.mockResolvedValue({
    id: 7,
    price_for_branch: { id: 1, branch_id: 7, "pc-standard": 800, "ps4-standard": 2000, "ps5-standard": 3000 },
  });
});
afterEach(cleanup);

describe("switching the platform of a place", () => {
  test("drops the old platform's rate so the new platform's own price applies", async () => {
    await mount(place({ hourly_rate: 1800 }));
    expect(ownRate().value).toBe("1800");

    await pick("PS4");
    expect(ownRate().value).toBe("");
    await save();

    expect(sent().platform).toBe("ps4");
    expect(sent().hourly_rate).toBeNull();
  });

  test("keeps a figure typed after the switch", async () => {
    await mount(place({ hourly_rate: 1800 }));
    await pick("PS4");
    await type(ownRate(), "2200");
    await save();

    expect(sent().hourly_rate).toBe(2200);
  });

  test("going back to the stored platform restores the stored figure", async () => {
    await mount(place({ hourly_rate: 1800 }));
    await pick("PS4");
    await pick("PS5");

    expect(ownRate().value).toBe("1800");
  });

  test("re-picking the same platform changes nothing", async () => {
    await mount(place({ hourly_rate: 1800 }));
    await pick("PS5");

    expect(ownRate().value).toBe("1800");
  });

  /** Create and edit behave alike: a figure typed for PC does not follow the seat to PS5. */
  test("on create, too", async () => {
    await mount();
    await type(ownRate(), "2500");
    await pick("PS5");

    expect(ownRate().value).toBe("");
  });
});

describe("creating a game from the place form", () => {
  test("is offered on a real platform", async () => {
    await mount(place());

    expect(screen.getByRole("button", { name: "place.createGame" })).toBeTruthy();
  });

  test("is not offered while the platform is still empty", async () => {
    await mount(place());
    await pick("platform.other");
    await act(async () => { fireEvent.click(screen.getByText("place.hasGames")); });

    // The games block is open (its counter is drawn) — only the button is withheld.
    expect(screen.getByText(/place.selected/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "place.createGame" })).toBeNull();
  });
});
