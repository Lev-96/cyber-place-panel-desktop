import { apiBillingReminders, IBillingReminder } from "@/api/billing";
import type { IDbNotification } from "@/api/notifications";
import { orFallback } from "@/api/fallback";
import { useAuth } from "@/auth/AuthContext";
import ScreenWithBg from "@/components/ui/ScreenWithBg";
import Spinner from "@/components/ui/Spinner";
import { useAsync } from "@/hooks/useAsync";
import { formatDate } from "@/i18n/dates";
import { useLang } from "@/i18n/LanguageContext";
import { useNotifications } from "@/notifications/NotificationsContext";
import { useNavigate } from "react-router-dom";

/**
 * Two feeds in one screen:
 *
 *   1. Database notifications (Laravel `notifications` table) — booking
 *      created / extended / future tournament announcements. Powered by
 *      `useNotifications()` so the sidebar badge and this list share
 *      one source of truth and one polling clock.
 *
 *   2. Billing reminders — derived feed served by `/billing/reminders`.
 *      Different cadence and storage (no per-row read state), kept in
 *      its own card group below.
 */
const Notifications = () => {
  const { user } = useAuth();
  const { t } = useLang();
  const isAdmin = user?.role === "admin";

  const {
    list,
    unreadCount,
    loading: loadingDb,
    error: errorDb,
    markRead,
    markAllRead,
  } = useNotifications();

  const billing = useAsync(
    () => orFallback(apiBillingReminders(7), { data: [] as IBillingReminder[] }),
    [],
  );

  if (loadingDb && list.length === 0 && billing.loading) return <Spinner />;
  if (errorDb && list.length === 0) return <div className="error">{errorDb}</div>;
  if (billing.error && (billing.data?.data ?? []).length === 0) {
    return <div className="error">{billing.error.message}</div>;
  }

  const billingList = billing.data?.data ?? [];

  return (
    <ScreenWithBg bg="./bg/notifications.jpg" title={t("notifications.title")}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 className="muted" style={{ margin: 0, fontSize: 14 }}>
          {t("notifications.bookingFeedTitle") || "Bookings"}
        </h3>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={() => void markAllRead()}
            style={{
              padding: "4px 10px",
              border: "1px solid #1f2a44",
              borderRadius: 6,
              background: "transparent",
              color: "#e5e7eb",
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            {t("notifications.markAllRead") || "Mark all as read"}
          </button>
        )}
      </div>

      {list.length === 0 ? (
        <div className="card">
          <div className="muted">{t("common.empty.notifications")}</div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12, marginBottom: 24 }}>
          {list.map((n) => (
            <DbNotificationCard
              key={n.id}
              n={n}
              onClick={() => void markRead(n.id)}
            />
          ))}
        </div>
      )}

      <h3 className="muted" style={{ margin: "24px 0 12px", fontSize: 14 }}>
        {t("notifications.billingFeedTitle") || "Billing"}
      </h3>
      {billingList.length === 0 ? (
        <div className="card">
          <div className="muted">{t("common.empty.notifications")}</div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {billingList.map((r) => (
            <ReminderCard key={r.id} r={r} isAdmin={isAdmin} />
          ))}
        </div>
      )}
    </ScreenWithBg>
  );
};

/**
 * Renders one row from the `notifications` table. Today the only
 * `type` we render specifically is `booking.created` /
 * `booking.extended`; anything else falls through to a generic
 * "type — created_at" presentation so unknown notifications still
 * show up rather than disappearing silently.
 */
const DbNotificationCard = ({ n, onClick }: { n: IDbNotification; onClick: () => void }) => {
  const { t } = useLang();
  const navigate = useNavigate();
  const isUnread = n.read_at === null;
  const tone = isUnread ? "#07ddf1" : "#1f2a44";
  const dataType = (n.data?.type as string | undefined) ?? n.type;

  const isBookingCreated = dataType === "booking.created";
  const isBookingExtended = dataType === "booking.extended";
  const code = n.data?.code ?? n.data?.booking_id;
  const bookingDate = n.data?.booking_date as string | undefined;
  const startTime = n.data?.start_time as string | undefined;

  const headline = isBookingCreated
    ? `${t("notifications.newBookingTitle") || "New booking"} #${code}`
    : isBookingExtended
      ? `${t("notifications.bookingExtendedTitle") || "Booking extended"} #${code}`
      : (n.type.split("\\").pop() ?? n.type);

  const handleClick = () => {
    onClick();
    if (n.data?.booking_id) {
      navigate(`/bookings/${n.data.booking_id}`);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      style={{
        all: "unset",
        cursor: "pointer",
        display: "block",
        background: "rgba(7, 221, 241, 0.05)",
        border: `1px solid ${tone}`,
        borderRadius: 8,
        padding: "12px 14px",
        textAlign: "left",
        position: "relative",
      }}
    >
      {isUnread && (
        <span
          aria-label={t("notifications.unreadDot") || "Unread"}
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "#ef4444",
          }}
        />
      )}
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{headline}</div>
      <div className="muted" style={{ fontSize: 13 }}>
        {bookingDate && startTime && (
          <>
            {t("notifications.bookingForDate") || "for"} {bookingDate} {startTime}
            {" · "}
          </>
        )}
        {formatDate(n.created_at)}
      </div>
    </button>
  );
};

const ReminderCard = ({ r, isAdmin }: { r: IBillingReminder; isAdmin: boolean }) => {
  const { t } = useLang();
  const days = r.days_until_due;
  const tone =
    r.is_overdue ? "#ef4444"
    : days != null && days <= 1 ? "#ef4444"
    : days != null && days <= 3 ? "#f59e0b"
    : "#22c55e";

  const dayWord = days === 1 ? t("notifications.dayShort") : t("notifications.daysShort");
  const headline = isAdmin
    ? r.is_overdue
      ? `${t("label.company")} "${r.name}" ${t("notifications.companyOverdue")}`
      : `${t("label.company")} "${r.name}" ${t("notifications.companyMustPayIn")} ${days} ${dayWord}`
    : r.is_overdue
      ? t("notifications.youOverdue")
      // commission percent is interpolated; the surrounding sentence is fully translated.
      : `${days} ${dayWord} — ${t("notifications.youMustPayIn").replace("{pct}", String(r.commission_percent ?? 0))}`;

  return (
    <div className="gradient-card">
      <div className="gradient-card-inner" style={{ borderLeft: `4px solid ${tone}` }}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>{headline}</div>
        <div className="muted" style={{ fontSize: 13 }}>
          {r.last_paid_at ? `${t("notifications.lastPaid")}: ${formatDate(r.last_paid_at)}` : t("notifications.neverPaid")}
          {r.next_due_at ? ` · ${t("notifications.due")}: ${formatDate(r.next_due_at)}` : ""}
        </div>
        {isAdmin && (
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
            {t("notifications.owner")}: {r.email}
          </div>
        )}
      </div>
    </div>
  );
};

export default Notifications;
