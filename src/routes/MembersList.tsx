import MemberForm from "@/components/members/MemberForm";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import { useLang } from "@/i18n/LanguageContext";
import { memberRepository } from "@/repositories/MemberRepository";
import { IMember } from "@/types/members";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

const MembersList = () => {
  const { branchId } = useParams();
  const id = Number(branchId);
  const { t, money } = useLang();
  const [members, setMembers] = useState<IMember[] | null>(null);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    setErr(null);
    try { setMembers(await memberRepository.list(id, search)); }
    catch (e) { setErr(e instanceof Error ? e.message : t("form.errors.failed")); }
  };

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [id]);

  if (!Number.isFinite(id) || id <= 0) return <div className="error">{t("hub.invalidId")}</div>;

  return (
    <div className="col" style={{ gap: 18 }}>
      <div className="row-between">
        <h2 className="page-title" style={{ margin: 0 }}>{t("members.title")} · #{id}</h2>
        <Button onClick={() => setCreating(true)}>{t("members.new")}</Button>
      </div>
      <div className="row" style={{ gap: 6 }}>
        <input className="input" placeholder={t("members.search")} value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} />
        <Button variant="secondary" onClick={load}>{t("action.search")}</Button>
      </div>
      {err && <div className="error">{err}</div>}
      {!members ? <Spinner /> : (
        <div className="list">
          {members.map((m) => (
            <Link key={m.id} to={`/branches/${id}/members/${m.id}`} className="list-item">
              <div>
                <div className="name">{m.name}</div>
                <div className="meta">{m.phone ?? "—"} · {m.email ?? "—"} {m.card_code && <>· {t("members.cardLabel")} {m.card_code}</>}</div>
              </div>
              <div style={{ fontWeight: 700, color: "#07ddf1" }}>{money(Number(m.balance))}</div>
            </Link>
          ))}
          {!members.length && <div className="muted">{t("members.empty")}</div>}
        </div>
      )}
      {creating && <MemberForm branchId={id} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); void load(); }} />}
    </div>
  );
};

export default MembersList;
