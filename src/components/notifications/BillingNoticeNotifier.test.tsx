// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

/**
 * A platform payment notice arriving rings once (owner, 2026-11-09: they came
 * in silence). The ones already there when the panel loads are not news.
 */

const sound = vi.hoisted(() => ({ playFor: vi.fn(() => true) }));
vi.mock("@/sound/soundEngine", () => ({ playFor: sound.playFor }));
const os = vi.hoisted(() => ({ show: vi.fn() }));
vi.mock("@/utils/desktopNotification", () => ({ showDesktopNotification: os.show }));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: { id: 3, role: "company_owner" } }) }));
vi.mock("@/i18n/LanguageContext", () => ({ useLang: () => ({ lang: "ru", t: (k: string) => k }) }));
vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn() }));
const feed = vi.hoisted(() => ({ value: { list: [] as unknown[], settled: false } }));
vi.mock("@/notifications/NotificationsContext", () => ({ useNotificationsOptional: () => feed.value }));

import BillingNoticeNotifier from "./BillingNoticeNotifier";

const notice = (id: string, kind = "overdue_d2", read: string | null = null) => ({
  id, type: "⚠️ …", read_at: read, created_at: "2026-11-09T09:00:00+04:00",
  data: { type: `platform_billing.${kind}`, invoice_id: 1, company_id: 2, company_name: "NextLevel", balance: "5000.00", currency: "AMD", effective_due_on: "2026-07-10", restriction_on: "2026-07-15", period_start: "2026-06-01", period_end: "2026-06-30" },
});
const seat = { id: "s1", type: "App\\\\Notifications\\\\SessionEndingSoon", read_at: null, created_at: "2026-11-09T09:00:00+04:00", data: { type: "session.ending_soon" } };

const show = (list: unknown[], settled = true) => {
  feed.value = { list, settled };
};

beforeEach(() => { sound.playFor.mockClear(); os.show.mockClear(); feed.value = { list: [], settled: false }; });
afterEach(cleanup);

describe("billing notices ring when they arrive", () => {
  test("silent for what was already there; one ring and one OS notice per new unread notice", () => {
    show([notice("old")]);
    const { rerender } = render(<BillingNoticeNotifier />);
    expect(sound.playFor).not.toHaveBeenCalled();

    show([notice("new"), notice("old")]);
    rerender(<BillingNoticeNotifier />);
    expect(sound.playFor).toHaveBeenCalledTimes(1);
    expect(sound.playFor).toHaveBeenCalledWith("platform_billing", "new");
    expect(os.show).toHaveBeenCalledTimes(1);
    // The Armenian title for an owner.
    expect(os.show.mock.calls[0][0]).toBe("Վճարումն ուշացել է");

    // The same list again (a re-render, a replay): nothing more.
    show([notice("new"), notice("old")]);
    rerender(<BillingNoticeNotifier />);
    expect(sound.playFor).toHaveBeenCalledTimes(1);
  });

  test("a read notice and a seat notice never ring here", () => {
    show([]);
    const { rerender } = render(<BillingNoticeNotifier />);
    show([notice("read", "restored", "2026-11-09T10:00:00+04:00"), seat]);
    rerender(<BillingNoticeNotifier />);
    expect(sound.playFor).not.toHaveBeenCalled();
    expect(os.show).not.toHaveBeenCalled();
  });

  test("nothing before the list has loaded", () => {
    show([notice("a")], false);
    const { rerender } = render(<BillingNoticeNotifier />);
    show([notice("a")], true);
    rerender(<BillingNoticeNotifier />);
    expect(sound.playFor).not.toHaveBeenCalled();
  });
});
