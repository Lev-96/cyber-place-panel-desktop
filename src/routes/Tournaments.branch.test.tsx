// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

/**
 * The tournaments of all branches say which branch hosts each one
 * (2026-10-11), from the branch `GET /tournaments` already eager-loads — never
 * guessed from the title. A row with no branch reads "Branch not specified".
 */

const repo = vi.hoisted(() => ({ listPaged: vi.fn() }));
vi.mock("@/repositories/TournamentRepository", () => ({ tournamentRepository: repo }));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: { id: 1, role: "company_owner", dashboard: {} } }) }));
vi.mock("@/i18n/LanguageContext", () => ({ useLang: () => ({ t: (k: string) => k, lang: "en" }) }));
vi.mock("@/components/ui/ConfirmProvider", () => ({ useConfirm: () => async () => false }));
vi.mock("@/components/tournaments/MyBranchTournamentsButton", () => ({ default: () => null }));
vi.mock("@/components/tournaments/TournamentForm", () => ({ default: () => null }));

import Tournaments from "./Tournaments";

const row = (id: number, title: string, branch: { id: number; address: string; company_id: number } | null | undefined) => ({
  id, branch_id: branch?.id ?? 0, company_id: 1, game_id: 1, title, description: "", price: 0,
  participants_limit: 0, registered_participants: 0, start_date: "2026-11-01", ...(branch === undefined ? {} : { branch }),
});
const page = (rows: unknown[], last = 1) => ({ data: rows, meta: { last_page: last } });

const mount = async (path = "/tournaments") => {
  await act(async () => {
    render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/tournaments" element={<Tournaments />} />
          <Route path="/branches/:branchId/tournaments" element={<Tournaments />} />
        </Routes>
      </MemoryRouter>,
    );
  });
};
const branchLines = () => [...document.querySelectorAll(".tournament-branch")].map((el) => el.textContent);

beforeEach(() => repo.listPaged.mockReset());
afterEach(cleanup);

describe("tournaments of all branches", () => {
  test("each card names its own branch", async () => {
    repo.listPaged.mockResolvedValue(page([
      row(1, "Cup A", { id: 4, address: "Abovyan 1", company_id: 1 }),
      row(2, "Cup B", { id: 9, address: "Komitas 12", company_id: 1 }),
    ]));
    await mount();
    expect(branchLines()).toEqual(["tournaments.branch: Abovyan 1", "tournaments.branch: Komitas 12"]);
  });

  test("no branch on the row: a neutral word, no crash", async () => {
    repo.listPaged.mockResolvedValue(page([row(1, "Cup A", null), row(2, "Cup B", undefined), row(3, "Cup C", { id: 4, address: "  ", company_id: 1 })]));
    await mount();
    expect(branchLines()).toEqual(["tournaments.branchUnknown", "tournaments.branchUnknown", "tournaments.branchUnknown"]);
  });

  test("a long address is one clipped line with the full text on hover", async () => {
    const long = "Very long branch address that would otherwise wrap the card onto many lines, Yerevan";
    repo.listPaged.mockResolvedValue(page([row(1, "Cup", { id: 4, address: long, company_id: 1 })]));
    await mount();
    const el = document.querySelector<HTMLElement>(".tournament-branch")!;
    expect(el.getAttribute("title")).toBe(`tournaments.branch: ${long}`);
    expect(el.style.whiteSpace).toBe("nowrap");
    expect(el.style.textOverflow).toBe("ellipsis");
  });

  test("the next page shows its own rows' branches", async () => {
    repo.listPaged
      .mockResolvedValueOnce(page([row(1, "Cup A", { id: 4, address: "Abovyan 1", company_id: 1 })], 2))
      .mockResolvedValueOnce(page([row(2, "Cup B", { id: 9, address: "Komitas 12", company_id: 1 })], 2));
    await mount();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /2/ })); });
    expect(repo.listPaged).toHaveBeenLastCalledWith(2, undefined);
    expect(branchLines()).toEqual(["tournaments.branch: Komitas 12"]);
  });

  test("the empty list is the empty state", async () => {
    repo.listPaged.mockResolvedValue(page([]));
    await mount();
    expect(screen.getByText("tournaments.state.emptyTitle")).toBeTruthy();
  });

  test("inside one branch the line is not repeated on every card", async () => {
    repo.listPaged.mockResolvedValue(page([row(1, "Cup A", { id: 4, address: "Abovyan 1", company_id: 1 })]));
    await mount("/branches/4/tournaments");
    expect(branchLines()).toEqual([]);
  });
});
