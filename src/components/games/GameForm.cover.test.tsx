// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { IGameApi } from "@/api/games";

/**
 * A game's cover in the game form (2026-10-30).
 *
 * A NEW game is saved only once its cover is decided: a picture, or the
 * explicit "No cover" switch (the mobile app then shows its own "no cover"
 * art). Editing (admin) can replace it or clear it; leaving it alone sends
 * the rename as before. The real GameRepository runs; only the transport is
 * stubbed.
 */

const api = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn(), list: vi.fn(), prices: vi.fn(), places: vi.fn() }));

vi.mock("@/api/games", () => ({
  apiCreateGame: (...a: unknown[]) => api.create(...a),
  apiUpdateGame: (...a: unknown[]) => api.update(...a),
  apiDeleteGame: vi.fn(),
  apiListGames: (...a: unknown[]) => api.list(...a),
}));
vi.mock("@/api/platformPrices", () => ({
  apiListPlatformPrices: (...a: unknown[]) => api.prices(...a),
  apiUpdatePlatformPrice: vi.fn(),
}));
vi.mock("@/api/places", () => ({ apiGetPlaces: (...a: unknown[]) => api.places(...a) }));
vi.mock("@/ui/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn() },
  withToast: <T,>(_e: string, _a: string, fn: () => Promise<T>) => fn(),
}));
vi.mock("@/i18n/LanguageContext", () => ({
  useLang: () => ({ t: (k: string) => (k === "game.exists.notice" ? "exists {0} on {1}" : k), lang: "en" }),
}));
vi.mock("@/components/ui/Modal", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import GameForm from "./GameForm";

let onSaved: ReturnType<typeof vi.fn<(game?: IGameApi | null) => void>>;

const mount = async (props: Partial<React.ComponentProps<typeof GameForm>> = {}) => {
  await act(async () => {
    render(<GameForm branchId={7} onClose={() => {}} onSaved={onSaved} {...props} />);
  });
};
const nameBox = () => document.querySelector<HTMLInputElement>("input.input")!;
const typeName = async (v: string) => {
  await act(async () => { fireEvent.change(nameBox(), { target: { value: v } }); });
};
const submit = async () => { await act(async () => { fireEvent.submit(nameBox().closest("form")!); }); };
const noCover = () => screen.getByRole("switch", { name: "game.noCover" }) as HTMLInputElement;
const toggleNoCover = async () => { await act(async () => { fireEvent.click(noCover()); }); };
const fileInput = () => document.querySelector<HTMLInputElement>('input[type="file"]');
const pick = async (file: File) => {
  await act(async () => { fireEvent.change(fileInput()!, { target: { files: [file] } }); });
};
const png = (name = "mk1.png") => new File(["png"], name, { type: "image/png" });

beforeEach(() => {
  api.create.mockReset().mockResolvedValue({ games: { id: 1, name: "Mortal Kombat 1", platform: "pc" } });
  api.update.mockReset().mockResolvedValue({ message: "ok" });
  api.list.mockReset().mockResolvedValue({ data: [] });
  api.prices.mockReset().mockResolvedValue({ data: [] });
  api.places.mockReset().mockResolvedValue({ data: [] });
  onSaved = vi.fn<(game?: IGameApi | null) => void>();
  // ImageUpload previews the picked file through a blob URL.
  globalThis.URL.createObjectURL = vi.fn(() => "blob:preview");
  globalThis.URL.revokeObjectURL = vi.fn();
});
afterEach(cleanup);

describe("a new game", () => {
  test("with no cover decided is not sent, and says what is missing", async () => {
    await mount();
    await typeName("Mortal Kombat 1");
    await submit();

    expect(api.create).not.toHaveBeenCalled();
    expect(screen.getByText("game.coverRequired")).toBeTruthy();
  });

  test("a picked cover is sent with the game", async () => {
    const file = png();
    await mount();
    await typeName("Mortal Kombat 1");
    await pick(file);
    await submit();

    expect(api.create).toHaveBeenCalledTimes(1);
    expect(api.create.mock.calls[0][0]).toEqual({ name: "Mortal Kombat 1", platform: "pc", branch_id: 7, game_logo_path: file });
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  test("'No cover' sends the game without one and hides the picker", async () => {
    await mount();
    await typeName("Mortal Kombat 1");
    await toggleNoCover();

    expect(fileInput()).toBeNull();
    await submit();
    expect(api.create.mock.calls[0][0]).toEqual({ name: "Mortal Kombat 1", platform: "pc", branch_id: 7 });
  });

  test("switching 'No cover' on after picking drops the file", async () => {
    await mount();
    await typeName("Mortal Kombat 1");
    await pick(png());
    await toggleNoCover();
    await submit();

    expect(api.create.mock.calls[0][0]).not.toHaveProperty("game_logo_path");
  });

  test("choosing the existing game carries the picked cover along", async () => {
    const file = png();
    api.create
      .mockRejectedValueOnce(Object.assign(new Error("taken"), {
        status: 422,
        body: { code: "game_exists", game: { id: 41, name: "Mortal Kombat 1", platform: "pc" } },
      }))
      .mockResolvedValueOnce({ games: { id: 41, name: "Mortal Kombat 1", platform: "pc" }, existing: true });
    await mount();
    await typeName("Mortal Kombat 1");
    await pick(file);
    await submit();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "game.exists.useExisting" })); });

    expect(api.create.mock.calls[1][0]).toEqual({
      name: "Mortal Kombat 1", platform: "pc", branch_id: 7, use_existing: true, game_logo_path: file,
    });
  });
});

describe("editing a game (admin)", () => {
  const withCover: IGameApi = { id: 5, name: "Tekken 8", platform: "ps5", game_logo_path: "images/games/covers/a.png" };
  const withoutCover: IGameApi = { id: 6, name: "Tekken 8", platform: "ps5", game_logo_path: null };

  test("left alone, the cover is not touched", async () => {
    await mount({ initial: withCover });
    await submit();

    expect(api.update).toHaveBeenCalledWith(5, { name: "Tekken 8" });
  });

  test("a new picture replaces it", async () => {
    const file = png();
    await mount({ initial: withCover });
    await pick(file);
    await submit();

    expect(api.update).toHaveBeenCalledWith(5, { name: "Tekken 8", game_logo_path: file });
  });

  test("'No cover' clears it", async () => {
    await mount({ initial: withCover });
    await toggleNoCover();
    await submit();

    expect(api.update).toHaveBeenCalledWith(5, { name: "Tekken 8", remove_cover: true });
  });

  test("a game with no cover opens with 'No cover' on and saves as a rename", async () => {
    await mount({ initial: withoutCover });

    expect(noCover().checked).toBe(true);
    await submit();
    expect(api.update).toHaveBeenCalledWith(6, { name: "Tekken 8" });
  });
});
