import { apiBillingReminders, IBillingReminder } from "@/api/billing";
import { orFallback } from "@/api/fallback";
import { useAuth } from "@/auth/AuthContext";
import ScreenWithBg from "@/components/ui/ScreenWithBg";
import Spinner from "@/components/ui/Spinner";
import { useAsync } from "@/hooks/useAsync";
import { useLang } from "@/i18n/LanguageContext";

const Notifications = () => {
  const { user } = useAuth();
  const { t } = useLang();
  const isAdmin = user?.role === "admin";
  const { data, loading, error } = useAsync(
    () => orFallback(apiBillingReminders(7), { data: [] as IBillingReminder[] }),
    []
  );

  if (loading) return <Spinner />;
  if (error) return <div className="error">{error.message}</div>;

  const list = data?.data ?? [];

  return (
    <ScreenWithBg bg="./bg/notifications.jpg" title={t("notifications.title")}>
      {list.length === 0 ? (
        <div className="card">
          <div className="muted">{t("common.empty.notifications")}</div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {list.map((r) => (
            <ReminderCard key={r.id} r={r} isAdmin={isAdmin} />
          ))}
        </div>
      )}
    </ScreenWithBg>
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
          {r.last_paid_at ? `${t("notifications.lastPaid")}: ${new Date(r.last_paid_at).toLocaleDateString()}` : t("notifications.neverPaid")}
          {r.next_due_at ? ` · ${t("notifications.due")}: ${new Date(r.next_due_at).toLocaleDateString()}` : ""}
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
