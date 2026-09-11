// @vitest-environment jsdom
import type { AuthUser, Role } from "@/types/api";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

/**
 * "+ New branch" on the owner's Branches page (it used to be a sidebar entry).
 *
 *  - It is the page header's primary action, above the list, drawn exactly
 *    when the sidebar entry was: `branch.create` AND a `dashboard.company_id`.
 *  - It opens THE branch form: the module the company screens import, mocked
 *    here so the test can see it is that one, for the owner's company, in
 *    create mode.
 *  - After saving it behaves like the company's own branch list: the form
 *    closes and the page on screen is read again. No navigation.
 */

const auth = vi.hoisted(() => ({ user: null as AuthUser | null }));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: auth.user }) }));
vi.mock("@/i18n/LanguageContext", () => ({ useLang: () => ({ t: (k: string) => k }) }));
vi.mock("@/components/ui/Avatar", () => ({ default: () => null }));
vi.mock("@/components/ui/ScreenWithBg", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const repo = vi.hoisted(() => ({ listPaged: vi.fn() }));
vi.mock("@/repositories/BranchRepository", () => ({
  branchRepository: { listPaged: (...a: unknown[]) => repo.listPaged(...a) },
}));

interface FormProps {
  companyId?: number;
  initial?: unknown;
  onClose: () => void;
  onSaved: (b: { id: number }) => void;
}
const form = vi.hoisted(() => ({ props: null as FormProps | null }));
vi.mock("@/components/branches/BranchForm", () => ({
  default: (p: FormProps) => {
    form.props = p;
    return <div data-testid="branch-form" />;
  },
}));

import BranchesList from "./BranchesList";

let currentPath = "";
const LocationProbe = () => {
  currentPath = useLocation().pathname;
  return null;
};

const signIn = (role: Role, dashboard?: AuthUser["dashboard"]) => {
  auth.user = { id: 1, name: "Test User", email: "user@t.test", role, dashboard };
};

const ROW = {
  id: 1,
  company_id: 5,
  address: "Abovyan 5",
  company: { name: "Cyber Zone" },
  country: "Armenia",
  city: "Yerevan",
  status: "active",
  is_blocked: false,
  blocked_at: null,
  places_count: 4,
};

const mount = async () => {
  render(
    <MemoryRouter initialEntries={["/branches"]}>
      <BranchesList />
      <LocationProbe />
    </MemoryRouter>,
  );
  await screen.findByText("Cyber Zone · Abovyan 5");
};

const createButton = () => screen.queryByRole("button", { name: "branchesList.newBranch" });

beforeEach(() => {
  form.props = null;
  currentPath = "";
  repo.listPaged.mockResolvedValue({ data: [ROW], meta: { last_page: 1 } });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("the owner's Branches page, + New branch", () => {
  test("is the header action, above the list", async () => {
    signIn("company_owner", { company_id: 5 });
    await mount();

    const button = createButton();
    expect(button).not.toBeNull();
    expect(button!.className).toContain("btn");
    expect(button!.className).not.toContain("secondary");
    // The header row sits before the list, and the button is its last item
    // (right-aligned by `row-between`), the same shape as Managers.
    const header = button!.closest(".row-between") as HTMLElement;
    expect(header).not.toBeNull();
    expect(header.lastElementChild).toBe(button);
    const list = document.querySelector(".list")!;
    expect(header.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  test("opens THE branch form for the owner's company, in create mode", async () => {
    signIn("company_owner", { company_id: 5 });
    await mount();
    expect(screen.queryByTestId("branch-form")).toBeNull();

    await act(async () => { fireEvent.click(createButton()!); });

    expect(screen.getByTestId("branch-form")).toBeTruthy();
    expect(form.props?.companyId).toBe(5);
    expect(form.props?.initial).toBeUndefined();
  });

  test("after saving, closes the form and reads the list again, staying on the page", async () => {
    signIn("company_owner", { company_id: 5 });
    await mount();
    expect(repo.listPaged).toHaveBeenCalledTimes(1);
    await act(async () => { fireEvent.click(createButton()!); });

    await act(async () => { form.props!.onSaved({ id: 42 }); });

    expect(screen.queryByTestId("branch-form")).toBeNull();
    await waitFor(() => expect(repo.listPaged).toHaveBeenCalledTimes(2));
    expect(repo.listPaged).toHaveBeenLastCalledWith(1);
    expect(currentPath).toBe("/branches");
  });

  test("cancel closes it and asks nothing", async () => {
    signIn("company_owner", { company_id: 5 });
    await mount();
    await act(async () => { fireEvent.click(createButton()!); });

    await act(async () => { form.props!.onClose(); });

    expect(screen.queryByTestId("branch-form")).toBeNull();
    expect(repo.listPaged).toHaveBeenCalledTimes(1);
  });

  // The create request requires a company id; with none the form could only
  // fail, so the button is not drawn at all.
  test("is hidden from an owner with no company", async () => {
    signIn("company_owner", {});
    await mount();

    expect(createButton()).toBeNull();
  });

  test.each([
    // An admin has `branch.create` but no company of their own: they create
    // branches from a company's page.
    ["admin", {}],
    // A manager's dashboard may name the company; `branch.create` is what they lack.
    ["manager", { company_id: 5, branch_id: 3 }],
  ] as const)("is hidden from %s", async (role, dashboard) => {
    signIn(role, dashboard);
    await mount();

    expect(createButton()).toBeNull();
  });
});
