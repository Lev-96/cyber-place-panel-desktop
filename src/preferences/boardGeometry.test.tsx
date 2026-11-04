// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  BOARD_DEFAULTS, DEFAULT_PREFERENCES, GAP_LIMITS, NEW_PERSON_PREFERENCES, PRESETS,
  effectiveBoard, hasOwnInterface, parseBoard, parsePreferences, sameLook, toBoardDocument, toDocument, type UiPreferences,
} from "./uiPreferences";

/**
 * The Active Places board's own spacing (2026-11-03; only the space between
 * rows since 2026-11-04): part of «Мой интерфейс», kept on this computer per
 * person, never in the server document (the server refuses unknown keys with
 * a 422 and stores nothing).
 */
const auth = vi.hoisted(() => ({ user: { id: 7 } as { id: number } | null }));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: auth.user }) }));
const repo = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));
vi.mock("@/repositories/PreferencesRepository", () => ({ preferencesRepository: repo }));
const kv = vi.hoisted(() => ({ failSetFor: null as string | null }));
vi.mock("@/infrastructure/KeyValueStore", () => ({
  keyValueStore: {
    get: async (k: string) => {
      const raw = window.localStorage.getItem(k);
      return raw === null ? null : JSON.parse(raw);
    },
    set: async (k: string, v: unknown) => {
      if (kv.failSetFor && k === kv.failSetFor) throw new Error("disk full");
      window.localStorage.setItem(k, JSON.stringify(v));
    },
  },
}));

import { UiPreferencesProvider, applyToDocument, boardKey, cacheKey, useUiPreferences } from "./UiPreferencesContext";

describe("parseBoard", () => {
  test("nothing kept, or nonsense, is the standard board", () => {
    for (const raw of [null, undefined, 3, "x", [], { gap_y: "3" }]) {
      expect(parseBoard(raw)).toEqual(BOARD_DEFAULTS);
    }
  });

  test("the row gap is kept inside the limits and on the 4px scale", () => {
    expect(parseBoard({ gap_y: 999 })).toEqual({ gap_y: GAP_LIMITS.max });
    expect(parseBoard({ gap_y: -20 })).toEqual({ gap_y: GAP_LIMITS.min });
    expect(parseBoard({ gap_y: 30 })).toEqual({ gap_y: 32 });
    expect(parseBoard({ gap_y: Infinity })).toEqual({ gap_y: null });
    expect(parseBoard({ gap_y: null })).toEqual({ gap_y: null });
  });

  test("what an older build kept (side spacing, columns, size, no scroll) is no longer applied", () => {
    expect(parseBoard({ v: 1, gap_x: 24, gap_y: 12, columns: 4, scale: 1.2, fit: true })).toEqual({ gap_y: 12 });
    expect(parseBoard({ v: 1, gap_x: 24, columns: 4, scale: 1.2, fit: true })).toEqual(BOARD_DEFAULTS);
  });

  test("a document from a newer build is read field by field", () => {
    expect(parseBoard({ v: 9, gap_y: 12, card_padding: "roomy" })).toEqual({ gap_y: 12 });
  });

  test("round-trips through its own document", () => {
    const b = { gap_y: 12 };
    expect(parseBoard(toBoardDocument(b))).toEqual(b);
  });
});

describe("the server document never carries the board", () => {
  test("toDocument lists only the server's keys", () => {
    const p: UiPreferences = { ...DEFAULT_PREFERENCES, interface: "custom", board: { gap_y: 8 } };
    expect(Object.keys(toDocument(p)).sort()).toEqual(["interface", "layout", "sound", "theme"]);
    expect(JSON.stringify(toDocument(p))).not.toContain("gap_y");
  });

  test("a server document cannot smuggle a board in", () => {
    const p = parsePreferences({ interface: "custom", board: { gap_y: 8 } });
    expect(p.board).toEqual(BOARD_DEFAULTS);
  });
});

