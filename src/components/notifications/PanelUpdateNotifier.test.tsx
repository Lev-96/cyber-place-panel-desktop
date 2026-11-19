// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import type { IDbNotification } from "@/api/notifications";
import type { DesktopUpdateState } from "@/types/desktopUpdates";
import { t as translate, type Lang } from "@/i18n/translations";

/**
 * "A new desktop version is out" made visible (2026-11-20, owner: a manager
 * never noticed it — it was a bell row only). The SERVER's notification
 * (`PanelUpdateAvailable::toArray`) as a corner card in the panel's language,
 * telling where to go and what to press, with a button that goes there.
 */
const auth = vi.hoisted(() => ({ user: { id: 7, role: "manager" } as { id: number; role: string } | null }));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: auth.user }) }));
const feed = vi.hoisted(() => ({ list: [] as IDbNotification[], settled: true, markRead: vi.fn(async (_id: string) => {}) }));
vi.mock("@/notifications/NotificationsContext", () => ({
  useNotificationsOptional: () => ({ list: feed.list, settled: feed.settled, markRead: feed.markRead }),
}));
const sound = vi.hoisted(() => ({ playFor: vi.fn() }));
vi.mock("@/sound/soundEngine", () => ({ playFor: sound.playFor }));
const os = vi.hoisted(() => ({ show: vi.fn() }));
vi.mock("@/utils/desktopNotification", () => ({ showDesktopNotification: os.show }));
const lang = vi.hoisted(() => ({ current: "ru" as Lang }));
vi.mock("@/i18n/LanguageContext", () => ({ useLang: () => ({ t: (k: string) => translate(k, lang.current), lang: lang.current }) }));

import PanelUpdateNotifier from "./PanelUpdateNotifier";

const row = (id: string, version: string, over: Partial<IDbNotification> = {}): IDbNotification => ({
  id,
  type: `A new Cyber Place version ${version} is ready: open «Updates»`,
  read_at: null,
  created_at: "2026-11-19T13:00:00Z",
  data: { type: "app_update.available", app: "panel", version, mandatory: false },
  ...over,
});

const state = (currentVersion: string): DesktopUpdateState => ({
  status: "not-available", currentVersion, availableVersion: null, progressPercent: null, notes: null, error: null,
});
const bridge = { getState: vi.fn(async () => state("1.0.66")), onState: vi.fn(() => () => {}), install: vi.fn(), check: vi.fn(), checkGated: vi.fn() };

const Where = () => <span data-testid="where">{useLocation().pathname}</span>;
const tree = (path: string) => (
  <MemoryRouter initialEntries={[path]}>
    <PanelUpdateNotifier />
    <Routes><Route path="*" element={<Where />} /></Routes>
  </MemoryRouter>
);
const mount = async (path = "/") => {
  let api!: ReturnType<typeof render>;
  await act(async () => { api = render(tree(path)); });
  await act(async () => { await Promise.resolve(); });
  return { rerender: async () => { await act(async () => { api.rerender(tree(path)); }); } };
};

beforeEach(() => {
  auth.user = { id: 7, role: "manager" };
  feed.list = [];
  feed.settled = true;
  feed.markRead.mockClear();
  sound.playFor.mockClear();
  os.show.mockClear();
  lang.current = "ru";
  bridge.getState.mockImplementation(async () => state("1.0.66"));
  (window as unknown as { cyberplaceUpdates?: unknown }).cyberplaceUpdates = bridge;
});
afterEach(() => { cleanup(); delete (window as unknown as { cyberplaceUpdates?: unknown }).cyberplaceUpdates; });

