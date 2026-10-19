// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

/**
 * A company's branch list has ONE way back: the shell's Back button (Layout).
 * The inner "← Back to company" link duplicated it and is gone (2026-10-11);
 * the list itself, its rows and "New branch" are unchanged.
 */

vi.mock("@/repositories/BranchRepository", () => ({
  branchRepository: {
    list: vi.fn(async () => [
      { id: 5, address: "Abovyan 1", country: "Armenia", city: "Yerevan", places_count: 4, status: "active", is_blocked: false },
    ]),
  },
}));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: { id: 1, role: "admin" } }) }));
vi.mock("@/i18n/LanguageContext", () => ({ useLang: () => ({ t: (k: string) => k, lang: "en" }) }));
vi.mock("@/components/branches/BranchForm", () => ({ default: () => null }));

import CompanyBranches from "./CompanyBranches";

afterEach(cleanup);

const mount = async () => {
  await act(async () => {
    render(
      <MemoryRouter initialEntries={["/companies/3/branches"]}>
        <Routes><Route path="/companies/:companyId/branches" element={<CompanyBranches />} /></Routes>
      </MemoryRouter>,
    );
  });
};

describe("a company's branch list", () => {
  test("has no inner link back to the company", async () => {
    await mount();
    expect(screen.queryByText("companyBranches.back")).toBeNull();
    expect(document.querySelector('a[href="/companies/3"]')).toBeNull();
  });

  test("still lists the branches as links and offers a new branch", async () => {
    await mount();
    expect(screen.getByText("Abovyan 1").closest("a")?.getAttribute("href")).toBe("/branches/5");
    expect(screen.getByRole("button", { name: "companyBranches.newBranch" })).toBeTruthy();
  });
});
