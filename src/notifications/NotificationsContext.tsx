import { useAuth } from "@/auth/AuthContext";
import {
  apiMarkAllNotificationsRead,
  apiMarkNotificationRead,
  apiNotifications,
  apiNotificationsUnreadCount,
  type IDbNotification,
} from "@/api/notifications";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

/**
 * App-shell-level cache for the user's database notifications feed.
 *
 * Why a context (not a hook per consumer):
 *   - The sidebar badge and the Notifications page need the same
 *     unread count. Two `useAsync(apiNotifications)` would duplicate
 *     traffic and could disagree mid-poll.
 *   - `<GlobalBookingNotifier />` listens to `booking.changed` over
 *     Reverb. When an event lands, it nudges `bumpRefetch()` here so
 *     every consumer (badge + list) sees the new row without a full
 *     poll round-trip.
 *
 * Polling fallback (60s) covers the rare WS-drop case so the badge
 * eventually catches up.
 */
interface NotificationsContextShape {
  list: IDbNotification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

const Ctx = createContext<NotificationsContextShape | null>(null);

const POLL_MS = 60_000;

export const NotificationsProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [list, setList] = useState<IDbNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tracks whether the screen is mounted — we don't write state on a
  // late response that returned after unmount.
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!user) {
      setList([]);
      setUnreadCount(0);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const page = await apiNotifications(1, 50);
      if (!aliveRef.current) return;
      setList(page.data);
      setUnreadCount(page.meta.unread_count);
    } catch (e) {
      if (!aliveRef.current) return;
      const msg = e instanceof Error ? e.message : "Failed to load notifications";
      setError(msg);
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }, [user]);

  // Initial load + on user change.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Poll fallback — covers the rare case where a Reverb event was
  // missed and we'd otherwise show a stale badge until the user
  // opens the page.
  useEffect(() => {
    if (!user) return;
    const id = setInterval(() => {
      void apiNotificationsUnreadCount()
        .then(({ unread_count }) => {
          if (aliveRef.current) setUnreadCount(unread_count);
        })
        .catch(() => {
          /* network blip — keep current count, next tick will retry */
        });
    }, POLL_MS);
    return () => clearInterval(id);
  }, [user]);

  const markRead = useCallback(async (id: string) => {
    // Optimistic patch so the badge moves immediately; rollback on
    // failure.
    const prevList = list;
    const prevCount = unreadCount;
    setList((cur) =>
      cur.map((n) =>
        n.id === id && n.read_at === null
          ? { ...n, read_at: new Date().toISOString() }
          : n,
      ),
    );
    setUnreadCount((c) => Math.max(0, c - (prevList.find((n) => n.id === id && n.read_at === null) ? 1 : 0)));
    try {
      await apiMarkNotificationRead(id);
    } catch {
      setList(prevList);
      setUnreadCount(prevCount);
    }
  }, [list, unreadCount]);

  const markAllRead = useCallback(async () => {
    const prevList = list;
    const prevCount = unreadCount;
    const now = new Date().toISOString();
    setList((cur) => cur.map((n) => (n.read_at ? n : { ...n, read_at: now })));
    setUnreadCount(0);
    try {
      await apiMarkAllNotificationsRead();
    } catch {
      setList(prevList);
      setUnreadCount(prevCount);
    }
  }, [list, unreadCount]);

  const value = useMemo<NotificationsContextShape>(
    () => ({ list, unreadCount, loading, error, refresh, markRead, markAllRead }),
    [list, unreadCount, loading, error, refresh, markRead, markAllRead],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export const useNotifications = (): NotificationsContextShape => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useNotifications must be used within NotificationsProvider");
  return ctx;
};
