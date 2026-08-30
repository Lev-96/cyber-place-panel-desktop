// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { SupportUnreadProvider, useSupportUnread } from "./SupportUnreadContext";
import type { IDbNotification } from "@/api/notifications";

/**
 * The badge, the chime and the toast all hang off this one hook, and every
 * rule worth having here is a rule about NOT firing:
 *
 *   - what was already in the feed when the app started is history;
 *   - the same notification delivered twice is one arrival;
 *   - a reply to the thread on screen is read as it lands, so it is not unread.
 *
 * Each of those is a sound playing when it should not, which is the failure
 * people actually complain about — so each gets a test.
 */

const repo = vi.hoisted(() => ({ list: vi.fn() }));
const feed = vi.hoisted(() => ({ list: [] as IDbNotification[] }));
/** A stand-in for the private notifications channel, so a test can push. */
const socket = vi.hoisted(() => ({
  channels: [] as string[],
  handlers: [] as ((payload: unknown) => void)[],
  push(payload: unknown) { for (const h of this.handlers) h(payload); },
}));

vi.mock("@/repositories/SupportRepository", () => ({
  supportRepository: { list: (...a: unknown[]) => repo.list(...a) },
}));
vi.mock("@/notifications/NotificationsContext", () => ({
  useNotifications: () => ({ list: feed.list }),
}));
vi.mock("@/auth/AuthContext", () => ({
  // An OWNER on purpose: the bell feed is manager-only, so an owner is the
  // role whose badge and toast depend entirely on the channel below.
  useAuth: () => ({ user: { id: 7, role: "company_owner" } }),
}));
vi.mock("@/realtime/echo", () => ({
  realtimeVersion: 0,
  getEcho: () => ({
    private: (name: string) => {
      socket.channels.push(name);
      return {
        listen: (_event: string, handler: (payload: unknown) => void) => { socket.handlers.push(handler); },
        stopListening: (_event: string, handler: (payload: unknown) => void) => {
          socket.handlers = socket.handlers.filter((h) => h !== handler);
        },
      };
    },
  }),
}));
vi.mock("@/realtime/useRealtimeVersion", () => ({ useRealtimeVersion: () => 0 }));

const reply = (id: string, conversationId = 1): IDbNotification => ({
  id,
  type: "App\\Notifications\\SupportReplyReceived",
  data: {
    type: "support.reply",
    conversation_id: conversationId,
    reference: "SUP-100",
    sender_name: "Support",
    preview: "we are on it",
  },
  read_at: null,
  created_at: "2026-08-30T10:00:00Z",
} as unknown as IDbNotification);

/** Renders the numbers under test and exposes the setter the screen calls. */
let setActive: (id: number | null) => void = () => {};

const Probe = () => {
  const { unread, arrival, setActiveConversation } = useSupportUnread();
  setActive = setActiveConversation;
  return (
    <div>
      <span data-testid="unread">{unread}</span>
      <span data-testid="arrival">{arrival?.id ?? "none"}</span>
    </div>
  );
};

const mount = () => render(<SupportUnreadProvider><Probe /></SupportUnreadProvider>);

beforeEach(() => {
  repo.list.mockReset();
  repo.list.mockResolvedValue([{ unread: 0 }]);
  feed.list = [];
  socket.channels = [];
  socket.handlers = [];
});
afterEach(cleanup);

