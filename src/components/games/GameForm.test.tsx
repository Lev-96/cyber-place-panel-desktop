// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { IGameApi } from "@/api/games";

/**
 * Creating a game that is already in the catalogue.
 *
 * The server refuses the duplicate with a 422 that keeps its old shape
 * (`message`, `errors.name`) and adds `code: "game_exists"` plus the row that
 * exists. That is a QUESTION for the operator — "use that one?" — not a
 * failure: no red toast, no "name: has already been taken" line. Answering
 * yes resends the same body with `use_existing: true`, which links the shared
 * game to the branch.
 *
 * The real GameRepository runs here (only the transport is stubbed), so the
 * toast it raises — or must not raise — is part of what is pinned.
 */

const api = vi.hoisted(() => ({ create: vi.fn(), list: vi.fn(), prices: vi.fn(), places: vi.fn() }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock("@/api/games", () => ({
  apiCreateGame: (...a: unknown[]) => api.create(...a),
  apiUpdateGame: vi.fn(),
  apiDeleteGame: vi.fn(),
  apiListGames: (...a: unknown[]) => api.list(...a),
}));
vi.mock("@/api/platformPrices", () => ({
  apiListPlatformPrices: (...a: unknown[]) => api.prices(...a),
  apiUpdatePlatformPrice: vi.fn(),
}));
// The branch's places name its platforms too (useBranchPlatforms).
vi.mock("@/api/places", () => ({ apiGetPlaces: (...a: unknown[]) => api.places(...a) }));
vi.mock("@/ui/notify", () => ({
  notify: { success: (...a: unknown[]) => toast.success(...a), error: (...a: unknown[]) => toast.error(...a) },
  withToast: <T,>(_e: string, _a: string, fn: () => Promise<T>) => fn(),
}));
vi.mock("@/i18n/LanguageContext", () => ({
  useLang: () => ({
    t: (k: string) => (k === "game.exists.notice" ? "exists {0} on {1}" : k),
    lang: "en",
  }),
}));
vi.mock("@/components/ui/Modal", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import GameForm from "./GameForm";

/** The 422 the backend answers a duplicate with. */
const duplicate = (game = { id: 41, name: "Dota 2", platform: "pc" }) =>
  Object.assign(new Error("The name has already been taken."), {
    status: 422,
    body: {
      message: "The name has already been taken.",
      errors: { name: ["The name has already been taken."] },
      code: "game_exists",
      game,
    },
  });

let onSaved: ReturnType<typeof vi.fn<(game?: IGameApi | null) => void>>;

const mount = async (props: Partial<React.ComponentProps<typeof GameForm>> = {}) => {
  await act(async () => {
    render(<GameForm branchId={7} onClose={() => {}} onSaved={onSaved} {...props} />);
  });
};
/** The name box (the kit's Input renders its label as a sibling span). */
const nameBox = () => document.querySelector<HTMLInputElement>("input.input")!;
const typeName = async (v: string) => {
  await act(async () => { fireEvent.change(nameBox(), { target: { value: v } }); });
};
const form = () => nameBox().closest("form")!;
const submit = async () => { await act(async () => { fireEvent.submit(form()); }); };
const notice = () => screen.queryByRole("alert");

beforeEach(() => {
  api.create.mockReset();
  api.list.mockReset().mockResolvedValue({ data: [] });
  api.prices.mockReset().mockResolvedValue({ data: [] });
  api.places.mockReset().mockResolvedValue({ data: [] });
  toast.success.mockReset();
  toast.error.mockReset();
  onSaved = vi.fn<(game?: IGameApi | null) => void>();
});
afterEach(cleanup);

describe("a game the catalogue already has", () => {
  test("the server's game_exists is asked as a question, not shown as an error", async () => {
    api.create.mockRejectedValueOnce(duplicate());
    await mount();
    await typeName("Dota 2");
    await submit();

    expect(notice()?.textContent).toContain("exists Dota 2 on PC");
    expect(screen.queryByText(/has already been taken/)).toBeNull();
    expect(screen.queryByText(/^name:/)).toBeNull();
    expect(toast.error).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  test("Use existing resends once with use_existing and hands back that game", async () => {
    const linked: IGameApi = { id: 41, name: "Dota 2", platform: "pc" };
    api.create.mockRejectedValueOnce(duplicate()).mockResolvedValueOnce({ games: linked, existing: true });
    await mount();
    await typeName("Dota 2");
    await submit();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "game.exists.useExisting" })); });

    expect(api.create).toHaveBeenCalledTimes(2);
    expect(api.create.mock.calls[1][0]).toEqual({ name: "Dota 2", platform: "pc", branch_id: 7, use_existing: true });
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(onSaved).toHaveBeenCalledWith(linked);
    expect(toast.success).toHaveBeenCalledWith("game", "linked");
  });

  test("Cancel dismisses the question and sends nothing more", async () => {
    api.create.mockRejectedValueOnce(duplicate());
    await mount();
    await typeName("Dota 2");
    await submit();
    const inNotice = notice()!.querySelector("button")!;
    expect(inNotice.textContent).toBe("action.cancel");
    await act(async () => { fireEvent.click(inNotice); });

    expect(notice()).toBeNull();
    expect(api.create).toHaveBeenCalledTimes(1);
    expect(onSaved).not.toHaveBeenCalled();
  });

  test("Enter while the question is open does not resend the create", async () => {
    api.create.mockRejectedValueOnce(duplicate());
    await mount();
    await typeName("Dota 2");
    await submit();
    await submit();

    expect(api.create).toHaveBeenCalledTimes(1);
  });

  test("a double submit sends one request", async () => {
    let release: (v: unknown) => void = () => {};
    api.create.mockImplementationOnce(() => new Promise((r) => { release = r; }));
    await mount();
    await typeName("Quake");
    await act(async () => {
      fireEvent.submit(form());
      fireEvent.submit(form());
    });
    await act(async () => { release({ games: { id: 1, name: "Quake", platform: "pc" } }); });

    expect(api.create).toHaveBeenCalledTimes(1);
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  test("the loaded catalogue catches an obvious duplicate before any request", async () => {
    await mount({ globalCatalogue: [{ id: 41, name: "Dota 2", platform: "pc" }, { id: 42, name: "Dota 2", platform: "ps5" }] });
    await typeName("  dota   2 ");
    await submit();

    expect(api.create).not.toHaveBeenCalled();
    expect(notice()?.textContent).toContain("exists Dota 2 on PC");
  });

  test("the same name on another platform is a different game", async () => {
    api.create.mockResolvedValueOnce({ games: { id: 50, name: "Dota 2", platform: "pc" } });
    await mount({ globalCatalogue: [{ id: 42, name: "Dota 2", platform: "ps5" }] });
    await typeName("Dota 2");
    await submit();

    expect(api.create).toHaveBeenCalledTimes(1);
    expect(notice()).toBeNull();
  });

  test("the admin catalogue (no branch) uses the existing row without a request", async () => {
    api.create.mockRejectedValueOnce(duplicate());
    await mount({ branchId: undefined });
    await typeName("Dota 2");
    await submit();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "game.exists.useExisting" })); });

    expect(api.create).toHaveBeenCalledTimes(1);
    expect(onSaved).toHaveBeenCalledWith({ id: 41, name: "Dota 2", platform: "pc" });
  });

  test("any other refusal still shows inline and keeps its toast", async () => {
    api.create.mockRejectedValueOnce(Object.assign(new Error("x"), {
      status: 422, body: { message: "Bad", errors: { name: ["Too long"] } },
    }));
    await mount();
    await typeName("Dota 2");
    await submit();

    expect(notice()).toBeNull();
    expect(screen.getByText("name: Too long")).toBeTruthy();
    expect(toast.error).toHaveBeenCalledWith("game", "created");
  });
});

