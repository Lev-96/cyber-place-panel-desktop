import { afterEach, describe, expect, test, vi } from "vitest";

/**
 * What the company edit actually sends (2026-10-09). An emptied description
 * used to be dropped from the multipart body, so the server kept the old text
 * and answered "saved". It is now sent as "" on UPDATE; every other empty
 * field, and the create form, behave as before.
 */
const sent = vi.hoisted(() => ({ calls: [] as Array<{ path: string; body: FormData }> }));
vi.mock("./client", () => ({
  request: vi.fn(async (path: string, opts: { body: FormData }) => {
    sent.calls.push({ path, body: opts.body });
    return { message: "ok" };
  }),
}));

import { apiCreateCompany, apiUpdateCompany } from "./companies";

const last = () => sent.calls[sent.calls.length - 1];

afterEach(() => { sent.calls = []; });

describe("the company edit payload", () => {
  test("a changed description is sent", async () => {
    await apiUpdateCompany(5, { name: "A", description: "New text" } as never);

    expect(last().path).toBe("/company/5?_method=PUT");
    expect(last().body.get("description")).toBe("New text");
  });

  test("an emptied description is sent as empty, so the server clears it", async () => {
    await apiUpdateCompany(5, { name: "A", description: "" } as never);

    expect(last().body.has("description")).toBe(true);
    expect(last().body.get("description")).toBe("");
  });

  test("other empty fields are still left out of an edit", async () => {
    await apiUpdateCompany(5, { name: "A", website: "", description: "x" } as never);

    expect(last().body.has("website")).toBe(false);
  });

  test("the create form is unchanged: an empty description is not sent", async () => {
    await apiCreateCompany({ name: "A", description: "" } as never);

    expect(last().body.has("description")).toBe(false);
  });
});
