import { apiCompanyBilling, apiMarkCompanyPaid, ICompanyBilling } from "@/api/billing";
import { isMissingEndpoint } from "@/api/fallback";
import { useAuth } from "@/auth/AuthContext";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import { formatDate } from "@/i18n/dates";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { useLang } from "@/i18n/LanguageContext";
import { fmt as msg } from "@/i18n/translations";
import { useEffect, useState } from "react";

interface Props {
  companyId: number;
  companyName: string;
}

const fmt = (iso: string | null) => formatDate(iso);

const CompanyBillingCard = ({ companyId, companyName }: Props) => {
  const { t } = useLang();
  const confirm = useConfirm();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isOwner = user?.role === "company_owner";
  const [billing, setBilling] = useState<ICompanyBilling | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    setErr(null); setMissing(false); setLoading(true);
    try { setBilling(await apiCompanyBilling(companyId)); }
    catch (e) {
      if (isMissingEndpoint(e)) setMissing(true);
      else setErr(e instanceof Error ? e.message : t("form.errors.failedSave"));
    }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [companyId]);

  const markPaid = async () => {
    if (!(await confirm(msg(t("billing.markPaidConfirm"), companyName)))) return;
    setBusy(true); setErr(null);
    try {
      const r = await apiMarkCompanyPaid(companyId);
      setBilling(r);
    } catch (e) { setErr(e instanceof Error ? e.message : t("form.errors.failedSave")); }
    finally { setBusy(false); }
  };

  if (loading) return <div className="card"><Spinner /></div>;
  if (missing) return (
    <div className="card">
      <div className="muted" style={{ fontSize: 13 }}>
        {t("billing.notDeployed")}
      </div>
    </div>
  );
  if (!billing) return (
    <div className="card">
      {err ? <div className="error">{err}</div> : <div className="muted">{t("billing.noInfo")}</div>}
    </div>
  );

  const rawPct = Number(billing.commission_percent);
  const pctText = Number.isFinite(rawPct) ? `${rawPct.toFixed(2)}%` : "—";
  const days = Number.isFinite(billing.days_until_due as number) ? (billing.days_until_due as number) : null;
  const overdue = !!billing.is_overdue;
  const dueSoon = days !== null && days >= 0 && days <= 3;

  // Border + tint based on urgency
  const bandColor = overdue ? "#ef4444" : dueSoon ? "#f59e0b" : "#22c55e";

  return (
    <div className="gradient-card"><div className="gradient-card-inner" style={{ borderLeft: `4px solid ${bandColor}` }}>
      <div className="row-between">
        <h3 style={{ margin: 0 }}>{t("billing.title")}</h3>
        <span className={`pill ${billing.status}`}>{billing.status}</span>
      </div>

      <div className="kv-row"><span className="k">{t("billing.commissionRate")}</span><span className="v">{pctText}</span></div>
      <div className="kv-row"><span className="k">{t("billing.lastPaid")}</span><span className="v">{fmt(billing.last_paid_at)}</span></div>
      <div className="kv-row"><span className="k">{t("billing.nextDue")}</span><span className="v">{fmt(billing.next_due_at)}</span></div>

      {days !== null && (
        <div className="kv-row">
          <span className="k">{t("billing.timeLeft")}</span>
          <span className="v hi" style={{ color: bandColor }}>
            {overdue
              ? msg(t("billing.overdueBy"), Math.abs(days))
              : msg(t("billing.daysLeft"), days)}
          </span>
        </div>
      )}

      {/* Audience-specific reminder text */}
      {dueSoon && isAdmin && !overdue && (
        <div className="muted" style={{ fontSize: 13, color: "#f59e0b" }}>
          {msg(t("billing.adminReminder"), companyName, days ?? 0)}
        </div>
      )}
      {dueSoon && isOwner && !overdue && (
        <div className="muted" style={{ fontSize: 13, color: "#f59e0b" }}>
          {msg(t("billing.ownerReminder"), days ?? 0)}
        </div>
      )}
      {overdue && isAdmin && (
        <div className="error">
          {msg(t("billing.adminOverdue"), companyName)}
        </div>
      )}
      {overdue && isOwner && (
        <div className="error">
          {t("billing.ownerOverdue")}
        </div>
      )}

      {err && <div className="error">{err}</div>}

      {isAdmin && (
        <div className="row-between" style={{ marginTop: 6 }}>
          <span className="muted" style={{ fontSize: 11 }}>
            {t("billing.markPaidHint")}
          </span>
          <Button onClick={markPaid} disabled={busy}>{busy ? t("company.saving") : t("billing.markPaid")}</Button>
        </div>
      )}
    </div></div>
  );
};

export default CompanyBillingCard;
