import { beforeEach, describe, expect, test, vi } from "vitest";

const sent = vi.hoisted(() => ({ calls: [] as Array<{ path: string; opts: { method?: string; body?: unknown } }> }));
vi.mock("./client", () => ({ request: (path: string, opts: { method?: string; body?: unknown }) => { sent.calls.push({ path, opts }); return Promise.resolve({ news: {} }); } }));

import { apiPostBranchNews } from "./bonus";

beforeEach(() => { sent.calls = []; });

describe("apiPostBranchNews (2026-11-25)", () => {
  test("text only: a JSON body, an empty text as null", async () => {
    await apiPostBranchNews(7, { title: "Cup", body: null });
    expect(sent.calls[0]).toEqual({ path: "/branches/7/news", opts: { method: "POST", body: { title: "Cup", body: null } } });
  });
  test("with a picture: a form with the title, the text and the file", async () => {
    const file = new File(["x"], "cup.png", { type: "image/png" });
    await apiPostBranchNews(7, { title: "Cup", body: "On Friday", image: file });
    const fd = sent.calls[0].opts.body as FormData;
    expect(fd).toBeInstanceOf(FormData);
    expect(fd.get("title")).toBe("Cup");
    expect(fd.get("body")).toBe("On Friday");
    expect((fd.get("image") as File).name).toBe("cup.png");
  });
});
