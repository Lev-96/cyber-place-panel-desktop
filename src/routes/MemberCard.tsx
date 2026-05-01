import MemberForm from "@/components/members/MemberForm";
import TopupDialog from "@/components/members/TopupDialog";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import { formatDateTime } from "@/i18n/dates";
import { useLang } from "@/i18n/LanguageContext";
import { memberRepository } from "@/repositories/MemberRepository";
import { IMember, IMemberDeposit } from "@/types/members";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

const MemberCard = () => {
  const { memberId, branchId } = useParams();
  const id = Number(memberId);
  const branch = Number(branchId);
  const { t, money } = useLang();
  const [member, setMember] = useState<IMember | null>(null);
  const [deposits, setDeposits] = useState<IMemberDeposit[]>([]);
  const [topup, setTopup] = useState(false);
  const [editing, setEditing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    setErr(null);
    try {
      const [m, d] = await Promise.all([memberRepository.byId(id), memberRepository.deposits(id)]);
      setMember(m); setDeposits(d);
    } catch (e) { setErr(e instanceof Error ? e.message : t("form.errors.failed")); }
  };

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [id]);

  if (err) return <div className="error">{err}</div>;
  if (!member) return <Spinner />;

  const labelOf = (k: IMemberDeposit["kind"]) => k === "topup" ? t("memberCard.topup") : k === "spend" ? t("memberCard.spend") : t("memberCard.adjust");

  return (
    <div className="col" style={{ gap: 18, maxWidth: 720 }}>
      <div className="row-between">
        <h2 className="page-title" style={{ margin: 0 }}>{member.name}</h2>
        <div className="row" style={{ gap: 8 }}>
          <Button variant="secondary" onClick={() => setEditing(true)}>{t("action.edit")}</Button>
          <Button onClick={() => setTopup(true)}>{t("topup.title")}</Button>
        </div>
      </div>
      <div className="card col" style={{ gap: 6 }}>
        <Row k={t("label.phone")} v={member.phone ?? "—"} />
        <Row k={t("label.email")} v={member.email ?? "—"} />
        <Row k={t("label.cardCode")} v={member.card_code ?? "—"} />
        <Row k={t("members.balance")} v={money(Number(member.balance))} highlight />
      </div>
      <div className="card col" style={{ gap: 4 }}>
        <h3 style={{ margin: 0 }}>{t("memberCard.transactions")}</h3>
        {deposits.length === 0 && <div className="muted">{t("memberCard.noTx")}</div>}
        {deposits.map((d) => (
          <div key={d.id} className="row-between" style={{ padding: "6px 0", borderBottom: "1px solid #1f2a44" }}>
            <div>
              <div>{labelOf(d.kind)} <span className="muted">{d.reference ?? ""}</span></div>
              <div className="muted" style={{ fontSize: 11 }}>{formatDateTime(d.created_at)}</div>
            </div>
            <div style={{ color: signColor(d) }}>{signOf(d)}{money(Number(d.amount))}</div>
          </div>
        ))}
      </div>
      {topup && <TopupDialog member={member} onClose={() => setTopup(false)} onDone={(m) => { setTopup(false); setMember(m); void load(); }} />}
      {editing && <MemberForm branchId={branch} initial={member} onClose={() => setEditing(false)} onSaved={(m) => { setEditing(false); setMember(m); }} />}
    </div>
  );
};

const signOf = (d: IMemberDeposit) => Number(d.amount) > 0 ? "+" : "";
const signColor = (d: IMemberDeposit) => Number(d.amount) > 0 ? "#22c55e" : "#ef4444";

const Row = ({ k, v, highlight }: { k: string; v: string; highlight?: boolean }) => (
  <div className="kv-row">
    <span className="k">{k}</span>
    <span className={`v ${highlight ? "hi" : ""}`}>{v}</span>
  </div>
);

export default MemberCard;