describe("effectiveBoard and the document", () => {
  const mine: UiPreferences = { ...DEFAULT_PREFERENCES, interface: "custom", board: { gap_y: 12 } };

  test("only «Мой интерфейс» uses the person's board", () => {
    expect(effectiveBoard(mine)).toEqual(mine.board);
    for (const id of ["simple", "standard", "compact"] as const) {
      expect(effectiveBoard({ ...mine, interface: id })).toEqual(BOARD_DEFAULTS);
    }
  });

  test("applied as a CSS variable; the standard board sets none, and no removed setting is ever set", () => {
    const root = document.createElement("html");
    applyToDocument(mine, root);
    expect(root.style.getPropertyValue("--board-gap-y")).toBe("12px");
    for (const gone of ["--board-gap-x", "--board-cols", "--board-scale"]) {
      expect(root.style.getPropertyValue(gone)).toBe("");
    }
    expect(root.dataset.boardCols).toBeUndefined();

    applyToDocument({ ...mine, interface: "standard" }, root);
    expect(root.style.getPropertyValue("--board-gap-y")).toBe("");
  });

  test("the button labels are put on the document from the layout in force", () => {
    const root = document.createElement("html");
    applyToDocument({ ...mine, layout: { ...mine.layout, button_labels: "icons" } }, root);
    expect(root.dataset.buttonLabels).toBe("icons");
    // A ready-made interface brings its own ("auto"), whatever «Мой» keeps.
    applyToDocument({ ...mine, interface: "compact", layout: { ...mine.layout, button_labels: "icons" } }, root);
    expect(root.dataset.buttonLabels).toBe("auto");
  });
});

describe("hasOwnInterface: when «Мой интерфейс» shows as a card", () => {
  test("not for a ready-made interface, whichever one the first-run setup stored", () => {
    expect(hasOwnInterface(DEFAULT_PREFERENCES)).toBe(false);
    expect(hasOwnInterface(NEW_PERSON_PREFERENCES)).toBe(false);
    for (const id of ["simple", "standard", "compact"] as const) {
      expect(hasOwnInterface({ ...DEFAULT_PREFERENCES, interface: id, layout: { ...PRESETS[id] } })).toBe(false);
    }
  });

  test("a document saved before button labels existed still reads as the ready-made one", () => {
    const old = parsePreferences({ interface: "standard", layout: {
      density: "standard", card_size: "m", board_view: "grid", show_secondary: true, quick_actions: "all", home: null, sidebar: [],
    } });
    expect(old.layout.button_labels).toBe("auto");
    expect(hasOwnInterface(old)).toBe(false);
  });

  test("yes when it is on, when a layout of their own is kept aside, or a board of their own", () => {
    expect(hasOwnInterface({ ...DEFAULT_PREFERENCES, interface: "custom" })).toBe(true);
    expect(hasOwnInterface({ ...DEFAULT_PREFERENCES, layout: { ...PRESETS.standard, card_size: "l" } })).toBe(true);
    expect(hasOwnInterface({ ...DEFAULT_PREFERENCES, layout: { ...PRESETS.standard, button_labels: "icons" } })).toBe(true);
    expect(hasOwnInterface({ ...DEFAULT_PREFERENCES, board: { gap_y: 16 } })).toBe(true);
  });

  test("sameLook sees a board-only change as a change", () => {
    expect(sameLook(DEFAULT_PREFERENCES, { ...DEFAULT_PREFERENCES, board: { gap_y: 12 } })).toBe(false);
    expect(sameLook(DEFAULT_PREFERENCES, { ...DEFAULT_PREFERENCES })).toBe(true);
  });
});

let state: ReturnType<typeof useUiPreferences>;
const Probe = () => { state = useUiPreferences(); return null; };
const mount = async () => {
  await act(async () => { render(<UiPreferencesProvider><Probe /></UiPreferencesProvider>); });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
};
const doc = (over: object = {}) => ({ data: null, schema_version: 1, onboarding_version: 1, onboarded_at: null, ...over });
const css = () => document.documentElement.style;

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute("style");
  auth.user = { id: 7 };
  kv.failSetFor = null;
  repo.get.mockReset(); repo.put.mockReset();
  repo.put.mockImplementation(async (b: { data: unknown }) => doc({ data: b.data }));
});
afterEach(() => cleanup());

