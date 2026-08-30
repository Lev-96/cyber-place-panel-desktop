// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { SupportUnreadProvider, useSupportUnread } from "./SupportUnreadContext";
import type { SupportMessageEvent } from "@/realtime/useSupportMessages";

/**
 * The badge, the chime and the card all hang off this one store, and every
 * rule worth having here is a rule about NOT firing:
 *
 *   - a message this account sent is not an arrival;
 *   - the same message id twice is one arrival;
 *   - a reply to the thread on screen does not move the badge;
 *   - and nothing from before the app started can chime at all, because the
 *     only input is a live channel and a channel has no history.
 *
 * Each of those is a sound playing when it should not, which is the failure
 * people actually complain about. There is also one for what this store must
 * NOT touch: the bell's feed, which support used to ride and no longer does.
 */

const repo = vi.hoisted(() => ({ list: vi.fn() }));
/** Stands in for the private support channel, so a test can push a message. */
const channel = vi.hoisted(() => ({
  userIds: [] as (number | null)[],
  handler: null as ((e: unknown) => void) | null,
  push(event: unknown) { this.handler?.(event); },
}));
const bell = vi.hoisted(() => ({ used: false }));

vi.mock("@/repositories/SupportRepository", () => ({
  supportRepository: { list: (...a: unknown[]) => repo.list(...a) },
}));
vi.mock("@/realtime/useSupportMessages", () => ({
  useSupportMessages: (userId: number | null, onMessage: (e: unknown) => void) => {
    channel.userIds.push(userId);
    channel.handler = onMessage;
  },
}));
vi.mock("@/auth/AuthContext", () => ({
  useAuth: () => ({ user: { id: 7, role: "company_owner" } }),
}));
// Mocked only so that touching it is visible: support must not read the bell's
// feed, and a regression that reimports it would otherwise go unnoticed.
vi.mock("@/notifications/NotificationsContext", () => ({
  useNotifications: () => { bell.used = true; return { list: [] }; },
}));

const reply = (id: number, conversationId = 1): SupportMessageEvent => ({
  conversation_id: conversationId,
  reference: "CP-1001",
  message: {
    id,
    conversation_id: conversationId,
    sender: "support",
    sender_name: "Cyber Place Support",
    sender_role: "support",
    body: "we are on it",
    delivery: "not_applicable",
    delivery_error: null,
    read_at: null,
    created_at: "2026-08-31T10:00:00Z",
    attachments: [],
  },
});

const mine = (id: number, conversationId = 1): SupportMessageEvent => {
  const event = reply(id, conversationId);
  return { ...event, message: { ...event.message, sender: "staff", sender_name: "Owner" } };
};

/** Renders the numbers under test and exposes the setter the screen calls. */
let setActive: (id: number | null) => void = () => {};

const Probe = () => {
  const { unread, arrival, setActiveConversation } = useSupportUnread();
  setActive = setActiveConversation;
  return (
    <div>
      <span data-testid="unread">{unread}</span>
      <span data-testid="arrival">{arrival ? String(arrival.id) : "none"}</span>
      <span data-testid="preview">{arrival?.preview ?? ""}</span>
    </div>
  );
};

const mount = () => render(<SupportUnreadProvider><Probe /></SupportUnreadProvider>);

beforeEach(() => {
  repo.list.mockReset();
  repo.list.mockResolvedValue([{ unread: 0 }]);
  channel.userIds = [];
  channel.handler = null;
  bell.used = false;
});
afterEach(cleanup);

describe("SupportUnreadContext", () => {
  test("subscribes to this account's support channel and reads no other feed", async () => {
    mount();
    await act(async () => {});

    expect(channel.userIds).toContain(7);
    expect(bell.used).toBe(false);
  });

  test("a support reply counts once and surfaces", async () => {
    mount();
    await act(async () => {});

    await act(async () => { channel.push(reply(11)); });

    expect(screen.getByTestId("unread").textContent).toBe("1");
    expect(screen.getByTestId("arrival").textContent).toBe("11");
    expect(screen.getByTestId("preview").textContent).toBe("we are on it");
  });

  test("three replies count three, and leave one card showing the newest", async () => {
    mount();
    await act(async () => {});

    await act(async () => { channel.push(reply(11)); channel.push(reply(12)); channel.push(reply(13)); });

    expect(screen.getByTestId("unread").textContent).toBe("3");
    expect(screen.getByTestId("arrival").textContent).toBe("13");
  });

  test("the same message id twice is one arrival", async () => {
    mount();
    await act(async () => {});

    await act(async () => { channel.push(reply(11)); });
    // A reconnect replays it, and the chat's own handler sees it too.
    await act(async () => { channel.push(reply(11)); });

    expect(screen.getByTestId("unread").textContent).toBe("1");
  });

  test("a message this account sent is not an arrival", async () => {
    mount();
    await act(async () => {});

    await act(async () => { channel.push(mine(21)); });

    expect(screen.getByTestId("unread").textContent).toBe("0");
    expect(screen.getByTestId("arrival").textContent).toBe("none");
  });

  test("a reply to the open thread does not count, but still surfaces", async () => {
    mount();
    await act(async () => {});
    act(() => setActive(1));

    await act(async () => { channel.push(reply(11, 1)); });

    expect(screen.getByTestId("unread").textContent).toBe("0");
    // The reader may be scrolled away or in another window: the card still shows.
    expect(screen.getByTestId("arrival").textContent).toBe("11");
  });

  test("a reply to another thread counts while one is open", async () => {
    mount();
    await act(async () => {});
    act(() => setActive(1));

    await act(async () => { channel.push(reply(11, 2)); });

    expect(screen.getByTestId("unread").textContent).toBe("1");
  });

  /**
   * The restart case, and the reason a live channel is the right input: there
   * is no history to replay, so yesterday's unread replies come back as a
   * COUNT from the server and never as arrivals.
   */
  test("the seed is the server's per-conversation unread, and it does not chime", async () => {
    repo.list.mockResolvedValue([{ unread: 2 }, { unread: 3 }, { unread: 0 }]);
    mount();
    await act(async () => {});

    expect(screen.getByTestId("unread").textContent).toBe("5");
    expect(screen.getByTestId("arrival").textContent).toBe("none");
  });
});
