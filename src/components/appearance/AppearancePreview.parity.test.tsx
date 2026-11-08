// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { PC_KIND, PC_STATUS } from "@/types/pc";

/**
 * The interface preview draws a seat EXACTLY as Active Places does
 * (2026-11-03). Its sample seats are rendered next to the real board's and
 * their skeletons are compared: every element, in order, with its classes and
 * its action. A card changed on the board and not in the preview (or the
 * reverse) fails here, instead of being found on a screenshot.
 */
const repo = vi.hoisted(() => ({ listPcs: vi.fn(), listActive: vi.fn() }));
vi.mock("@/repositories/SessionRepository", () => ({
  sessionRepository: {
    listPcs: (...a: unknown[]) => repo.listPcs(...a),
    listActive: (...a: unknown[]) => repo.listActive(...a),
    reorderPcs: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock("@/realtime/usePlaceAvailability", () => ({ usePlaceAvailability: () => {} }));
vi.mock("@/realtime/useSessionChanged", () => ({ useSessionChanged: () => {} }));
vi.mock("@/hooks/useReservedPlaceIds", () => ({ useReservedPlaceIds: () => new Set<number>() }));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: { id: 1, role: "manager" } }) }));
vi.mock("@/i18n/LanguageContext", () => ({
  useLang: () => ({ t: (k: string) => k, money: (n: number) => String(n), lang: "en" }),
}));

import SessionsBoard from "@/components/sessions/SessionsBoard";
import AppearancePreview, { previewSeatCount, previewWidth } from "./AppearancePreview";

afterEach(() => cleanup());

const now = Date.now();
const PCS = [
  { id: 1, branch_id: 7, place_id: 10, label: "S1", kind: PC_KIND.Ps, status: PC_STATUS.Online, current_session_id: 5,
    place: { id: 10, number: 1, name: "Hall 1", type: "STANDARD", platform: "ps5" } },
  { id: 2, branch_id: 7, place_id: 11, label: "S2", kind: PC_KIND.Ps, status: PC_STATUS.Online,
    place: { id: 11, number: 2, name: "Hall 2", type: "STANDARD", platform: "ps5" } },
];
const SESSIONS = [{
  id: 5, branch_id: 7, pc_id: 1, mode: "fixed", status: "active",
  started_at: new Date(now - 20 * 60_000).toISOString(), ends_at: new Date(now + 40 * 60_000).toISOString(),
  hourly_rate: 800, committed_amount: 1600, package_name: null, total_paid: 0, joystick_count: 2, joysticks: [],
  is_free: false, is_unlimited: false, supports_joysticks: true, place_platform: "ps5",
}];

/** Every element under a card, in order: tag, classes (sorted), action. No text, no inline style. */
const skeleton = (card: Element): string[] =>
  [card, ...Array.from(card.querySelectorAll("*"))].map((el) => {
    const classes = Array.from(el.classList).sort().join(".");
    const action = el.getAttribute("data-action");
    return `${el.tagName.toLowerCase()}${classes ? `.${classes}` : ""}${action ? `[${action}]` : ""}`;
  });

const boardCards = async () => {
  repo.listPcs.mockResolvedValue(PCS);
  repo.listActive.mockResolvedValue(SESSIONS);
  localStorage.clear();
  await act(async () => { render(<MemoryRouter><SessionsBoard branchId={7} /></MemoryRouter>); });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  const cards = Array.from(document.querySelectorAll(".live-grid--sessions > .place-cell"));
  const out = { running: skeleton(cards[0]), free: skeleton(cards[1]) };
  cleanup();
  return out;
};

const previewCards = (quick: "all" | "primary" = "all") => {
  render(<AppearancePreview quick={quick} />);
  const cards = Array.from(document.querySelectorAll('[data-testid="appearance-preview"] .live-grid--sessions > .place-cell'));
  return { running: skeleton(cards[0]), free: skeleton(cards[2]), ending: cards[1], all: cards };
};

describe("the preview draws seats with the board's own structure", () => {
  test("a running PlayStation seat: same elements, classes and actions, in the same order", async () => {
    const board = await boardCards();
    const preview = previewCards();
    expect(board.running.length).toBeGreaterThan(15);
    expect(preview.running).toEqual(board.running);
  });

  test("a free seat: same elements, classes and actions", async () => {
    const board = await boardCards();
    const preview = previewCards();
    expect(preview.free).toEqual(board.free);
  });

  test("inside the board's own section and grid", () => {
    render(<AppearancePreview quick="all" />);
    const grid = document.querySelector('[data-testid="appearance-preview"] .cp-section .live-grid.live-grid--sessions');
    expect(grid).not.toBeNull();
  });

  test("a seat in its last minutes is drawn as the board draws it: the ending tone", () => {
    const { ending } = previewCards();
    expect(ending.getAttribute("data-tone")).toBe("ending");
  });

  test("a picture only: inert, nothing in the tab order, no handlers reachable", () => {
    render(<AppearancePreview quick="primary" />);
    const root = document.querySelector('[data-testid="appearance-preview"]') as HTMLElement;
    expect(root.querySelector("[inert]")).not.toBeNull();
    for (const el of Array.from(root.querySelectorAll<HTMLElement>("button, [draggable='true']"))) {
      expect(el.closest("[inert]")).not.toBeNull();
    }
    expect(root.querySelector("[draggable='true']")).toBeNull();
  });
});

describe("laid out at the board's width, at the board's own size", () => {
  test("a narrower frame: the board's width, not scaled (it scrolls sideways in its frame)", () => {
    expect(previewWidth(650, 748)).toBe(748);
  });

  test("a frame as wide or wider, or not laid out yet: drawn as is", () => {
    expect(previewWidth(748, 748)).toBeNull();
    expect(previewWidth(900, 748)).toBeNull();
    expect(previewWidth(0, 748)).toBeNull();
  });
});

describe("two rows of seats, so the space between rows shows", () => {
  test("twice the grid's columns, on any width", () => {
    expect(previewSeatCount(4)).toBe(8);
    expect(previewSeatCount(6)).toBe(12);
    expect(previewSeatCount(9)).toBe(18);
  });

  test("four when there are no columns to read (a list, or not laid out yet), never past the cap", () => {
    expect(previewSeatCount(0)).toBe(4);
    expect(previewSeatCount(1)).toBe(4);
    expect(previewSeatCount(40)).toBe(24);
  });
});
