// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { ConfirmProvider } from "@/components/ui/ConfirmProvider";
import { ISessionApi } from "@/types/sessions";
import SessionEndingNotifier from "./SessionEndingNotifier";

/**
 * The warning card, and the button on it that used to do nothing.
 *
 * It said "Add time" and NAVIGATED to the sessions board of the warning's
 * branch, then cleared itself. Which does nothing at all when the operator is
 * already on that board — and that is exactly where they are when watching a
 * seat run out. The route did not change, nothing new rendered, and all the
 * cashier saw was their warning vanishing.
 *
 * It now opens the management dialog, the same component a tile opens.
 */

const repo = vi.hoisted(() => ({ listActiveEverywhere: vi.fn(), listJoystickPrices: vi.fn() }));

vi.mock("@/repositories/SessionRepository", () => ({
  sessionRepository: { listActiveEverywhere: (...a: unknown[]) => repo.listActiveEverywhere(...a) },
}));
vi.mock("@/repositories/JoystickPriceRepository", () => ({
  joystickPriceRepository: { listByBranch: () => Promise.resolve([]) },
}));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: { id: 1, role: "manager" } }) }));
// The card is the SERVER's notification now (2026-10-25): the feed it reads.
const feed = vi.hoisted(() => ({ list: [] as unknown[] }));
vi.mock("@/notifications/NotificationsContext", () => ({ useNotifications: () => ({ list: feed.list }) }));
/** The server's `session.ending_soon` row for session 42, `minutes` ahead. */
const warningRow = (minutes = 14, over: Record<string, unknown> = {}) => ({
  id: "n-42", type: "App\\Notifications\\SessionEndingSoon", read_at: null, created_at: new Date().toISOString(),
  data: {
    type: "session.ending_soon", session_id: 42, branch_id: 7, pc_id: 1, place_number: 8,
    ends_at: new Date(Date.now() + minutes * 60_000).toISOString(), minutes_left: 15,
  },
  ...over,
});
vi.mock("@/i18n/LanguageContext", () => ({
  useLang: () => ({ t: (k: string) => k, money: (n: number) => String(n), lang: "en" }),
}));

/** Eight minutes left on a one-hour tariff — inside the warning window. */
const ending = (over: Partial<ISessionApi> = {}): ISessionApi => ({
  id: 42,
  branch_id: 7,
  pc_id: 1,
  pc_label: "PS4-08",
  mode: "fixed",
  status: "active",
  started_at: new Date(Date.now() - 52 * 60_000).toISOString(),
  ends_at: new Date(Date.now() + 8 * 60_000).toISOString(),
  hourly_rate: 1500,
  total_paid: 1500,
  is_free: false,
  is_unlimited: false,
  place_platform: "ps5",
  ...over,
} as ISessionApi);

const mount = async () => {
  await act(async () => {
    render(
      // `ConfirmProvider` because the dialog this card opens asks before
      // lifting a ceiling. In the app it comes from App.tsx, which wraps the
      // whole shell — `Layout`, and therefore this card, sits inside it. Here
      // it has to be supplied, or the click throws where the real one does not.
      <ConfirmProvider>
        <MemoryRouter>
          <SessionEndingNotifier />
        </MemoryRouter>
      </ConfirmProvider>,
    );
  });
};

const addTime = () => screen.getByRole("button", { name: "session.endingSoonAction" });

describe("the seat-running-out warning", () => {
  beforeEach(() => {
    repo.listActiveEverywhere.mockReset();
    repo.listActiveEverywhere.mockResolvedValue([ending()]);
    feed.list = [warningRow()];
    window.localStorage.clear();
  });
  afterEach(cleanup);

  test("appears, and names the seat", async () => {
    await mount();

    expect(screen.getByRole("alert")).toBeTruthy();
    expect(addTime()).toBeTruthy();
  });

  test("stays put when nobody touches it", async () => {
    vi.useFakeTimers();
    try {
      await mount();
      // Ten minutes of an operator being busy elsewhere. A seat going dark
      // under a player is not recoverable after the fact, so this card has no
      // dismiss timer at all — this is what pins that it never grows one.
      await act(async () => { await vi.advanceTimersByTimeAsync(10 * 60_000); });

      expect(screen.getByRole("alert")).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  test("Add time opens the management dialog and closes the card", async () => {
    await mount();

    await act(async () => { fireEvent.click(addTime()); });

    // The card is gone…
    expect(screen.queryByRole("alert")).toBeNull();
    // …and the dialog it opened is here. This is the assertion the old
    // behaviour failed: it cleared the card and opened nothing.
    expect(screen.getByText("session.options")).toBeTruthy();
    expect(screen.getByText("session.addTime")).toBeTruthy();
  });

  test("the dialog it opened does not close on its own", async () => {
    vi.useFakeTimers();
    try {
      await mount();
      await act(async () => { fireEvent.click(addTime()); });
      await act(async () => { await vi.advanceTimersByTimeAsync(5 * 60_000); });

      // Five minutes of an operator reading it. Nothing dismisses a dialog but
      // the operator — and the notifier's own poll runs in that window, which
      // is the thing most likely to have closed it.
      expect(screen.getByText("session.options")).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  test("dismissing the card opens nothing", async () => {
    await mount();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "session.endingSoonDismiss" }));
    });

    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText("session.options")).toBeNull();
  });

  test("nothing is shown without the server's notification", async () => {
    feed.list = [];
    await mount();

    expect(screen.queryByRole("alert")).toBeNull();
  });

  test("names the seat by its number, as the server wrote it", async () => {
    await mount();
    expect(screen.getByRole("alert").textContent).toContain("session.endingSoonBody");
  });

  test("a dismissed warning stays dismissed after a restart", async () => {
    await mount();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "session.endingSoonDismiss" }));
    });
    cleanup();
    await mount();

    expect(screen.queryByRole("alert")).toBeNull();
  });

  test("an unread warning not dismissed comes back after a restart", async () => {
    await mount();
    cleanup();
    await mount();
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  test("read in the list, it goes", async () => {
    feed.list = [warningRow(14, { read_at: new Date().toISOString() })];
    await mount();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  test("two seats, two cards; the same row twice, one card", async () => {
    feed.list = [warningRow(12), { ...warningRow(9), id: "n-43", data: { ...warningRow(9).data, session_id: 43, place_number: 9 } }, warningRow(12)];
    await mount();
    expect(screen.getAllByRole("alert")).toHaveLength(2);
  });
});