describe("SupportUnreadContext", () => {
  test("what was already in the feed is history: no arrival, no count", async () => {
    feed.list = [reply("n1"), reply("n2")];
    const view = mount();
    await act(async () => {});

    expect(screen.getByTestId("arrival").textContent).toBe("none");
    // The count is the server's, not a tally of the feed.
    expect(screen.getByTestId("unread").textContent).toBe("0");
    view.unmount();
  });

  test("a notification arriving after that counts once and surfaces", async () => {
    const view = mount();
    await act(async () => {});

    feed.list = [reply("n1")];
    view.rerender(<SupportUnreadProvider><Probe /></SupportUnreadProvider>);
    await act(async () => {});

    expect(screen.getByTestId("unread").textContent).toBe("1");
    expect(screen.getByTestId("arrival").textContent).toBe("n1");
    view.unmount();
  });

  test("the same notification delivered twice is not a second arrival", async () => {
    const view = mount();
    await act(async () => {});

    feed.list = [reply("n1")];
    view.rerender(<SupportUnreadProvider><Probe /></SupportUnreadProvider>);
    await act(async () => {});
    // A reconnect replays the row, and a poll returns it again.
    feed.list = [reply("n1"), reply("n1")];
    view.rerender(<SupportUnreadProvider><Probe /></SupportUnreadProvider>);
    await act(async () => {});

    expect(screen.getByTestId("unread").textContent).toBe("1");
    view.unmount();
  });

  test("a reply to the open thread is not unread, but still surfaces", async () => {
    const view = mount();
    await act(async () => {});
    act(() => setActive(1));

    feed.list = [reply("n1", 1)];
    view.rerender(<SupportUnreadProvider><Probe /></SupportUnreadProvider>);
    await act(async () => {});

    expect(screen.getByTestId("unread").textContent).toBe("0");
    // The reader may be scrolled away or in another window: the toast still shows.
    expect(screen.getByTestId("arrival").textContent).toBe("n1");
    view.unmount();
  });

  test("a reply to another thread counts while one is open", async () => {
    const view = mount();
    await act(async () => {});
    act(() => setActive(1));

    feed.list = [reply("n9", 2)];
    view.rerender(<SupportUnreadProvider><Probe /></SupportUnreadProvider>);
    await act(async () => {});

    expect(screen.getByTestId("unread").textContent).toBe("1");
    view.unmount();
  });

  test("non-support notifications are ignored entirely", async () => {
    const view = mount();
    await act(async () => {});

    feed.list = [{ ...reply("b1"), data: { type: "booking.created" } } as IDbNotification];
    view.rerender(<SupportUnreadProvider><Probe /></SupportUnreadProvider>);
    await act(async () => {});

    expect(screen.getByTestId("unread").textContent).toBe("0");
    expect(screen.getByTestId("arrival").textContent).toBe("none");
    view.unmount();
  });

  test("an owner is served by the channel, not by the manager-only bell feed", async () => {
    mount();
    await act(async () => {});

    // Subscribed to the user's own notifications channel...
    expect(socket.channels).toContain("user.7.notifications");
    // ...and a push on it is what moves the badge, with the feed left empty.
    await act(async () => { socket.push(reply("push-1", 5)); });

    expect(screen.getByTestId("unread").textContent).toBe("1");
    expect(screen.getByTestId("arrival").textContent).toBe("push-1");
  });

  test("a row that arrives on both paths is still one arrival", async () => {
    const view = mount();
    await act(async () => {});
    await act(async () => { socket.push(reply("both-1", 5)); });

    // The manager poll then returns the very same row.
    feed.list = [reply("both-1", 5)];
    view.rerender(<SupportUnreadProvider><Probe /></SupportUnreadProvider>);
    await act(async () => {});

    expect(screen.getByTestId("unread").textContent).toBe("1");
    view.unmount();
  });

  test("a push that is not a support reply is ignored", async () => {
    mount();
    await act(async () => {});
    await act(async () => {
      socket.push({ ...reply("b2"), data: { type: "booking.created" } });
    });

    expect(screen.getByTestId("unread").textContent).toBe("0");
    expect(screen.getByTestId("arrival").textContent).toBe("none");
  });

  test("the seed is the server's per-conversation unread, summed", async () => {
    repo.list.mockResolvedValue([{ unread: 2 }, { unread: 3 }, { unread: 0 }]);
    mount();
    await act(async () => {});

    expect(screen.getByTestId("unread").textContent).toBe("5");
  });
});
