// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

/**
 * A player's rating of the club arriving rings once and shows an OS notice
 * (2026-11-27, owner: «уведомления со звуком»). What was there at load is
 * not news; a read row and another kind never ring here.
 */
const sound = vi.hoisted(() => ({ playFor: vi.fn(() => true) }));
vi.mock("@/sound/soundEngine", () => ({ playFor: sound.playFor }));
const os = vi.hoisted(() => ({ show: vi.fn() }));
vi.mock("@/utils/desktopNotification", () => ({ showDesktopNotification: os.show }));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: { id: 3, role: "manager" } }) }));
vi.mock("@/i18n/LanguageContext", async () => {
  const { t } = await import("@/i18n/translations");
  return { useLang: () => ({ lang: "ru", t: (k: string) => t(k, "ru") }) };
});
vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn() }));
const feed = vi.hoisted(() => ({ value: { list: [] as unknown[], settled: false } }));
vi.mock("@/notifications/NotificationsContext", () => ({ useNotificationsOptional: () => feed.value }));

import ClubRatedNotifier from "./ClubRatedNotifier";

const rated = (id: string, read: string | null = null) => ({
  id, type: "…", read_at: read, created_at: "2026-11-27T12:00:00+04:00",
  data: { type: "bonus.club_rated", rating_id: 1, branch_id: 5, player_name: "Arman", stars: 2, tags: ["slow_net"], comment: "Лагало" },
});
const show = (list: unknown[], settled = true) => { feed.value = { list, settled }; };

beforeEach(() => { sound.playFor.mockClear(); os.show.mockClear(); feed.value = { list: [], settled: false }; });
afterEach(cleanup);

describe("a player's rating arriving", () => {
  test("silent for the past; one «Гости» sound and one OS notice per new unread row", () => {
    show([rated("old")]);
    const { rerender } = render(<ClubRatedNotifier />);
    expect(sound.playFor).not.toHaveBeenCalled();
    show([rated("new"), rated("old")]);
    rerender(<ClubRatedNotifier />);
    expect(sound.playFor).toHaveBeenCalledTimes(1);
    expect(sound.playFor).toHaveBeenCalledWith("guests", "club-rated:new");
    expect(os.show).toHaveBeenCalledTimes(1);
    expect(os.show.mock.calls[0][0]).toBe("★★☆☆☆ Arman оценил(а) клуб");
    expect(os.show.mock.calls[0][1].body).toBe("Лагал интернет · «Лагало»");
    show([rated("new"), rated("old")]);
    rerender(<ClubRatedNotifier />);
    expect(sound.playFor).toHaveBeenCalledTimes(1);
  });

  test("a read row and another kind never ring here", () => {
    show([]);
    const { rerender } = render(<ClubRatedNotifier />);
    show([rated("read", "2026-11-27T12:01:00+04:00"), { id: "x", type: "x", read_at: null, created_at: "", data: { type: "session.ending_soon" } }]);
    rerender(<ClubRatedNotifier />);
    expect(sound.playFor).not.toHaveBeenCalled();
    expect(os.show).not.toHaveBeenCalled();
  });
});
