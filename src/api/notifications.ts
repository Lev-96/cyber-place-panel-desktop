import { request } from "./client";

/**
 * One row from the backend's `notifications` table — written by every
 * `Notification::send(...)` call that includes the `database` channel
 * (BookingCreated, BookingExtended, future tournament/billing pushes).
 *
 * The `data` payload's shape depends on `type`. Only the keys we
 * actually render are typed here; new fields on the server side
 * surface as `unknown` until we widen this interface deliberately.
 */
export interface IDbNotification {
  id: string;
  /** Fully-qualified PHP class — e.g. `App\\Notifications\\BookingCreated`. */
  type: string;
  data: {
    type?: string;
    booking_id?: number;
    code?: string | number | null;
    company_id?: number;
    branch_id?: number;
    game_id?: number;
    booking_date?: string;
    start_time?: string;
    [key: string]: unknown;
  };
  /** ISO timestamp; null when unread. */
  read_at: string | null;
  created_at: string;
}

export interface INotificationsPage {
  data: IDbNotification[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    unread_count: number;
  };
}

export const apiNotifications = (page = 1, perPage = 20) =>
  request<INotificationsPage>(
    `/notifications?page=${page}&per_page=${perPage}`,
  );

export const apiNotificationsUnreadCount = () =>
  request<{ unread_count: number }>("/notifications/unread-count");

export const apiMarkNotificationRead = (id: string) =>
  request<{ id: string; read_at: string }>(
    `/notifications/${encodeURIComponent(id)}/read`,
    { method: "POST" },
  );

export const apiMarkAllNotificationsRead = () =>
  request<{ unread_count: number }>("/notifications/read-all", {
    method: "POST",
  });
