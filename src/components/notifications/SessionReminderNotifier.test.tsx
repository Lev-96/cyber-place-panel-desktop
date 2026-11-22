// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import SessionReminderNotifier, { reminderCards } from "./SessionReminderNotifier";

/**
 * "The player asked to be reminded" (2026-11-15): the SERVER's
 * `session.reminder` notification (SessionReminderTest's `toArray`) as a card
 * for everyone it told — the SessionEndingNotifier idiom: the feed decides,
 * dismissing is remembered per user, the bell rings once per notification.
 */
const repo = vi.hoisted(() => ({ setReminder: vi.fn(), clearReminder: vi.fn() }));
vi.mock("@/repositories/SessionRepository", () => ({
  sessionRepository: {
    setReminder: (...a: unknown[]) => repo.setReminder(...a),
    clearReminder: (...a: unknown[]) => repo.clearReminder(...a),
  },
}));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: { id: 1, role: "manager" } }) }));
const feed = vi.hoisted(() => ({ list: [] as unknown[], markRead: vi.fn(async () => {}) }));
vi.mock("@/notifications/NotificationsContext", () => ({ useNotifications: () => ({ list: feed.list, markRead: feed.markRead }) }));
const sound = vi.hoisted(() => ({ playFor: vi.fn() }));
vi.mock("@/sound/soundEngine", () => ({ playFor: sound.playFor }));
const toast = vi.hoisted(() => ({ message: vi.fn() }));
vi.mock("@/ui/notify", () => ({ notify: { message: toast.message } }));
vi.mock("@/i18n/LanguageContext", () => ({
  useLang: () => ({ t: (k: string) => (k === "session.reminder.cardBody" ? "{seat}{player} {elapsed}" : k), money: String, lang: "en" }),
}));

/** `SessionReminderDue::toArray()` for seat №3, Арам, set 2 h ago with a note. */
const row = (over: Record<string, unknown> = {}, data: Record<string, unknown> = {}) => ({
  id: "r-5", type: "App\\Notifications\\SessionReminderDue", read_at: null, created_at: new Date().toISOString(),
  data: {
    type: "session.reminder", session_id: 5, branch_id: 7, company_id: 1, pc_id: 3, place_id: 13, place_number: 3,
    player_name: "Арам", note: "позвонить маме", minutes: 120, set_at: "2026-11-15T14:40:00+04:00",
    remind_at: "2026-11-15T16:40:00+04:00", set_by_user_id: 1, set_by_name: "Owner One", company_name: "Club", branch_address: "Abovyan 1",
    ...data,
  },
  ...over,
});

const Where = () => <span data-testid="where">{useLocation().pathname}</span>;
const mount = async () => {
  await act(async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <SessionReminderNotifier />
        <Routes><Route path="*" element={<Where />} /></Routes>
      </MemoryRouter>,
    );
  });
};

beforeEach(() => {
  window.localStorage.clear();
  feed.list = [];
  feed.markRead.mockClear();
  repo.setReminder.mockReset().mockResolvedValue({ id: 5 });
  repo.clearReminder.mockReset().mockResolvedValue({ id: 5 });
  sound.playFor.mockClear();
  toast.message.mockClear();
});
afterEach(cleanup);

describe("reminderCards", () => {
  test("unread session.reminder rows only, once each, not dismissed", () => {
    const list = [row(), row(), row({ id: "r-6", read_at: "2026-11-15T16:41:00Z" }), row({ id: "e-1" }, { type: "session.ending_soon" })];
    expect(reminderCards(list as never, new Set()).map((c) => c.id)).toEqual(["r-5"]);
    expect(reminderCards(list as never, new Set(["r-5"]))).toEqual([]);
  });
});

describe("the card", () => {
  test("seat, player, how long ago it was asked, the note; the bell once", async () => {
    feed.list = [row()];
    await mount();
    const card = screen.getByRole("alert");
    expect(card.textContent).toContain("№3 (Арам) 2 time.hourShort");
    expect(card.textContent).toContain("позвонить маме");
    expect(sound.playFor).toHaveBeenCalledWith("session_ending", "r-5");
  });

  test("the seat by number and name, as its card says it (2026-11-22)", async () => {
    feed.list = [row({}, { place_name: "Hall VIP" })];
    await mount();
    expect(screen.getByRole("alert").textContent).toContain("№3 · Hall VIP (Арам)");
  });

  test("no player name: no empty brackets", async () => {
    feed.list = [row({}, { player_name: null, note: null })];
    await mount();
    expect(screen.getByRole("alert").textContent).toContain("№3 2 time.hourShort");
    expect(screen.getByRole("alert").textContent).not.toContain("()");
  });

  test("«Понятно»: read, the seat's reminder cleared on the server, the card gone", async () => {
    feed.list = [row()];
    await mount();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "session.reminder.ok" })); });
    expect(feed.markRead).toHaveBeenCalledWith("r-5");
    expect(repo.clearReminder).toHaveBeenCalledWith(5);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  test("«Ещё 30 мин»: set again in 30 min with the same note", async () => {
    feed.list = [row()];
    await mount();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "session.reminder.snooze" })); });
    expect(repo.setReminder).toHaveBeenCalledWith(5, 30, "позвонить маме");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  test("«Открыть место»: the branch's board", async () => {
    feed.list = [row()];
    await mount();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "session.reminder.open" })); });
    expect(screen.getByTestId("where").textContent).toBe("/branches/7/sessions");
  });

  test("dismissed stays dismissed for this user after a remount", async () => {
    feed.list = [row()];
    await mount();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "session.reminder.ok" })); });
    cleanup();
    feed.markRead.mockClear();
    await mount();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
