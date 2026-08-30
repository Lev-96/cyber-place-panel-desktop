// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BlockedBranchGuard from "./BlockedBranchGuard";

/**
 * Blocking a branch already refuses the login of anyone with no open workplace
 * left, and evicts a panel standing in that branch when the block lands. What
 * neither covers: an owner whose OTHER venues are fine stays signed in, and
 * nothing stopped them walking into the closed branch from the list and using
 * its POS, sessions and shifts as though it were open.
 *
 * These pin the rule that closes that: the branch page itself stays reachable,
 * everything under it does not, and an admin passes through because they are
 * the one who can reopen it.
 */

const auth = vi.hoisted(() => ({ user: { id: 1, role: "company_owner" } as { id: number; role: string } | null }));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("@/i18n/LanguageContext", () => ({ useLang: () => ({ t: (k: string) => k }) }));

const toasts = vi.hoisted(() => ({ items: [] as string[] }));
vi.mock("@/ui/notify", () => ({
  notify: { message: (_kind: string, text: string) => toasts.items.push(text) },
}));

const branch = vi.hoisted(() => ({ is_blocked: false }));
vi.mock("@/repositories/BranchRepository", () => ({
  branchRepository: { byId: async () => ({ id: 7, is_blocked: branch.is_blocked }) },
}));

let path = "";
const Probe = () => {
  path = useLocation().pathname;
  return null;
};

const mountSection = () =>
  render(
    <MemoryRouter initialEntries={["/branches/7/pos"]}>
      <Probe />
      <Routes>
        <Route path="/branches/:branchId" element={<div>branch hub</div>} />
        <Route element={<BlockedBranchGuard />}>
          <Route path="/branches/:branchId/pos" element={<div>till</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  branch.is_blocked = false;
  auth.user = { id: 1, role: "company_owner" };
  toasts.items.length = 0;
});

afterEach(cleanup);

describe("BlockedBranchGuard", () => {
  it("lets staff into a branch that is open", async () => {
    mountSection();

    expect(await screen.findByText("till")).toBeTruthy();
    expect(path).toBe("/branches/7/pos");
  });

  it("sends an owner back to the branch page when it is out of service", async () => {
    branch.is_blocked = true;
    mountSection();

    await waitFor(() => expect(path).toBe("/branches/7"));
    expect(screen.queryByText("till")).toBeNull();
  });

  it("never renders the section before the answer is known", () => {
    // Redirecting on arrival would still have shown a working till for a
    // frame, which is the impression this guard exists to prevent.
    branch.is_blocked = true;
    mountSection();

    expect(screen.queryByText("till")).toBeNull();
  });

  it("says why, once", async () => {
    branch.is_blocked = true;
    mountSection();

    await waitFor(() => expect(toasts.items).toEqual(["blocking.branchClosed"]));
  });

  it("lets an admin in, because they are the one who can reopen it", async () => {
    branch.is_blocked = true;
    auth.user = { id: 9, role: "admin" };
    mountSection();

    expect(await screen.findByText("till")).toBeTruthy();
    expect(toasts.items).toEqual([]);
  });

  it("stops a manager too", async () => {
    branch.is_blocked = true;
    auth.user = { id: 3, role: "manager" };
    mountSection();

    await waitFor(() => expect(path).toBe("/branches/7"));
  });
});