describe("the card", () => {
  test.each([
    ["ru", "Новая версия Cyber Place 1.0.68", "Откройте раздел «Обновление» и нажмите «Проверить обновления».", "Открыть Обновление", "Позже"],
    ["en", "New Cyber Place version 1.0.68", "Open the «Updates» section and press «Check for updates».", "Open Updates", "Later"],
    ["am", "Cyber Place-ի նոր տարբերակ՝ 1.0.68", "Բացեք «Թարմացում» բաժինը և սեղմեք «Ստուգել թարմացումները»։", "Բացել Թարմացումը", "Ավելի ուշ"],
  ] as const)("in %s: the version, where to go, what to press; the ding once", async (l, title, body, open, later) => {
    lang.current = l;
    feed.list = [row("n-68", "1.0.68")];
    await mount();
    const card = screen.getByTestId("panel-update-card");
    expect(card.textContent).toContain(title);
    expect(card.textContent).toContain(body);
    expect(screen.getByTestId("panel-update-open").textContent).toBe(open);
    expect(screen.getByTestId("panel-update-later").textContent).toBe(later);
    expect(card.textContent).not.toContain("is ready: open «Updates»");
    expect(sound.playFor).toHaveBeenCalledWith("system", "panel-update:n-68");
  });

  test("«Открыть Обновление» opens «Обновление», marks every waiting notice read, and the card goes", async () => {
    feed.list = [row("n-67", "1.0.67"), row("n-68", "1.0.68")];
    await mount();
    await act(async () => { fireEvent.click(screen.getByTestId("panel-update-open")); });
    expect(screen.getByTestId("where").textContent).toBe("/settings/agent-updates");
    expect(feed.markRead.mock.calls.map((c) => c[0]).sort()).toEqual(["n-67", "n-68"]);
    expect(screen.queryByTestId("panel-update-card")).toBeNull();
  });

  test("«Позже» hides it for this run without reading it; an older version does not take its place", async () => {
    feed.list = [row("n-67", "1.0.67"), row("n-68", "1.0.68")];
    const view = await mount();
    await act(async () => { fireEvent.click(screen.getByTestId("panel-update-later")); });
    expect(screen.queryByTestId("panel-update-card")).toBeNull();
    expect(feed.markRead).not.toHaveBeenCalled();
    await view.rerender();
    expect(screen.queryByTestId("panel-update-card")).toBeNull();
  });

  test("shown again on the next sign-in while still unread", async () => {
    feed.list = [row("n-68", "1.0.68")];
    await mount();
    await act(async () => { fireEvent.click(screen.getByTestId("panel-update-later")); });
    cleanup();
    await mount();
    expect(screen.getByTestId("panel-update-card")).toBeTruthy();
  });

  test("nothing when this desktop already runs that version", async () => {
    bridge.getState.mockImplementation(async () => state("1.0.68"));
    feed.list = [row("n-68", "1.0.68")];
    await mount();
    expect(screen.queryByTestId("panel-update-card")).toBeNull();
  });

  test("nothing in a browser (the owner web is always the newest)", async () => {
    delete (window as unknown as { cyberplaceUpdates?: unknown }).cyberplaceUpdates;
    feed.list = [row("n-68", "1.0.68")];
    await mount();
    expect(screen.queryByTestId("panel-update-card")).toBeNull();
  });

  test("nothing while «Обновление» itself is open", async () => {
    feed.list = [row("n-68", "1.0.68")];
    await mount("/settings/agent-updates");
    expect(screen.queryByTestId("panel-update-card")).toBeNull();
  });

  test("read rows are not shown", async () => {
    feed.list = [row("n-68", "1.0.68", { read_at: "2026-11-19T14:00:00Z" })];
    await mount();
    expect(screen.queryByTestId("panel-update-card")).toBeNull();
  });
});

describe("arriving while the panel is open (realtime)", () => {
  test("raises an OS notification once; one already in the list at start does not", async () => {
    feed.list = [row("n-67", "1.0.67")];
    const view = await mount();
    expect(os.show).not.toHaveBeenCalled();

    feed.list = [row("n-68", "1.0.68"), ...feed.list];
    await view.rerender();
    expect(os.show).toHaveBeenCalledTimes(1);
    const [title, options] = os.show.mock.calls[0];
    expect(title).toBe("Новая версия Cyber Place 1.0.68");
    expect(options.body).toBe("Откройте раздел «Обновление» и нажмите «Проверить обновления».");
    expect(screen.getByTestId("panel-update-card").textContent).toContain("1.0.68");

    await view.rerender();
    expect(os.show).toHaveBeenCalledTimes(1);
  });
});