describe("the provider keeps the board per person, on this computer", () => {
  test("restored after a restart, together with the server's «Мой интерфейс»", async () => {
    window.localStorage.setItem(boardKey(7), JSON.stringify({ v: 1, gap_y: 16 }));
    repo.get.mockResolvedValue(doc({ data: { interface: "custom" } }));
    await mount();
    expect(state.prefs.board).toEqual({ gap_y: 16 });
    expect(css().getPropertyValue("--board-gap-y")).toBe("16px");
  });

  test("a board kept by an older build: only the row gap comes back", async () => {
    window.localStorage.setItem(boardKey(7), JSON.stringify({ v: 1, gap_x: 24, gap_y: 16, columns: 4, scale: 1.2, fit: true }));
    repo.get.mockResolvedValue(doc({ data: { interface: "custom" } }));
    await mount();
    expect(state.prefs.board).toEqual({ gap_y: 16 });
    expect(css().getPropertyValue("--board-cols")).toBe("");
    expect(css().getPropertyValue("--board-scale")).toBe("");
  });

  test("offline start: the local copy and the board both stand", async () => {
    window.localStorage.setItem(cacheKey(7), JSON.stringify({ interface: "custom" }));
    window.localStorage.setItem(boardKey(7), JSON.stringify({ v: 1, gap_y: 20 }));
    repo.get.mockRejectedValue(new Error("offline"));
    await mount();
    expect(state.prefs.interface).toBe("custom");
    expect(state.prefs.board.gap_y).toBe(20);
    expect(css().getPropertyValue("--board-gap-y")).toBe("20px");
  });

  test("a broken board document is the standard board, and the rest still loads", async () => {
    window.localStorage.setItem(boardKey(7), "{not json");
    repo.get.mockResolvedValue(doc({ data: { interface: "custom", theme: "light" } }));
    await mount();
    expect(state.prefs.board).toEqual(BOARD_DEFAULTS);
    expect(state.prefs.theme).toBe("light");
  });

  test("saving writes the board here and NOT to the server", async () => {
    repo.get.mockResolvedValue(doc());
    await mount();
    await act(async () => {
      await state.save({ ...state.prefs, interface: "custom", board: { gap_y: 8 } });
    });
    expect(JSON.parse(window.localStorage.getItem(boardKey(7)) as string)).toEqual({ v: 1, gap_y: 8 });
    const sent = repo.put.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(Object.keys(sent.data).sort()).toEqual(["interface", "layout", "sound", "theme"]);
    expect(css().getPropertyValue("--board-gap-y")).toBe("8px");
  });

  test("a board this computer cannot keep fails the WHOLE save: nothing half applied", async () => {
    repo.get.mockResolvedValue(doc());
    await mount();
    kv.failSetFor = boardKey(7);
    let failed = false;
    await act(async () => {
      try { await state.save({ ...state.prefs, interface: "custom", board: { gap_y: 8 } }); }
      catch { failed = true; }
    });
    expect(failed).toBe(true);
    expect(state.saveFailed).toBe(true);
    expect(repo.put).not.toHaveBeenCalled();
    expect(state.prefs.interface).toBe("standard");
    expect(css().getPropertyValue("--board-gap-y")).toBe("");
  });

  test("another person on this computer never gets the first one's board", async () => {
    window.localStorage.setItem(boardKey(7), JSON.stringify({ v: 1, gap_y: 24 }));
    repo.get.mockResolvedValue(doc({ data: { interface: "custom" } }));
    const view = await (async () => {
      let r: ReturnType<typeof render> | null = null;
      await act(async () => { r = render(<UiPreferencesProvider><Probe /></UiPreferencesProvider>); });
      await act(async () => { await new Promise((res) => setTimeout(res, 0)); });
      return r as unknown as ReturnType<typeof render>;
    })();
    expect(state.prefs.board.gap_y).toBe(24);

    auth.user = { id: 8 };
    await act(async () => { view.rerender(<UiPreferencesProvider><Probe /></UiPreferencesProvider>); });
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(state.prefs.board).toEqual(BOARD_DEFAULTS);
    expect(css().getPropertyValue("--board-gap-y")).toBe("");
  });

  test("signing out takes the board off the document", async () => {
    window.localStorage.setItem(boardKey(7), JSON.stringify({ v: 1, gap_y: 24 }));
    repo.get.mockResolvedValue(doc({ data: { interface: "custom" } }));
    const view = render(<UiPreferencesProvider><Probe /></UiPreferencesProvider>);
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(css().getPropertyValue("--board-gap-y")).toBe("24px");
    auth.user = null;
    await act(async () => { view.rerender(<UiPreferencesProvider><Probe /></UiPreferencesProvider>); });
    expect(css().getPropertyValue("--board-gap-y")).toBe("");
  });
});

describe("button labels in the server document (2026-11-04)", () => {
  test("the default is not written, so a backend that predates the key still takes the save", () => {
    const doc = toDocument({ ...DEFAULT_PREFERENCES, interface: "custom", layout: { ...PRESETS.standard } }) as { layout: Record<string, unknown> };
    expect("button_labels" in doc.layout).toBe(false);
    expect(parsePreferences(doc).layout.button_labels).toBe("auto");
  });

  test("a choice is written and read back", () => {
    for (const choice of ["icons", "text"] as const) {
      const doc = toDocument({ ...DEFAULT_PREFERENCES, interface: "custom", layout: { ...PRESETS.standard, button_labels: choice } }) as { layout: Record<string, unknown> };
      expect(doc.layout.button_labels).toBe(choice);
      expect(parsePreferences(doc).layout.button_labels).toBe(choice);
    }
  });
});
