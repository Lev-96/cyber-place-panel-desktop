// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";

/**
 * «Интерфейс и тема» (2026-10-27): every choice is tried on at once and kept
 * only on Save; Cancel puts the saved look back; leaving keeps the edits and
 * says so; the preview is a picture that can do nothing.
 */
const auth = vi.hoisted(() => ({ user: { id: 5, role: "manager", dashboard: { branch_id: 9 } } as Record<string, unknown> }));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: auth.user }) }));
const repo = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));
vi.mock("@/repositories/PreferencesRepository", () => ({ preferencesRepository: repo }));
vi.mock("@/i18n/LanguageContext", () => ({ useLang: () => ({ t: (k: string) => k, lang: "en", money: (n: number) => String(n) }) }));
const toast = vi.hoisted(() => ({ message: vi.fn() }));
vi.mock("@/ui/notify", () => ({ notify: { message: toast.message } }));

import Appearance from "./Appearance";
import UnsavedInterfaceNotice from "@/components/appearance/UnsavedInterfaceNotice";
import ApplyHomeOnSignIn from "@/components/appearance/ApplyHomeOnSignIn";
import { UiPreferencesProvider } from "@/preferences/UiPreferencesContext";

const doc = (over: object = {}) => ({ data: null, schema_version: 1, onboarding_version: 1, onboarded_at: null, ...over });
let go: (to: string) => void = () => {};
const Nav = () => { go = useNavigate(); return null; };
const Where = () => { const n = useNavigate(); void n; return <span data-testid="where">{window.location.hash}</span>; };

const mount = async (path = "/appearance") => {
  await act(async () => {
    render(
      <MemoryRouter initialEntries={[path]}>
        <UiPreferencesProvider>
          <Nav />
          <ApplyHomeOnSignIn />
          <UnsavedInterfaceNotice />
          <Routes>
            <Route path="/appearance" element={<Appearance />} />
            <Route path="/" element={<span data-testid="screen-home">home</span>} />
            <Route path="/bookings" element={<span data-testid="screen-bookings">bookings</span>} />
            <Route path="*" element={<Where />} />
          </Routes>
        </UiPreferencesProvider>
      </MemoryRouter>,
    );
  });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
};
const html = () => document.documentElement.dataset;
const pick = (name: string, key: string) => fireEvent.click(within(screen.getByTestId(`choice-${name}-${key}`)).getByRole("radio"));

beforeEach(() => {
  window.localStorage.clear();
  repo.get.mockReset(); repo.put.mockReset(); toast.message.mockReset();
  repo.get.mockResolvedValue(doc());
  repo.put.mockImplementation(async (b: { data: unknown }) => doc({ data: b.data }));
});
afterEach(() => cleanup());

describe("trying on and saving", () => {
  test("a choice shows at once and is not saved until Save", async () => {
    await mount();
    await act(async () => { pick("theme", "light"); });
    expect(html().theme).toBe("light");
    expect(repo.put).not.toHaveBeenCalled();
    expect(screen.getByText("appearance.unsaved")).toBeTruthy();

    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "appearance.save" })); });
    expect(repo.put).toHaveBeenCalledTimes(1);
    expect(repo.put.mock.calls[0][0].data.theme).toBe("light");
    expect(toast.message).toHaveBeenCalledWith("success", "appearance.saved");
    expect(screen.queryByText("appearance.unsaved")).toBeNull();
  });

  test("Cancel puts the saved look back and saves nothing", async () => {
    await mount();
    await act(async () => { pick("interface", "compact"); });
    expect(html().density).toBe("compact");
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "appearance.cancel" })); });
    expect(html().density).toBe("standard");
    expect(repo.put).not.toHaveBeenCalled();
  });

  test("a change to the own layout switches to My interface, starting from what was on screen", async () => {
    repo.get.mockResolvedValue(doc({ data: { interface: "simple" } }));
    await mount();
    await act(async () => { fireEvent.click(screen.getByRole("tab", { name: "appearance.custom.list" })); });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "appearance.save" })); });
    const saved = repo.put.mock.calls[0][0].data;
    expect(saved.interface).toBe("custom");
    expect(saved.layout.board_view).toBe("list");
    // Everything else is Simple's, which was on screen.
    expect(saved.layout.quick_actions).toBe("primary");
    expect(saved.layout.density).toBe("simple");
  });

  test("Back to the standard interface is a change like any other", async () => {
    repo.get.mockResolvedValue(doc({ data: { interface: "compact" } }));
    await mount();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "appearance.reset" })); });
    expect(html().density).toBe("standard");
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "appearance.save" })); });
    expect(repo.put.mock.calls[0][0].data.interface).toBe("standard");
  });

  test("a failed save says so and keeps the choice", async () => {
    repo.put.mockRejectedValue(new Error("offline"));
    await mount();
    await act(async () => { pick("theme", "contrast"); });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "appearance.save" })); });
    expect(toast.message).toHaveBeenCalledWith("error", "appearance.saveFailed");
    expect(html().theme).toBe("contrast");
  });
});

