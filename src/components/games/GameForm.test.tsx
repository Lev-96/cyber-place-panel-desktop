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

const api = vi.hoisted(() => ({ create: vi.fn() }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock("@/api/games", () => ({
  apiCreateGame: (...a: unknown[]) => api.create(...a),
  apiUpdateGame: vi.fn(),
  apiDeleteGame: vi.fn(),
  apiListGames: vi.fn(),
}));
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
    await mount({ catalogue: [{ id: 41, name: "Dota 2", platform: "pc" }, { id: 42, name: "Dota 2", platform: "ps5" }] });
    await typeName("  dota   2 ");
    await submit();

    expect(api.create).not.toHaveBeenCalled();
    expect(notice()?.textContent).toContain("exists Dota 2 on PC");
  });

  test("the same name on another platform is a different game", async () => {
    api.create.mockResolvedValueOnce({ games: { id: 50, name: "Dota 2", platform: "pc" } });
    await mount({ catalogue: [{ id: 42, name: "Dota 2", platform: "ps5" }] });
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
