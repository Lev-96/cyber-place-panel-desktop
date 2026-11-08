// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { branchSectionsFor } from "@/components/branches/branchSections";

/**
 * «Интерфейс и тема», the personal part (2026-11-03): the Active Places
 * board's size, spacing, columns and "no scroll" as sliders and switches;
 * «Мой интерфейс» as a card among the ready-made ones once saved, describing
 * what was saved; the default interface that loses nothing; and branch
 * sections switched on in the side menu, for the branches a person works.
 */
const auth = vi.hoisted(() => ({ user: {} as Record<string, unknown> }));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: auth.user }) }));
const repo = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));
vi.mock("@/repositories/PreferencesRepository", () => ({ preferencesRepository: repo }));
const branches = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("@/repositories/BranchRepository", () => ({ branchRepository: branches }));
vi.mock("@/i18n/LanguageContext", () => ({ useLang: () => ({ t: (k: string) => k, lang: "en", money: (n: number) => String(n) }) }));
const toast = vi.hoisted(() => ({ message: vi.fn() }));
vi.mock("@/ui/notify", () => ({ notify: { message: toast.message } }));

import Appearance from "./Appearance";
import { ConfirmProvider } from "@/components/ui/ConfirmProvider";
import { UiPreferencesProvider, boardKey } from "@/preferences/UiPreferencesContext";

const doc = (over: object = {}) => ({ data: null, schema_version: 1, onboarding_version: 1, onboarded_at: null, ...over });
const MANAGER = { id: 5, role: "manager", dashboard: { branch_id: 9, company_id: 4 } };
const OWNER = { id: 6, role: "company_owner", dashboard: { branch_id: null, company_id: 4 } };

const mount = async () => {
  let view: ReturnType<typeof render> | null = null;
  await act(async () => {
    view = render(
      <ConfirmProvider>
        <MemoryRouter initialEntries={["/appearance"]}>
          <UiPreferencesProvider>
            <Routes><Route path="/appearance" element={<Appearance />} /></Routes>
          </UiPreferencesProvider>
        </MemoryRouter>
      </ConfirmProvider>,
    );
  });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  return view as unknown as ReturnType<typeof render>;
};
const root = () => document.documentElement;
const css = () => root().style;
const sw = (id: string) => screen.getByTestId(id) as HTMLInputElement;
const flip = async (id: string) => { await act(async () => { fireEvent.click(sw(id)); }); };
const slide = async (id: string, value: number) => {
  await act(async () => { fireEvent.change(screen.getByTestId(id), { target: { value: String(value) } }); });
};
const save = async () => {
  await act(async () => { fireEvent.click(within(screen.getByTestId("appearance-actions")).getByRole("button", { name: "appearance.save" })); });
};
const lastSent = () => repo.put.mock.calls.at(-1)?.[0] as { data: { interface: string; layout: { sidebar: Array<{ id: string; hidden: boolean }> } } };
const localBoard = (id = 5) => JSON.parse(window.localStorage.getItem(boardKey(id)) as string);
const mineCard = () => screen.queryByTestId("choice-interface-custom");

beforeEach(() => {
  window.localStorage.clear();
  root().removeAttribute("style");
  auth.user = MANAGER;
  repo.get.mockReset(); repo.put.mockReset(); toast.message.mockReset(); branches.list.mockReset();
  repo.get.mockResolvedValue(doc());
  repo.put.mockImplementation(async (b: { data: unknown }) => doc({ data: b.data }));
  branches.list.mockResolvedValue([]);
});
afterEach(() => cleanup());

describe("the board: only what is offered is on the page (2026-11-04)", () => {
  test("the size, no-scroll, side-spacing and column controls are gone; the row spacing stays", async () => {
    await mount();
    for (const gone of ["board-scale-slider", "board-fit", "board-gap-x-slider", "board-gap-x-auto", "board-columns-slider", "board-columns-auto"]) {
      expect(screen.queryByTestId(gone)).toBeNull();
    }
    expect(sw("board-gap-y-auto").getAttribute("role")).toBe("switch");
    expect(sw("board-gap-y-auto").checked).toBe(true);
  });

  test("row spacing: a slider on the 4px scale, inside its limits, tried on at once", async () => {
    await mount();
    await flip("board-gap-y-auto");
    await slide("board-gap-y-slider", 24);
    expect(css().getPropertyValue("--board-gap-y")).toBe("24px");
    await slide("board-gap-y-slider", 999);
    expect(css().getPropertyValue("--board-gap-y")).toBe("64px");
    expect(repo.put).not.toHaveBeenCalled();
  });

  test("button labels: text and icons, icons only, text only — tried on at once", async () => {
    await mount();
    expect(root().dataset.buttonLabels).toBe("auto");
    for (const [label, value] of [["appearance.labels.icons", "icons"], ["appearance.labels.text", "text"], ["appearance.labels.auto", "auto"]] as const) {
      await act(async () => { fireEvent.click(screen.getByRole("tab", { name: label })); });
      expect(root().dataset.buttonLabels).toBe(value);
    }
  });

  test("saved: the row spacing on this computer, the labels on the server, and back after a restart", async () => {
    const view = await mount();
    await flip("board-gap-y-auto");
    await slide("board-gap-y-slider", 20);
    await act(async () => { fireEvent.click(screen.getByRole("tab", { name: "appearance.labels.icons" })); });
    await save();
    expect(toast.message).toHaveBeenCalledWith("success", "appearance.saved");
    expect(localBoard()).toEqual({ v: 1, gap_y: 20 });
    const sent = lastSent().data as unknown as { layout: { button_labels: string } };
    expect(sent.layout.button_labels).toBe("icons");
    expect(Object.keys(lastSent().data).sort()).toEqual(["interface", "layout", "sound", "theme"]);

    view.unmount();
    root().removeAttribute("style");
    repo.get.mockResolvedValue(doc({ data: lastSent().data }));
    await mount();
    expect(css().getPropertyValue("--board-gap-y")).toBe("20px");
    expect(root().dataset.buttonLabels).toBe("icons");
  });
});

