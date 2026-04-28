import { apiBillingReminders, IBillingReminder } from "@/api/billing";
import { orFallback } from "@/api/fallback";
import { useAuth } from "@/auth/AuthContext";
import ScreenWithBg from "@/components/ui/ScreenWithBg";
import Spinner from "@/components/ui/Spinner";
import { useAsync } from "@/hooks/useAsync";

const Notifications = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { data, loading, error } = useAsync(
    () => orFallback(apiBillingReminders(7), { data: [] as IBillingReminder[] }),
    []
  );

  if (loading) return <Spinner />;
  if (error) return <div className="error">{error.message}</div>;

  const list = data?.data ?? [];

  return (
    <ScreenWithBg bg="./bg/notifications.jpg" title="Notifications">
      {list.length === 0 ? (
        <div className="card">
          <div className="muted">No notifications right now.</div>
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
  const days = r.days_until_due;
  const tone =
    r.is_overdue ? "#ef4444"
    : days != null && days <= 1 ? "#ef4444"
    : days != null && days <= 3 ? "#f59e0b"
    : "#22c55e";

  const headline = isAdmin
    ? r.is_overdue
      ? `Company "${r.name}" is overdue on payment`
      : `Company "${r.name}" must pay in ${days} day${days === 1 ? "" : "s"}`
    : r.is_overdue
      ? `You are overdue on your Cyber Place payment`
      : `In ${days} day${days === 1 ? "" : "s"} you must pay Cyber Place — ${r.commission_percent}% commission`;

  return (
    <div className="gradient-card">
      <div className="gradient-card-inner" style={{ borderLeft: `4px solid ${tone}` }}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>{headline}</div>
        <div className="muted" style={{ fontSize: 13 }}>
          {r.last_paid_at ? `Last paid: ${new Date(r.last_paid_at).toLocaleDateString()}` : "Never paid"}
          {r.next_due_at ? ` · Due: ${new Date(r.next_due_at).toLocaleDateString()}` : ""}
        </div>
        {isAdmin && (
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
            Owner: {r.email}
          </div>
        )}
      </div>
    </div>
  );
};

export default Notifications;
