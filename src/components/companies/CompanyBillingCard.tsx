import { apiCompanyBilling, apiMarkCompanyPaid, ICompanyBilling } from "@/api/billing";
import { isMissingEndpoint } from "@/api/fallback";
import { useAuth } from "@/auth/AuthContext";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import { useEffect, useState } from "react";

interface Props {
  companyId: number;
  companyName: string;
}

const fmt = (iso: string | null) => iso ? new Date(iso).toLocaleDateString() : "—";

const CompanyBillingCard = ({ companyId, companyName }: Props) => {
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
      else setErr(e instanceof Error ? e.message : "Failed");
    }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [companyId]);

  const markPaid = async () => {
    if (!confirm(`Mark ${companyName} as paid? This shifts the next-due date by one month.`)) return;
    setBusy(true); setErr(null);
    try {
      const r = await apiMarkCompanyPaid(companyId);
      setBilling(r);
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  };

  if (loading) return <div className="card"><Spinner /></div>;
  if (missing) return (
    <div className="card">
      <div className="muted" style={{ fontSize: 13 }}>
        Billing endpoints not deployed yet. Run <code>php artisan migrate</code> on the backend.
      </div>
    </div>
  );
  if (!billing) return (
    <div className="card">
      {err ? <div className="error">{err}</div> : <div className="muted">No billing info.</div>}
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
        <h3 style={{ margin: 0 }}>Billing</h3>
        <span className={`pill ${billing.status}`}>{billing.status}</span>
      </div>

      <div className="kv-row"><span className="k">Commission rate</span><span className="v">{pctText}</span></div>
      <div className="kv-row"><span className="k">Last paid</span><span className="v">{fmt(billing.last_paid_at)}</span></div>
      <div className="kv-row"><span className="k">Next due</span><span className="v">{fmt(billing.next_due_at)}</span></div>

      {days !== null && (
        <div className="kv-row">
          <span className="k">Time left</span>
          <span className="v hi" style={{ color: bandColor }}>
            {overdue
              ? `Overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"}`
              : `${days} day${days === 1 ? "" : "s"} left`}
          </span>
        </div>
      )}

      {/* Audience-specific reminder text */}
      {dueSoon && isAdmin && !overdue && (
        <div className="muted" style={{ fontSize: 13, color: "#f59e0b" }}>
          ⚠ Company <b>{companyName}</b> must pay for the program in {days} {days === 1 ? "day" : "days"}.
        </div>
      )}
      {dueSoon && isOwner && !overdue && (
        <div className="muted" style={{ fontSize: 13, color: "#f59e0b" }}>
          ⚠ In {days} {days === 1 ? "day" : "days"} you must pay <b>Cyber Place</b>.
        </div>
      )}
      {overdue && isAdmin && (
        <div className="error">
          Company <b>{companyName}</b> is overdue. Status will switch to pending automatically.
        </div>
      )}
      {overdue && isOwner && (
        <div className="error">
          Payment to Cyber Place is overdue. Your company status has been set to pending.
        </div>
      )}

      {err && <div className="error">{err}</div>}

      {isAdmin && (
        <div className="row-between" style={{ marginTop: 6 }}>
          <span className="muted" style={{ fontSize: 11 }}>
            Marking as paid sets last_paid_at = now and next_due_at = +1 month.
          </span>
          <Button onClick={markPaid} disabled={busy}>{busy ? "Saving…" : "Mark as paid"}</Button>
        </div>
      )}
    </div></div>
  );
};

export default CompanyBillingCard;
