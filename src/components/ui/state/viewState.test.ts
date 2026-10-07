import { describe, expect, test } from "vitest";
import { classifyError, deriveViewState, serverDetailOf } from "./viewState";

const apiError = (status: number, body: unknown = null) => Object.assign(new Error(`HTTP ${status}`), { status, body });
const offline = () => new TypeError("Failed to fetch");

describe("deriveViewState — the order every screen follows", () => {
  test("no data yet, request in flight → loading (the skeleton)", () => {
    expect(deriveViewState({ loading: true, error: null, data: null })).toEqual({ kind: "loading" });
  });

  test("an error with nothing to show → error, never empty", () => {
    const e = apiError(500);
    expect(deriveViewState({ loading: false, error: e, data: null })).toEqual({ kind: "error", error: e });
    expect(deriveViewState({ loading: false, error: e, data: [] })).toEqual({ kind: "error", error: e });
    expect(deriveViewState({ loading: false, error: e, data: [], hasFilters: true })).toEqual({ kind: "error", error: e });
  });

  test("an answered empty list → empty; narrowed by a search or filter → noResults", () => {
    expect(deriveViewState({ loading: false, error: null, data: [] })).toEqual({ kind: "empty" });
    expect(deriveViewState({ loading: false, error: null, data: [], hasFilters: true })).toEqual({ kind: "noResults" });
  });

  test("data with something in it → ready", () => {
    expect(deriveViewState({ loading: false, error: null, data: [1] })).toEqual({ kind: "ready", staleError: null });
  });

  test("a background reload never blanks loaded data", () => {
    expect(deriveViewState({ loading: true, error: null, data: [1, 2] })).toEqual({ kind: "ready", staleError: null });
    // Nor turns an answered empty list back into a skeleton.
    expect(deriveViewState({ loading: true, error: null, data: [] })).toEqual({ kind: "empty" });
  });

  test("a failed REFRESH keeps the data and hands the error over as stale", () => {
    const e = offline();
    expect(deriveViewState({ loading: false, error: e, data: [1] })).toEqual({ kind: "ready", staleError: e });
  });

  test("data arriving after an empty answer replaces the empty state", () => {
    expect(deriveViewState({ loading: false, error: null, data: [] }).kind).toBe("empty");
    expect(deriveViewState({ loading: false, error: null, data: [{ id: 1 }] }).kind).toBe("ready");
  });

  test("isEmpty decides for a non-array payload", () => {
    const page = { data: [] as number[] };
    expect(deriveViewState({ loading: false, error: null, data: page, isEmpty: (p) => p.data.length === 0 }).kind).toBe("empty");
    expect(deriveViewState({ loading: false, error: null, data: page }).kind).toBe("ready");
  });
});

describe("classifyError", () => {
  test("no answer at all (fetch's TypeError, status 0) → offline", () => {
    expect(classifyError(offline(), true)).toBe("offline");
    expect(classifyError(Object.assign(new Error("down"), { status: 0 }), true)).toBe("offline");
  });

  test("the machine says it is offline → offline, whatever the error", () => {
    expect(classifyError(apiError(500), false)).toBe("offline");
  });

  test("404 → notFound, even offline (the server DID answer)", () => {
    expect(classifyError(apiError(404), true)).toBe("notFound");
    expect(classifyError(apiError(404), false)).toBe("notFound");
  });

  test("any other answer, or a bug of our own → error", () => {
    expect(classifyError(apiError(500), true)).toBe("error");
    expect(classifyError(apiError(403), true)).toBe("error");
    expect(classifyError(new Error("Invalid id"), true)).toBe("error");
    expect(classifyError("boom", true)).toBe("error");
  });
});

describe("serverDetailOf", () => {
  test("the server's sentence for a status we have no wording for", () => {
    expect(serverDetailOf(apiError(500, { message: " Database down " }))).toEqual({ literal: "Database down" });
  });

  test("nothing for a 404, a status-less error, an empty body or a client exception", () => {
    expect(serverDetailOf(apiError(404, { message: "No query results" }))).toBeNull();
    expect(serverDetailOf(offline())).toBeNull();
    expect(serverDetailOf(apiError(500, null))).toBeNull();
    expect(serverDetailOf(apiError(500, { message: "" }))).toBeNull();
    expect(serverDetailOf(new Error("TypeError: x is undefined"))).toBeNull();
  });
});
