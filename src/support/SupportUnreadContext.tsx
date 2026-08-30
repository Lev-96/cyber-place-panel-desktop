import { useAuth } from "@/auth/AuthContext";
import { can } from "@/auth/permissions";
import { useNotifications } from "@/notifications/NotificationsContext";
import { getEcho, realtimeVersion } from "@/realtime/echo";
import { useRealtimeVersion } from "@/realtime/useRealtimeVersion";
import { supportRepository } from "@/repositories/SupportRepository";
import type { IDbNotification } from "@/api/notifications";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * How many support replies nobody has read, and when a new one lands.
 *
 * ## Where this gets its realtime from — and why it is not a new subscription
 * A support reply already becomes a `notifications` row, pushed on the existing
 * per-user private channel `user.{id}.notifications`. This listens on THAT
 * channel, through the same Echo client every other live screen uses — no
 * second socket, no second event, no second contract to keep in step.
 *
 * It listens itself rather than reading `NotificationsContext`, because that
 * context is deliberately manager-only: the bell counts bookings and
 * tournaments, which owners and admins are not shown. Support is for all three
 * roles, so hanging the badge off the manager-only feed would have left owners
 * and admins with a badge that never moved and a toast that never appeared —
 * which is exactly what happened when this was first wired that way.
 *
 * The manager feed is still watched as well. For a manager the same row can
 * arrive twice, once from each path, and the dedup below makes that a no-op —
 * while a poll that lands after a dropped socket still moves the badge.
 *
 * The count itself is seeded from the server (`unread` per conversation, summed)
 * and moved by arrivals. Seeded rather than counted from the feed because the
 * feed is a session's worth of events and the badge has to be right for
 * somebody who just signed in.
 *
 * ## Deduplication
 * By notification id, in a Set that only grows within a session. Reverb can
 * deliver the same event twice — a reconnect that replays, two components
 * mounting the same channel — and the cost of getting this wrong is a badge
 * that over-counts, a chime that fires twice and two identical toasts stacked
 * on each other. The id is the message's identity, so seeing it again is not an
 * arrival.
 *
 * ## The screen tells us where the reader is
 * `setActiveConversation` is how the Support screen says "this thread is on
 * screen". A reply to a thread somebody is reading is not unread — the screen
 * marks it read the moment it renders — so counting it would light a badge for
 * a message being read, and the user would have to go clear a notification
 * about the thing they are looking at.
 */

export interface SupportArrival {
  /** The notification row id — the dedup key. */
  id: string;
  conversationId: number | null;
  reference: string | null;
  senderName: string;
  preview: string;
}

interface SupportUnreadShape {
  unread: number;
  /** The latest arrival not yet shown, or null. Consumed by the notifier. */
  arrival: SupportArrival | null;
  /** The notifier calls this once it has surfaced an arrival. */
  clearArrival: () => void;
  /** Re-read the authoritative count from the server. */
  refresh: () => Promise<void>;
  /** The thread currently on screen, or null when Support is not open. */
  setActiveConversation: (id: number | null) => void;
}

const Ctx = createContext<SupportUnreadShape | null>(null);

interface SupportNotificationData {
  type?: string;
  conversation_id?: number;
  reference?: string;
  sender_name?: string;
  preview?: string;
}

export const SupportUnreadProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const { list } = useNotifications();

  const [unread, setUnread] = useState(0);
  const [arrival, setArrival] = useState<SupportArrival | null>(null);
  const seen = useRef<Set<string>>(new Set());
  const activeConversation = useRef<number | null>(null);
  // The first pass over the notification feed is history, not arrivals: a
  // person signing in must not be greeted by a chime per unread reply from
  // yesterday.
  const primed = useRef(false);

  const enabled = can(user?.role, "menu.support");
  const version = useRealtimeVersion();

  const refresh = useCallback(async () => {
    if (!enabled) return;
    const conversations = await supportRepository.list();
    setUnread(conversations.reduce((sum, c) => sum + (c.unread ?? 0), 0));
  }, [enabled]);

  useEffect(() => {
    if (!enabled) { setUnread(0); return; }
    void refresh();
  }, [enabled, refresh, user?.id]);

  /**
   * One notification row becomes at most one arrival.
   *
   * In a ref because both the channel listener and the feed watcher call it,
   * and a listener bound once must not close over a stale copy of it.
   */
  const accept = useRef((row: { id: string; data?: unknown }) => {
    if (seen.current.has(row.id)) return;
    seen.current.add(row.id);

    const data = (row.data ?? {}) as SupportNotificationData;
    const conversationId = data.conversation_id ?? null;

    // A reply to the thread on screen is read as it arrives, so it is not
    // unread — but it still deserves the chime and the toast, because the
    // reader may be scrolled up or looking at another window.
    if (conversationId === null || conversationId !== activeConversation.current) {
      setUnread((n) => n + 1);
    }

    setArrival({
      id: row.id,
      conversationId,
      reference: data.reference ?? null,
      senderName: data.sender_name || "Cyber Place Support",
      preview: data.preview || "",
    });
  });

  useEffect(() => {
    if (!enabled) return;

    const supportRows = list.filter((row) => {
      const data = row.data as SupportNotificationData | undefined;
      return data?.type === "support.reply";
    });

    if (!primed.current) {
      // Remember what was already there; only what arrives AFTER this counts.
      for (const row of supportRows) seen.current.add(row.id);
      primed.current = true;
      return;
    }

    for (const row of supportRows) accept.current(row);
  }, [list, enabled]);

  /**
   * The push itself — the same private channel the bell uses.
   *
   * Bound with `.listen` on a channel Echo hands back per name, so a manager
   * whose `NotificationsContext` is already on this channel gets a second
   * handler rather than a second subscription. `useRealtimeVersion` re-attaches
   * when the client is rebuilt: a listener on a discarded socket looks alive
   * and receives nothing.
   */
  useEffect(() => {
    if (!enabled || !user?.id) return;
    const echo = getEcho();
    // No socket: the count still seeds from the server on mount, and the screen
    // itself refetches. The badge is late, not wrong.
    if (!echo) return;

    const channel = echo.private(`user.${user.id}.notifications`);
    const listener = (payload: unknown) => {
      const row = payload as IDbNotification;
      if (!row?.id) return;
      if ((row.data as SupportNotificationData | undefined)?.type !== "support.reply") return;
      accept.current(row);
    };
    channel.listen(".notification.created", listener);

    return () => { channel.stopListening(".notification.created", listener); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, user?.id, version, realtimeVersion]);

  const value = useMemo<SupportUnreadShape>(() => ({
    unread,
    arrival,
    clearArrival: () => setArrival(null),
    refresh,
    setActiveConversation: (id) => { activeConversation.current = id; },
  }), [unread, arrival, refresh]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

/**
 * Safe outside the provider: the sidebar renders on screens that do not mount
 * it (the login shell), and a hook that throws there would take the whole app
 * down over a badge.
 */
export const useSupportUnread = (): SupportUnreadShape =>
  useContext(Ctx) ?? {
    unread: 0,
    arrival: null,
    clearArrival: () => {},
    refresh: async () => {},
    setActiveConversation: () => {},
  };
