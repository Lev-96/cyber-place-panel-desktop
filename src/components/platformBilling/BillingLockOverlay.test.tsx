// @vitest-environment jsdom
import { cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

/**
 * The cover over Active Places and Tournaments when an unpaid Cyber Place
 * Platform invoice limits new work (owner, 2026-11-09): the reason is shown
 * before Start is pressed, in Armenian, and it never traps the staff (running
 * seats must still be stopped and paid).
 */

const auth = vi.hoisted(() => ({ user: null as null | { id: number; role: string; dashboard?: { company_id?: number; branch_id?: number } } }));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => auth }));
const api = vi.hoisted(() => ({ calls: [] as string[], handler: (_p: string): Promise<unknown> => Promise.reject(new Error("no")) }));
vi.mock("@/api/client", () => ({
  request: (path: string) => { api.calls.push(path); return api.handler(path); },
  apiCache: { subscribe: () => () => {} },
}));
vi.mock("./PlatformBillingModal", () => ({ default: () => <div data-testid="debt-modal" /> }));

import BillingLockOverlay from "./BillingLockOverlay";
import { useBillingAccess } from "./useBillingAccess";

beforeEach(() => {
  api.calls = [];
  auth.user = { id: 3, role: "company_owner", dashboard: { company_id: 2 } };
});
afterEach(cleanup);

describe("the cover", () => {
  test("nothing at all while access is active", () => {
    const { container } = render(<BillingLockOverlay access="active" area="sessions" />);
    expect(container.innerHTML).toBe("");
  });

  test("restricted Active Places: the Armenian reason, what still works, how it comes back", () => {
    render(<BillingLockOverlay access="restricted" area="sessions" />);
    expect(screen.getByRole("heading").textContent).toBe("Մասնաճյուղի աշխատանքը սահմանափակված է");
    expect(screen.getByText("Cyber Place Platform-ի վճարումն ուշացել է, այդ պատճառով նոր սեսիաներ սկսել հնարավոր չէ։")).toBeTruthy();
    expect(screen.getByText(/Արդեն սկսված սեսիաները շարունակում են աշխատել։/)).toBeTruthy();
    expect(document.querySelector('[data-billing-lock="sessions"]')!.getAttribute("lang")).toBe("hy");
  });

  test("suspended tournaments say creating AND editing are closed, and the players are kept", () => {
    render(<BillingLockOverlay access="suspended" area="tournaments" />);
    expect(screen.getByRole("heading").textContent).toBe("Մրցաշարերը ժամանակավորապես արգելափակված են");
    expect(screen.getByText(/նոր մրցաշարեր ստեղծել և դրանք խմբագրել հնարավոր չէ/)).toBeTruthy();
    expect(screen.getByText("Արդեն ստեղծված մրցաշարերը և դրանց մասնակիցները պահպանված են։")).toBeTruthy();
  });

  test("«Շարունակել» lifts it, so running seats can still be stopped and paid", () => {
    render(<BillingLockOverlay access="suspended" area="sessions" />);
    fireEvent.click(screen.getByRole("button", { name: "Շարունակել" }));
    expect(document.querySelector("[data-billing-lock]")).toBeNull();
  });

  test("the owner can open the debt; a manager is not offered it", () => {
    render(<BillingLockOverlay access="restricted" area="sessions" />);
    fireEvent.click(screen.getByRole("button", { name: "Տեսնել պարտքը" }));
    expect(screen.getByTestId("debt-modal")).toBeTruthy();
    cleanup();
    auth.user = { id: 9, role: "manager", dashboard: { branch_id: 4 } };
    render(<BillingLockOverlay access="restricted" area="sessions" />);
    expect(screen.queryByRole("button", { name: "Տեսնել պարտքը" })).toBeNull();
  });
});

describe("where the access comes from", () => {
  test("a branch screen asks the branch", async () => {
    api.handler = (p) => (p === "/branches/4" ? Promise.resolve({ branch: { id: 4, billing_access: "suspended" } }) : Promise.reject(new Error(p)));
    const { result } = renderHook(() => useBillingAccess(4));
    await waitFor(() => expect(result.current).toBe("suspended"));
  });

  test("the owner's company-wide list asks the company billing", async () => {
    api.handler = (p) => (p === "/company/2/billing" ? Promise.resolve({ billing_access: "restricted" }) : Promise.reject(new Error(p)));
    const { result } = renderHook(() => useBillingAccess(null));
    await waitFor(() => expect(result.current).toBe("restricted"));
  });

  test("a manager's company-wide list asks their own branch", async () => {
    auth.user = { id: 9, role: "manager", dashboard: { branch_id: 4 } };
    api.handler = (p) => (p === "/branches/4" ? Promise.resolve({ branch: { billing_access: "restricted" } }) : Promise.reject(new Error(p)));
    const { result } = renderHook(() => useBillingAccess(null));
    await waitFor(() => expect(result.current).toBe("restricted"));
  });

  test("an admin is never covered and asks nothing", async () => {
    auth.user = { id: 1, role: "admin" };
    const { result } = renderHook(() => useBillingAccess(4));
    await Promise.resolve();
    expect(result.current).toBe("active");
    expect(api.calls).toEqual([]);
  });

  test("a failure or an older backend leaves the screen as it was", async () => {
    api.handler = () => Promise.resolve({ branch: { id: 4 } });
    const { result } = renderHook(() => useBillingAccess(4));
    await waitFor(() => expect(api.calls).toContain("/branches/4"));
    expect(result.current).toBe("active");
  });
});