/**
 * PlaceForm opens this with the place's platform locked. A place on "Other"
 * with no name yet has NO platform, and an empty lock used to fall through to
 * the picker — letting a game be created on any platform from a place form.
 */
describe("a locked but empty platform", () => {
  test("offers no picker and cannot be saved", async () => {
    await mount({ lockedPlatform: "" });
    await typeName("Billiards Pro");

    expect(screen.queryByRole("button", { name: "PC" })).toBeNull();
    expect(screen.queryByRole("button", { name: "platform.other" })).toBeNull();
    const save = screen.getByRole("button", { name: "action.save" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    await submit();
    expect(api.create).not.toHaveBeenCalled();
  });

  test("a locked real platform is sent as is", async () => {
    api.create.mockResolvedValueOnce({ games: { id: 9, name: "Cue", platform: "billiards" } });
    await mount({ lockedPlatform: "billiards" });
    await typeName("Cue");
    await submit();

    expect(api.create.mock.calls[0][0]).toEqual({ name: "Cue", platform: "billiards", branch_id: 7 });
  });
});

/** Past the form's typing pause, so the suggestions follow the name. */
const settle = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 260)); }); };
const suggestList = () => document.querySelector(".game-suggest");
const suggestedNames = () => Array.from(document.querySelectorAll(".game-suggest__name")).map((n) => n.textContent);

