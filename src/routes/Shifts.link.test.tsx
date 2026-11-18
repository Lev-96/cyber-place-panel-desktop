// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

/**
 * `/shifts?shift_id=N` (2026-11-18: the shortage notification's link) opens
 * that shift's report at once; closing it drops the parameter.
 */
const repo = vi.hoisted(() => ({ list: vi.fn(), staff: vi.fn(), summary: vi.fn() }));
vi.mock("@/repositories/ShiftRepository", () => ({ shiftRepository: repo }));
vi.mock("@/repositories/BranchRepository", () => ({ branchRepository: { list: async () => [] } }));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: { id: 1, role: "company_owner" } }) }));
vi.mock("@/i18n/LanguageContext", () => ({ useLang: () => ({ t: (k: string) => k, lang: "en", money: (n: number) => n.toFixed(2) }) }));

import Shifts from "./Shifts";

let search = "";
const Where = () => { search = useLocation().search; return null; };

const mount = async (url: string) => {
  await act(async () => {
    render(
      <MemoryRouter initialEntries={[url]}>
        <Routes><Route path="/shifts" element={<><Shifts /><Where /></>} /></Routes>
      </MemoryRouter>,
    );
  });
};

beforeEach(() => {
  for (const f of Object.values(repo)) f.mockReset();
  repo.list.mockResolvedValue({ data: [], meta: { current_page: 1, last_page: 1, per_page: 20, total: 0 } });
  repo.staff.mockResolvedValue([]);
  repo.summary.mockResolvedValue({
    shift: { id: 42, branch_id: 1, status: "open", opened_at: "2026-11-18T12:30:00+04:00", closed_at: null, opened_by: null, closed_by: null,
      opening_cash: "0.00", expected_cash: null, counted_cash: null, cash_difference: null, difference_kind: null, notes: null, has_report: false, branch: null, revenue_total: null },
    report: null,
  });
});
afterEach(() => cleanup());

test("opens the linked shift's report, and closing it drops the link", async () => {
  await mount("/shifts?shift_id=42");
  expect(repo.summary).toHaveBeenCalledWith(42);
  expect(screen.getByTestId("shift-report-modal")).toBeTruthy();
  await act(async () => { fireEvent.click(screen.getByText("action.close")); });
  expect(search).toBe("");
});

test("no link, or a bad one: no report is asked for", async () => {
  await mount("/shifts");
  await mount("/shifts?shift_id=abc");
  expect(repo.summary).not.toHaveBeenCalled();
});
