// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { IBranchPlace, IBranchPlatformPrice } from "@/types/api";

/**
 * A name typed under "Other" that IS an existing platform selects it
 * (2026-10-11). Before, the form already sent that platform's slug, but the
 * picker stayed on Other — and a custom platform typed by its name in the
 * panel language (not its slug) was forked into a duplicate.
 */

const repo = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn(), nextNumber: vi.fn() }));
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
vi.mock("@/components/games/GameForm", () => ({ default: () => null }));
vi.mock("@/repositories/SubplatformRepository", () => ({
  subplatformRepository: {
    listByPlatform: async () => [
      { id: 1, name_en: "Default", name_ru: "Default", name_am: "Default", is_default: true, price_standard: null, price_vip: null },
    ],
  },
}));
// The translation the name box asks for, answered when a test says so.
const translation = vi.hoisted(() => ({ preview: vi.fn() }));
vi.mock("@/api/translations", () => ({
  apiSaveEntityTranslations: vi.fn(),
  apiPreviewTranslation: (...a: unknown[]) => translation.preview(...a),
}));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: { id: 1, role: "company_owner" } }) }));
vi.mock("@/ui/notify", () => ({ notify: { message: vi.fn() } }));
const ui = vi.hoisted(() => ({ lang: "en" as "en" | "ru" | "am" }));
vi.mock("@/i18n/LanguageContext", () => ({
  useLang: () => ({ t: (k: string) => k, money: (n: number) => String(n), currency: "AMD", lang: ui.lang }),
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

import { __clearAutoTranslateCache } from "@/i18n/useAutoTranslate";
import PlaceForm from "./PlaceForm";

const pool = {
  id: 3, branch_id: 7, platform: "billiards", name_en: "Pool table", name_ru: "Бильярд", name_am: "Բիլյարդ",
  name: "Pool table", price_standard: 2000, price_vip: null,
} as IBranchPlatformPrice;

const place = (over: Partial<IBranchPlace> = {}): IBranchPlace => ({
  id: 12, branch_id: 7, number: 3, name: "Seat 3", type: "standard",
  status: "active", platform: "ps5", subplatform_id: 1, games: [], ...over,
});

let rerender: (prices: IBranchPlatformPrice[]) => Promise<void>;
const mount = async (initial?: IBranchPlace, prices: IBranchPlatformPrice[] = [], suggestions: string[] = []) => {
  const ui = (p: IBranchPlatformPrice[]) => (
    <PlaceForm branchId={7} initial={initial} platformPrices={p} platformSuggestions={suggestions}
      onClose={() => {}} onSaved={() => {}} />
  );
  await act(async () => {
    const r = render(ui(prices));
    rerender = async (next) => { await act(async () => { r.rerender(ui(next)); }); };
  });
};

const LANG_LABEL = { en: "English", ru: "Русский", am: "Հայերեն" } as const;
const nameBox = () => screen.queryByPlaceholderText(`platformName.placeholder · ${LANG_LABEL[ui.lang]}`) as HTMLInputElement | null;
const typeName = async (v: string) => {
  const box = nameBox();
  expect(box, "the new platform's name box is not on screen").toBeTruthy();
  await act(async () => { fireEvent.change(box!, { target: { value: v } }); });
};
const click = async (label: string) => {
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: label })); });
};
const pressed = () => screen.getAllByRole("button", { pressed: true }).map((b) => b.textContent);
const save = async () => {
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "action.save" })); });
};
const sent = () => (repo.update.mock.calls[0]?.[1] ?? repo.create.mock.calls[0]?.[0]) as Record<string, unknown>;
const rateBox = () => {
  const heading = [...document.querySelectorAll("span.label")].find((el) => el.textContent?.startsWith("place.hourlyRate"));
  return heading?.parentElement?.querySelector<HTMLInputElement>("input") ?? null;
};

beforeEach(() => {
  ui.lang = "en";
  repo.create.mockReset(); repo.update.mockReset(); repo.nextNumber.mockReset();
  repo.create.mockResolvedValue({ id: 12 });
  repo.update.mockResolvedValue({ id: 12 });
  repo.nextNumber.mockResolvedValue(3);
  branch.byId.mockReset();
  branch.byId.mockResolvedValue({
    id: 7,
    price_for_branch: { id: 1, branch_id: 7, "pc-standard": 800, "ps4-standard": 2000, "ps5-standard": 3000 },
  });
  translation.preview.mockReset();
  translation.preview.mockImplementation(() => new Promise(() => {}));
});
afterEach(() => { cleanup(); __clearAutoTranslateCache(); });

