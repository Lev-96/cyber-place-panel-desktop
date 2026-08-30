// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { IPcApi } from "@/types/sessions";
import { PC_KIND, PC_STATUS } from "@/types/pc";
import SessionsBoard from "./SessionsBoard";

/**
 * What a session tile says about the seat it stands for.
 *
 * Two things were wrong at once, and they had the same cause — the platform
 * label and the place's name shared one wrapping flex row:
 *
 *  1. A long name ("Плейстейшен 5 ВИП большое место") wrapped, pushed the
 *     platform onto a second line and moved the status and the Start button
 *     down by a different amount on every tile, so a row of cards no longer
 *     lined up.
 *  2. The tier was never rendered at all. `places.type` is in the payload the
 *     board already receives, but the tile showed "PS5" and left standard and
 *     VIP indistinguishable — on the one screen where a cashier picks a seat.
 *
 * The lines are separate now: platform · tier, then the name, each clipped to a
 * single line with the full text on hover. These tests pin the content of both
 * and the fact that the name carries its own `title` — a name a cashier cannot
 * read in full anywhere is worse than a ragged card.
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
vi.mock("@/hooks/useReservedPlaceIds", () => ({ useReservedPlaceIds: () => new Set<number>() }));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: { id: 1, role: "manager" } }) }));
vi.mock("@/i18n/LanguageContext", () => ({
  useLang: () => ({ t: (k: string) => k, money: (n: number) => String(n), lang: "en" }),
}));

const pc = (over: Partial<IPcApi>): IPcApi => ({
  id: 1,
  branch_id: 7,
  place_id: 10,
  label: "Seat 1",
  kind: PC_KIND.Ps,
  status: PC_STATUS.Online,
  place: { id: 10, number: 1, name: "Seat 1", type: "standard", platform: "ps5" },
  ...over,
});

const mount = async () => {
  await act(async () => {
    render(
      <MemoryRouter>
        <SessionsBoard branchId={7} />
      </MemoryRouter>,
    );
  });
};

/** The card's identity line — the one rendered at `.id` size. */
const nameLine = () => document.querySelector(".place-cell .id") as HTMLElement | null;
/** The platform/tier line above it. */
const typeLine = () => document.querySelector(".place-cell .platform") as HTMLElement | null;

afterEach(() => cleanup());
beforeEach(() => {
  repo.listPcs.mockReset();
  repo.listActive.mockReset();
  repo.listActive.mockResolvedValue([]);
  localStorage.clear();
});

describe("SessionsBoard — what a tile says the seat is", () => {
  test("the tier is shown next to the platform, not left to guesswork", async () => {
    repo.listPcs.mockResolvedValue([
      pc({ place: { id: 10, number: 2, name: "Seat 2", type: "vip", platform: "ps5" } }),
    ]);
    await mount();

    expect(typeLine()?.textContent).toContain("PS5");
    expect(typeLine()?.textContent).toContain("vip");
  });

  test("a custom platform keeps its tier even when the platform name is long", async () => {
    repo.listPcs.mockResolvedValue([
      pc({
        place: { id: 10, number: 3, name: "Big table", type: "standard", platform: "table-tennis" },
      }),
    ]);
    await mount();

    // The platform is the half allowed to ellipse; the tier never is, so it is
    // still in the DOM whatever the width.
    expect(typeLine()?.textContent).toContain("Table Tennis");
    expect(typeLine()?.textContent).toContain("standard");
  });

  test("the name has its own line and its full text on hover", async () => {
    const long = "Плейстейшен 5 ВИП большое место";
    repo.listPcs.mockResolvedValue([
      pc({ place: { id: 10, number: 4, name: long, type: "vip", platform: "ps5" } }),
    ]);
    await mount();

    const name = nameLine();
    expect(name?.textContent).toBe(long);
    // Clipped visually, never clipped in the tooltip.
    expect(name?.getAttribute("title")).toBe(long);
    // And it is NOT inside the platform line — sharing that row is what broke
    // the card in the first place.
    expect(typeLine()?.textContent).not.toContain(long);
  });

  test("a place with no name falls back to its number", async () => {
    repo.listPcs.mockResolvedValue([
      pc({ place: { id: 10, number: 9, name: null, type: "standard", platform: "ps5" } }),
    ]);
    await mount();

    expect(nameLine()?.textContent).toBe("№9");
  });

  test("a device linked to no place still renders both lines", async () => {
    repo.listPcs.mockResolvedValue([pc({ place_id: null, place: null, label: "Legacy device" })]);
    await mount();

    // The platform line is emitted empty rather than dropped, so this tile has
    // the same number of lines as every other one in the grid.
    expect(typeLine()).not.toBeNull();
    expect(nameLine()?.textContent).toBe("№Legacy device");
  });

  test("the status line no longer repeats the platform", async () => {
    repo.listPcs.mockResolvedValue([pc({ is_startable: true })]);
    await mount();

    const status = document.querySelector(".place-cell .status") as HTMLElement | null;
    expect(status?.textContent).toBe("session.free");
  });
});
