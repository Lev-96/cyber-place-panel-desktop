import { beforeEach, describe, expect, test, vi } from "vitest";

/**
 * How a game write goes on the wire once a cover can ride along: JSON exactly
 * as before without a file; multipart with one (booleans as "1"/"0", which
 * Laravel's `boolean` rule accepts and "true"/"false" it does not); an edit
 * with a file as `POST ?_method=PUT`, since PHP does not parse multipart PUT.
 */

const sent = vi.hoisted(() => ({ calls: [] as Array<{ path: string; opts: { method?: string; body?: unknown } }> }));
vi.mock("./client", () => ({
  request: vi.fn(async (path: string, opts: { method?: string; body?: unknown }) => {
    sent.calls.push({ path, opts });
    return {};
  }),
}));

import { apiCreateGame, apiUpdateGame } from "./games";

beforeEach(() => { sent.calls.length = 0; });

const png = () => new File(["png"], "cover.png", { type: "image/png" });

describe("create", () => {
  test("without a cover is the same JSON body as before", async () => {
    await apiCreateGame({ name: "Tekken 8", platform: "ps5", branch_id: 7 });

    expect(sent.calls[0]).toEqual({ path: "/games", opts: { method: "POST", body: { name: "Tekken 8", platform: "ps5", branch_id: 7 } } });
  });

  test("with a cover is multipart, booleans as 1/0", async () => {
    const file = png();
    await apiCreateGame({ name: "Tekken 8", platform: "ps5", branch_id: 7, use_existing: true, game_logo_path: file });

    const body = sent.calls[0].opts.body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect(body.get("name")).toBe("Tekken 8");
    expect(body.get("branch_id")).toBe("7");
    expect(body.get("use_existing")).toBe("1");
    expect(body.get("game_logo_path")).toBe(file);
  });
});

describe("update", () => {
  test("a rename alone is the JSON PUT it always was", async () => {
    await apiUpdateGame(5, { name: "Tekken 8" });

    expect(sent.calls[0]).toEqual({ path: "/games/5", opts: { method: "PUT", body: { name: "Tekken 8" } } });
  });

  test("clearing the cover needs no file, so it stays JSON", async () => {
    await apiUpdateGame(5, { name: "Tekken 8", remove_cover: true });

    expect(sent.calls[0]).toEqual({ path: "/games/5", opts: { method: "PUT", body: { name: "Tekken 8", remove_cover: true } } });
  });

  test("a new cover is a method-spoofed multipart POST", async () => {
    const file = png();
    await apiUpdateGame(5, { name: "Tekken 8", game_logo_path: file });

    expect(sent.calls[0].path).toBe("/games/5?_method=PUT");
    expect(sent.calls[0].opts.method).toBe("POST");
    expect((sent.calls[0].opts.body as FormData).get("game_logo_path")).toBe(file);
  });
});