/**
 * The owner on Branch → Games → New game types a name the GLOBAL catalogue
 * already has. The branch list alone never knew it, so the form only found
 * out on Save. Now the existing games show while typing, on the selected
 * platform, and "Use existing" takes the same path as the duplicate notice.
 */
describe("suggestions while typing a new game", () => {
  const global: IGameApi[] = [
    { id: 41, name: "Dota 2", platform: "pc" },
    { id: 42, name: "Dota 2", platform: "ps5" },
    { id: 43, name: "Dota Underlords", platform: "pc" },
    { id: 44, name: "FIFA 26", platform: "ps5" },
  ];

  test("a global game the branch does not have is offered, case and spaces ignored", async () => {
    api.list.mockResolvedValue({ data: global });
    await mount({ branchGames: [] });
    await typeName("  dOTA   2");
    await settle();

    expect(api.list).toHaveBeenCalledTimes(1);
    expect(suggestedNames()).toEqual(["Dota 2"]);
    expect(document.querySelector(".game-suggest__row--exact")?.textContent).toContain("Dota 2");
  });

  test("only the selected platform is suggested", async () => {
    api.list.mockResolvedValue({ data: global });
    await mount();
    await typeName("dota");
    await settle();
    expect(suggestedNames()).toEqual(["Dota 2", "Dota Underlords"]);

    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "PS5" })); });
    expect(suggestedNames()).toEqual(["Dota 2"]);
  });

  test("one character suggests nothing; the list is read once, not per keystroke", async () => {
    api.list.mockResolvedValue({ data: global });
    await mount();
    await typeName("d");
    await settle();
    expect(suggestList()).toBeNull();
    await typeName("do");
    await typeName("dot");
    await settle();

    expect(suggestedNames()).toEqual(["Dota 2", "Dota Underlords"]);
    expect(api.list).toHaveBeenCalledTimes(1);
  });

  test("a game already in the branch is marked", async () => {
    api.list.mockResolvedValue({ data: global });
    await mount({ branchGames: [global[2]] });
    await typeName("dota");
    await settle();

    const rows = Array.from(document.querySelectorAll(".game-suggest__row"));
    expect(rows[0].textContent).not.toContain("game.suggest.inBranch");
    expect(rows[1].textContent).toContain("game.suggest.inBranch");
  });

  test("Use existing on a suggestion links THAT game once and hands it back", async () => {
    api.list.mockResolvedValue({ data: global });
    const linked: IGameApi = { id: 43, name: "Dota Underlords", platform: "pc" };
    let release: (v: unknown) => void = () => {};
    api.create.mockImplementationOnce(() => new Promise((r) => { release = r; }));
    await mount();
    await typeName("underlords");
    await settle();
    const use = screen.getByRole("button", { name: "game.suggest.useNamed" });
    await act(async () => { fireEvent.click(use); fireEvent.click(use); });
    await act(async () => { release({ games: linked, existing: true }); });

    expect(api.create).toHaveBeenCalledTimes(1);
    expect(api.create.mock.calls[0][0]).toEqual({ name: "Dota Underlords", platform: "pc", branch_id: 7, use_existing: true });
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(onSaved).toHaveBeenCalledWith(linked);
  });

  test("the admin catalogue (no branch) returns the suggested row without a request", async () => {
    await mount({ branchId: undefined, globalCatalogue: global });
    await typeName("fifa");
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "PS5" })); });
    await settle();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "game.suggest.useNamed" })); });

    expect(api.list).not.toHaveBeenCalled();
    expect(api.create).not.toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalledWith(global[3]);
  });

  test("editing a game suggests nothing and reads nothing", async () => {
    await mount({ initial: { id: 43, name: "Dota Underlords", platform: "pc" } });
    await typeName("Dota 2");
    await settle();

    expect(suggestList()).toBeNull();
    expect(api.list).not.toHaveBeenCalled();
    expect(api.prices).not.toHaveBeenCalled();
  });

  test("the global list failing to load leaves a form that still saves", async () => {
    api.list.mockRejectedValue(Object.assign(new Error("down"), { status: 500 }));
    api.create.mockResolvedValueOnce({ games: { id: 60, name: "Dota 2", platform: "pc" } });
    await mount();
    await typeName("Dota 2");
    await settle();
    expect(suggestList()).toBeNull();
    await submit();

    expect(api.create).toHaveBeenCalledWith({ name: "Dota 2", platform: "pc", branch_id: 7 });
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  test("a caller still loading the catalogue (null) gets no second request", async () => {
    await mount({ globalCatalogue: null, lockedPlatform: "billiards" });
    await typeName("Cue");
    await settle();
    expect(api.list).not.toHaveBeenCalled();
  });
});