describe("a name typed under Other", () => {
  test("PC selects PC: the picker leaves Other, the name box goes, PC is saved", async () => {
    await mount();
    await click("platform.other");
    await typeName("PC");

    expect(pressed()).toEqual(["PC"]);
    expect(nameBox()).toBeNull();
    await save();
    expect(sent()).toMatchObject({ platform: "pc", platform_name_en: undefined });
  });

  test("any case, with stray spaces, is the same PC — never a duplicate", async () => {
    for (const typed of ["pc", " PC "]) {
      await mount();
      await click("platform.other");
      await typeName(typed);
      expect(pressed()).toEqual(["PC"]);
      cleanup();
    }
  });

  test("a custom platform by its name selects that platform with its existing price", async () => {
    await mount(undefined, [pool]);
    await click("platform.other");
    await typeName("pool table");

    expect(pressed()).toEqual(["Pool table"]);
    expect(screen.queryByText("place.customPlatformNote")).toBeNull();
    await save();
    expect(sent()).toMatchObject({ platform: "billiards", hourly_rate: 2000, platform_name_en: undefined });
  });

  test("in the panel language, by its Russian name", async () => {
    ui.lang = "ru";
    await mount(undefined, [pool]);
    await click("platform.other");
    await typeName("Бильярд");

    expect(pressed()).toEqual(["Бильярд"]);
  });

  test("a new name stays on Other and creates that platform as before", async () => {
    await mount(undefined, [pool]);
    await click("platform.other");
    await typeName("Steam Deck");

    expect(pressed()).toEqual(["platform.other"]);
    expect(nameBox()!.value).toBe("Steam Deck");
    await act(async () => { fireEvent.change(rateBox()!, { target: { value: "1500" } }); });
    await save();
    expect(sent()).toMatchObject({ platform: "steam-deck", platform_name_en: "Steam Deck", hourly_rate: 1500 });
  });

  test("a partial name selects nothing", async () => {
    await mount();
    await click("platform.other");
    await typeName("PS");

    expect(pressed()).toEqual(["platform.other"]);
  });

  test("clearing the name keeps Other with nothing chosen", async () => {
    await mount();
    await click("platform.other");
    await typeName("Steam");
    await typeName("");

    expect(pressed()).toEqual(["platform.other"]);
    await save();
    expect(repo.create).not.toHaveBeenCalled();
  });

  test("back to Other after a match starts a clean name, and PS5 after it is PS5", async () => {
    await mount();
    await click("platform.other");
    await typeName("PC");
    await click("platform.other");

    expect(pressed()).toEqual(["platform.other"]);
    expect(nameBox()!.value).toBe("");
    await typeName("PS4");
    expect(pressed()).toEqual(["PS4"]);
    await click("PS5");
    expect(pressed()).toEqual(["PS5"]);
    await save();
    expect(sent()).toMatchObject({ platform: "ps5" });
  });

  test("platforms that load after the name was typed still catch it", async () => {
    await mount(undefined, []);
    await click("platform.other");
    await typeName("Pool table");
    expect(pressed()).toEqual(["platform.other"]);

    await rerender([pool]);
    expect(pressed()).toEqual(["Pool table"]);
  });

  test("a failed platform read selects nothing it does not know", async () => {
    await mount(undefined, []);
    await click("platform.other");
    await typeName("Pool table");
    await rerender([]);

    expect(pressed()).toEqual(["platform.other"]);
  });

  test("a translation landing after the match does not re-target the platform", async () => {
    ui.lang = "ru";
    let answer!: (v: unknown) => void;
    translation.preview.mockImplementationOnce(() => new Promise((r) => { answer = r; }));
    await mount(undefined, [pool]);
    await click("platform.other");
    await typeName("Бильяр");
    await act(async () => { fireEvent.blur(nameBox()!); }); // the request is now in flight
    await typeName("Бильярд");
    expect(pressed()).toEqual(["Бильярд"]);
    await click("PC");

    await act(async () => { answer({ translations: { en: "Billiard", am: "" }, failed: [] }); });
    expect(pressed()).toEqual(["PC"]);
  });
});

describe("editing a place", () => {
  test("a list that arrives late never re-targets the stored platform", async () => {
    const lookalike = { ...pool, id: 9, platform: "old-room-2", name_en: "Old Room" } as IBranchPlatformPrice;
    // A place on an unpriced custom slug opens with its name seeded ("Old Room");
    // a price row of that name for ANOTHER slug must not capture it.
    await mount(place({ platform: "old-room", hourly_rate: 1500, subplatform_id: null }), []);
    await rerender([lookalike]);
    await save();

    expect(sent()).toMatchObject({ platform: "old-room" });
  });

  test("a known platform opens on its own button, not Other", async () => {
    await mount(place({ platform: "ps4" }), [pool]);

    expect(pressed()).toEqual(["PS4"]);
  });
});