describe("«Мой интерфейс»: a card among the ready-made ones, once saved", () => {
  const mine = { interface: "custom", layout: { density: "compact", card_size: "l", board_view: "list", button_labels: "icons" } };
  const radioOf = (key: string) => within(screen.getByTestId(`choice-interface-${key}`)).getByRole("radio") as HTMLInputElement;
  const choose = async (key: string) => { await act(async () => { fireEvent.click(radioOf(key)); }); };

  test("first visit: the default is chosen and there is no «Мой интерфейс» at all", async () => {
    await mount();
    expect(mineCard()).toBeNull();
    expect(radioOf("standard").checked).toBe(true);
    expect(screen.getByTestId("choice-interface-standard").textContent).toContain("appearance.ui.standard");
  });

  test("set up and saved: the card appears, chosen, with what was saved in its words", async () => {
    await mount();
    await act(async () => { fireEvent.click(screen.getByRole("tab", { name: "appearance.custom.list" })); });
    await act(async () => { fireEvent.click(screen.getByRole("tab", { name: "appearance.labels.icons" })); });
    expect(mineCard()).toBeNull(); // tried on, not saved
    await save();
    expect(mineCard()).not.toBeNull();
    expect(radioOf("custom").checked).toBe(true);
    const words = (mineCard() as HTMLElement).textContent ?? "";
    expect(words).toContain("appearance.custom.list");
    expect(words).toContain("appearance.summary.labelsIcons");
  });

  test("its words are what was SAVED, not what is being tried", async () => {
    window.localStorage.setItem(boardKey(5), JSON.stringify({ v: 1, gap_y: 24 }));
    repo.get.mockResolvedValue(doc({ data: mine }));
    await mount();
    const words = () => (mineCard() as HTMLElement).textContent ?? "";
    for (const part of ["appearance.custom.list", "appearance.summary.cards", "appearance.summary.labelsIcons", "appearance.summary.rowGap"]) {
      expect(words()).toContain(part);
    }
    const before = words();
    await act(async () => { fireEvent.click(screen.getByRole("tab", { name: "appearance.labels.text" })); });
    await flip("board-gap-y-auto");
    expect(words()).toBe(before);
  });

  test("the default and compact are exactly the ready-made ones; «Мой» brings back exactly what was saved", async () => {
    window.localStorage.setItem(boardKey(5), JSON.stringify({ v: 1, gap_y: 16 }));
    repo.get.mockResolvedValue(doc({ data: mine }));
    await mount();
    const look = () => ({
      density: root().dataset.density, size: root().dataset.cardSize, view: root().dataset.boardView,
      labels: root().dataset.buttonLabels, rows: css().getPropertyValue("--board-gap-y"),
    });
    const saved = { density: "compact", size: "l", view: "list", labels: "icons", rows: "16px" };
    expect(look()).toEqual(saved);

    await choose("standard");
    expect(look()).toEqual({ density: "standard", size: "m", view: "grid", labels: "auto", rows: "" });
    await choose("compact");
    expect(look()).toEqual({ density: "compact", size: "s", view: "list", labels: "auto", rows: "" });
    await choose("custom");
    expect(look()).toEqual(saved);
    // …and «Вернуть интерфейс по умолчанию» is the default card's look too.
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "appearance.reset" })); });
    expect(look()).toEqual({ density: "standard", size: "m", view: "grid", labels: "auto", rows: "" });
    expect(mineCard()).not.toBeNull();
  });

  test("Reset asks first; No keeps everything", async () => {
    repo.get.mockResolvedValue(doc({ data: mine }));
    await mount();
    await act(async () => { fireEvent.click(screen.getByTestId("my-interface-reset")); });
    const dialog = await screen.findByRole("dialog");
    expect(dialog.textContent).toContain("appearance.my.resetConfirm");
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "action.cancel" })); });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(root().dataset.density).toBe("compact");
    expect(screen.queryByText("appearance.unsaved")).toBeNull();
  });

  test("Reset, confirmed and saved: the default look and board, and the card is gone", async () => {
    window.localStorage.setItem(boardKey(5), JSON.stringify({ v: 1, gap_y: 16 }));
    repo.get.mockResolvedValue(doc({ data: mine }));
    await mount();
    await act(async () => { fireEvent.click(screen.getByTestId("my-interface-reset")); });
    const dialog = await screen.findByRole("dialog");
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "appearance.my.reset" })); });
    await waitFor(() => expect(root().dataset.density).toBe("standard"));
    expect(css().getPropertyValue("--board-gap-y")).toBe("");
    await save();
    expect(lastSent().data.interface).toBe("standard");
    expect(localBoard()).toEqual({ v: 1, gap_y: null });
    expect(mineCard()).toBeNull();
  });
});