/**
 * The branch's own custom platforms (billiards, poker, …) used to be
 * invisible here: only PC / PS4 / PS5 + Other. They are quick buttons now,
 * named as the branch named them.
 */
describe("the branch's custom platforms", () => {
  const price = (platform: string, names: [string, string, string]) => ({
    id: 1, branch_id: 7, platform, name_en: names[0], name_ru: names[1], name_am: names[2], name: names[0],
  });

  test("come from the branch's platform prices and its games, with their names", async () => {
    api.prices.mockResolvedValue({ data: [price("billiards", ["Pool table", "Бильярд", "Բիլյարդ"])] });
    await mount({ branchGames: [{ id: 5, name: "Texas", platform: "poker" }, { id: 6, name: "Quake", platform: "pc" }] });

    expect(api.prices).toHaveBeenCalledWith(7);
    expect(screen.getByRole("button", { name: "Pool table" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Poker" })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "PC" })).toHaveLength(1);
  });

  test("picking one sets its slug, filters suggestions by it and is what Save sends", async () => {
    api.prices.mockResolvedValue({ data: [price("billiards", ["Pool table", "Бильярд", "Բիլյարդ"])] });
    api.list.mockResolvedValue({ data: [
      { id: 70, name: "Snooker", platform: "billiards" },
      { id: 71, name: "Snooker", platform: "pc" },
    ] });
    api.create.mockResolvedValueOnce({ games: { id: 72, name: "Snooker Pro", platform: "billiards" } });
    await mount({ branchGames: [] });
    const button = screen.getByRole("button", { name: "Pool table" });
    await act(async () => { fireEvent.click(button); });
    await typeName("snooker");
    await settle();

    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByPlaceholderText("platform.customPlaceholder")).toBeNull();
    expect(Array.from(document.querySelectorAll(".game-suggest__meta")).map((n) => n.textContent)).toEqual(["Billiards"]);

    await typeName("Snooker Pro");
    await submit();
    expect(api.create).toHaveBeenCalledWith({ name: "Snooker Pro", platform: "billiards", branch_id: 7 });
  });

  // The same list PlaceForm offers: a platform a place already runs on is a
  // button even before it has a price row or a game.
  test("a platform only the branch's places use is a button too", async () => {
    api.places.mockResolvedValue({ data: [{ id: 3, platform: "air-hockey" }, { id: 4, platform: "pc" }] });
    await mount({ branchGames: [] });

    expect(api.places.mock.calls[0][0]).toMatchObject({ branch_id: 7 });
    expect(screen.getByRole("button", { name: "Air Hockey" })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "PC" })).toHaveLength(1);
  });

  test("without a branch (admin) they are the custom platforms of the global catalogue", async () => {
    await mount({
      branchId: undefined,
      globalCatalogue: [{ id: 1, name: "Texas", platform: "poker" }, { id: 2, name: "Quake", platform: "pc" }],
    });

    expect(api.prices).not.toHaveBeenCalled();
    expect(api.places).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Poker" })).toBeTruthy();
  });

  test("a locked platform shows no picker and reads no prices", async () => {
    await mount({ lockedPlatform: "billiards" });
    expect(api.prices).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "PC" })).toBeNull();
  });
});