describe("leaving with unsaved edits", () => {
  test("the panel goes back to the saved look and says the edits are kept", async () => {
    await mount();
    await act(async () => { pick("theme", "light"); });
    await act(async () => { go("/bookings"); });
    expect(html().theme).toBe("dark");
    expect(screen.getByTestId("unsaved-interface")).toBeTruthy();

    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "appearance.backToEdits" })); });
    expect(html().theme).toBe("light");
    expect(screen.queryByTestId("unsaved-interface")).toBeNull();
  });

  test("Discard drops them", async () => {
    await mount();
    await act(async () => { pick("theme", "light"); });
    await act(async () => { go("/bookings"); });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "appearance.dropEdits" })); });
    expect(screen.queryByTestId("unsaved-interface")).toBeNull();
    expect(html().theme).toBe("dark");
    expect(repo.put).not.toHaveBeenCalled();
  });
});

describe("the menu and the first screen", () => {
  test("the menu lists the role's own entries; required ones cannot be hidden; order and hiding are saved", async () => {
    await mount();
    const editor = screen.getByTestId("menu-editor");
    // A manager's menu: no owner-only entries.
    expect(within(editor).queryByText("nav.revenue")).toBeNull();
    expect((within(screen.getByTestId("menu-row-nav.settings")).getByRole("checkbox") as HTMLInputElement).disabled).toBe(true);

    await act(async () => { fireEvent.click(within(screen.getByTestId("menu-row-nav.bookings")).getByRole("checkbox")); });
    await act(async () => { fireEvent.click(within(screen.getByTestId("menu-row-nav.shifts")).getByRole("button", { name: /appearance.menu.up/ })); });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "appearance.save" })); });
    const sidebar: Array<{ id: string; hidden: boolean }> = repo.put.mock.calls[0][0].data.layout.sidebar;
    expect(sidebar.find((e) => e.id === "nav.bookings")?.hidden).toBe(true);
    expect(sidebar.findIndex((e) => e.id === "nav.shifts")).toBeLessThan(sidebar.findIndex((e) => e.id === "nav.myBranch"));
  });

  test("the chosen first screen opens on sign-in, once, and only from the dashboard", async () => {
    repo.get.mockResolvedValue(doc({ data: { interface: "custom", layout: { home: "/bookings" } } }));
    await mount("/");
    expect(screen.getByTestId("screen-bookings")).toBeTruthy();
    await act(async () => { go("/"); });
    expect(screen.getByTestId("screen-home")).toBeTruthy();
  });

  test("another account signing in on the same machine (no remount) gets its own first screen", async () => {
    repo.get.mockResolvedValue(doc({ data: { interface: "custom", layout: { home: "/bookings" } } }));
    const tree = () => (
      <MemoryRouter initialEntries={["/"]}>
        <UiPreferencesProvider>
          <Nav />
          <ApplyHomeOnSignIn />
          <Routes>
            <Route path="/" element={<span data-testid="screen-home">home</span>} />
            <Route path="/bookings" element={<span data-testid="screen-bookings">bookings</span>} />
          </Routes>
        </UiPreferencesProvider>
      </MemoryRouter>
    );
    let view!: ReturnType<typeof render>;
    await act(async () => { view = render(tree()); });
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(screen.getByTestId("screen-bookings")).toBeTruthy();
    // The account switch lands on the dashboard (AuthRouteReset), same tree.
    await act(async () => { go("/"); });
    expect(screen.getByTestId("screen-home")).toBeTruthy();

    auth.user = { id: 6, role: "manager", dashboard: { branch_id: 9 } };
    await act(async () => { view.rerender(tree()); });
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(screen.getByTestId("screen-bookings")).toBeTruthy();
    auth.user = { id: 5, role: "manager", dashboard: { branch_id: 9 } };
  });

  test("a launch that restored another screen stays there", async () => {
    repo.get.mockResolvedValue(doc({ data: { interface: "custom", layout: { home: "/bookings" } } }));
    await mount("/appearance");
    expect(screen.queryByTestId("screen-bookings")).toBeNull();
  });
});

describe("the preview", () => {
  test("is a picture: inert, no clickable controls, nothing sent", async () => {
    await mount();
    const preview = screen.getByTestId("appearance-preview");
    expect(preview.querySelector("[inert]")).toBeTruthy();
    expect(preview.querySelectorAll("button, a, input, select")).toHaveLength(0);
    expect(repo.put).not.toHaveBeenCalled();
  });
});