describe("branch sections in the side menu", () => {
  const row = (id: string) => screen.queryByTestId(`menu-row-${id}`);

  test("a manager is offered exactly the sections the hub offers them, for their own branch", async () => {
    await mount();
    const list = screen.getByTestId("branch-shortcuts");
    const offered = within(list).getAllByRole("switch").map((s) => s.getAttribute("data-testid"));
    expect(offered).toEqual(branchSectionsFor("manager").map((s) => `shortcut-${s.key}`));
    expect(within(list).queryByTestId("shortcut-places")).toBeNull(); // the owner's
    expect(screen.queryByTestId("branch-shortcuts-branch")).toBeNull(); // one branch: no picker
  });

  test("switched on: in the menu editor, saved once; switched off (either place): gone", async () => {
    await mount();
    await flip("shortcut-sessions");
    expect(row("branch.sessions.9")).not.toBeNull();
    expect(sw("shortcut-sessions").checked).toBe(true);
    await save();
    const ids = lastSent().data.layout.sidebar.map((e) => e.id);
    expect(ids.filter((id) => id === "branch.sessions.9")).toHaveLength(1);

    await flip("shortcut-till");
    await flip("menu-show-branch.sessions.9"); // off in the editor
    expect(row("branch.sessions.9")).toBeNull();
    expect(sw("shortcut-sessions").checked).toBe(false);
    await save();
    const after = lastSent().data.layout.sidebar.map((e) => e.id);
    expect(after).toContain("branch.till.9");
    expect(after).not.toContain("branch.sessions.9");
  });

  test("an owner picks one of their branches, from the server's list for their company", async () => {
    auth.user = OWNER;
    branches.list.mockResolvedValue([
      { id: 12, company_id: 4, address: "Abovyan 1", city: "Yerevan" },
      { id: 13, company_id: 4, address: "Tumanyan 5", city: "Gyumri" },
    ]);
    await mount();
    expect(branches.list).toHaveBeenCalledWith({ company_id: 4 });
    expect(within(screen.getByTestId("branch-shortcuts")).queryByTestId("shortcut-places")).not.toBeNull();
    await act(async () => { fireEvent.change(screen.getByTestId("branch-shortcuts-branch"), { target: { value: "13" } }); });
    await flip("shortcut-till");
    expect((row("branch.till.13") as HTMLElement).textContent).toContain("Tumanyan 5, Gyumri");
    await save();
    expect(lastSent().data.layout.sidebar.at(-1)).toEqual({ id: "branch.till.13", hidden: false });
  });

  test("an owner's branch list that cannot be read says so and offers nothing", async () => {
    auth.user = OWNER;
    branches.list.mockRejectedValue(new Error("offline"));
    await mount();
    expect(screen.getByRole("alert").textContent).toBe("appearance.menu.branchesFailed");
    expect(screen.queryByTestId("branch-shortcuts")).toBeNull();
  });

  test("an admin is offered no shortcuts, and no branch list is read for them", async () => {
    auth.user = { id: 1, role: "admin", dashboard: { branch_id: null, company_id: null } };
    await mount();
    expect(screen.queryByText("appearance.menu.branchSections")).toBeNull();
    expect(branches.list).not.toHaveBeenCalled();
  });

  test("Standard menu drops the person's order, hiding and shortcuts", async () => {
    repo.get.mockResolvedValue(doc({ data: { interface: "custom", layout: { sidebar: [
      { id: "branch.sessions.9", hidden: false }, { id: "nav.bookings", hidden: true },
    ] } } }));
    await mount();
    expect(row("branch.sessions.9")).not.toBeNull();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "appearance.menu.reset" })); });
    expect(row("branch.sessions.9")).toBeNull();
    await save();
    expect(lastSent().data.layout.sidebar).toEqual([]);
  });
});
