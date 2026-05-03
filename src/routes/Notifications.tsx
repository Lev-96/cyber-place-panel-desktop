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
    deleteOne,
    deleteAll,
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <h3 className="muted" style={{ margin: 0, fontSize: 14 }}>
          {t("notifications.bookingFeedTitle") || "Bookings"}
        </h3>
        <div style={{ display: "flex", gap: 8 }}>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => void markAllRead()}
              style={feedActionBtn}
            >
              {t("notifications.markAllRead") || "Mark all as read"}
            </button>
          )}
          {list.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm(t("notifications.confirmClearAll") || "Delete all?")) {
                  void deleteAll();
                }
              }}
              style={{ ...feedActionBtn, color: "#ef4444", borderColor: "#7f1d1d" }}
            >
              {t("notifications.clearAll") || "Clear all"}
            </button>
          )}
        </div>
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
              onDelete={() => void deleteOne(n.id)}
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
const DbNotificationCard = ({ n, onClick, onDelete }: { n: IDbNotification; onClick: () => void; onDelete: () => void }) => {
  const { t } = useLang();
  const navigate = useNavigate();
  const isUnread = n.read_at === null;
  const tone = isUnread ? "#07ddf1" : "#1f2a44";
  const dataType = (n.data?.type as string | undefined) ?? n.type;

  const isBookingCreated = dataType === "booking.created";
  const isBookingExtended = dataType === "booking.extended";
  const isBookingCancelled = dataType === "booking.cancelled";
  const isBranchSubscribed = dataType === "branch.subscribed";
  const isTournamentJoined = dataType === "tournament.joined";
  const code = n.data?.code ?? n.data?.booking_id;
  const bookingDate = n.data?.booking_date as string | undefined;
  const startTime = n.data?.start_time as string | undefined;
  const extraMinutes = n.data?.extra_minutes as number | undefined;

  // Subscribe / tournament-joined fields are pre-resolved in the
  // backend payload (BranchSubscribed::toArray /
  // TournamentJoined::toArray) so we can compose a friendly card
  // without a follow-up fetch.
  const guestFirstName = (n.data?.guest_first_name as string | undefined)?.trim() || null;
  const guestLastName = (n.data?.guest_last_name as string | undefined)?.trim() || null;
  const guestId = n.data?.guest_id as number | undefined;
  const companyName = (n.data?.company_name as string | undefined)?.trim() || null;
  const branchAddress = (n.data?.branch_address as string | undefined)?.trim() || null;
  const tournamentTitle = (n.data?.tournament_title as string | undefined)?.trim() || null;
  // Player label = first + last; falls back to a guest-id
  // placeholder so the card is never empty.
  const playerLabel =
    [guestFirstName, guestLastName].filter(Boolean).join(" ") ||
    `Guest #${guestId ?? "?"}`;

  let headline: string;
  let body: string | null = null;
  if (isBookingCreated) {
    headline = `${t("notifications.newBookingTitle") || "New booking"} #${code}`;
  } else if (isBookingExtended) {
    headline = `${t("notifications.bookingExtendedTitle") || "Booking extended"} #${code}${
      typeof extraMinutes === "number" && extraMinutes > 0
        ? ` · +${extraMinutes} ${t("notifications.bookingMinShort") || "min"}`
        : ""
    }`;
  } else if (isBookingCancelled) {
    headline = `${t("notifications.bookingCancelledTitle") || "Booking cancelled"} #${code}`;
  } else if (isBranchSubscribed) {
    headline = `🎉 ${t("notifications.branchSubscribedHeadline") || "Congratulations — new subscriber"}`;
    const tail = [companyName, branchAddress].filter(Boolean).join(" · ");
    const verb = t("notifications.branchSubscribedBody") || "subscribed to your branch";
    body = tail ? `${playerLabel} ${verb} ${tail}` : `${playerLabel} ${verb}`;
  } else if (isTournamentJoined) {
    headline = `🎉 ${t("notifications.tournamentJoinedHeadline") || "Congratulations — new tournament player"}`;
    const verb = t("notifications.tournamentJoinedBody") || "joined the tournament";
    const venue = [companyName, branchAddress].filter(Boolean).join(" · ");
    // Body composition:
    //   "<Player> <verb> <title> · <company> · <address>"
    // Each segment optional — if the backend hasn't loaded the
    // tournament/branch (older row, deploy lag), we still ship the
    // pieces we have rather than forcing an empty body.
    const segments = [
      `${playerLabel} ${verb}${tournamentTitle ? ` ${tournamentTitle}` : ""}`,
      venue,
    ].filter(Boolean);
    body = segments.join(" · ");
  } else {
    headline = n.type.split("\\").pop() ?? n.type;
  }

  const handleCardClick = () => {
    onClick();
    if (n.data?.booking_id) {
      navigate(`/bookings/${n.data.booking_id}`);
    }
  };

  return (
    <div
      style={{
        background: "rgba(7, 221, 241, 0.05)",
        border: `1px solid ${tone}`,
        borderRadius: 8,
        padding: "12px 14px",
        position: "relative",
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
      }}
    >
      {/* The body is the click target — markRead + navigate. The
          delete button below is a separate target so a click on it
          doesn't accidentally trigger navigation. */}
      <button
        type="button"
        onClick={handleCardClick}
        style={{
          all: "unset",
          cursor: "pointer",
          flex: 1,
          textAlign: "left",
        }}
      >
        {isUnread && (
          <span
            aria-label={t("notifications.unreadDot") || "Unread"}
            style={{
              display: "inline-block",
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#ef4444",
              marginRight: 8,
              verticalAlign: "middle",
            }}
          />
        )}
        <span style={{ fontWeight: 700, fontSize: 15 }}>{headline}</span>
        {body && (
          <div style={{ fontSize: 14, marginTop: 4, color: "#e5e7eb" }}>
            {body}
          </div>
        )}
        <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
          {bookingDate && startTime && (
            <>
              {t("notifications.bookingForDate") || "for"} {bookingDate} {startTime}
              {" · "}
            </>
          )}
          {formatDate(n.created_at)}
        </div>
      </button>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        aria-label={t("notifications.deleteOne") || "Delete"}
        title={t("notifications.deleteOne") || "Delete"}
        style={{
          padding: "4px 10px",
          border: "1px solid #7f1d1d",
          borderRadius: 6,
          background: "transparent",
          color: "#ef4444",
          cursor: "pointer",
          fontSize: 16,
          lineHeight: 1,
          alignSelf: "flex-start",
        }}
      >
        ×
      </button>
    </div>
  );
};

const feedActionBtn: React.CSSProperties = {
  padding: "4px 10px",
  border: "1px solid #1f2a44",
  borderRadius: 6,
  background: "transparent",
  color: "#e5e7eb",
  cursor: "pointer",
  fontSize: 12,
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
