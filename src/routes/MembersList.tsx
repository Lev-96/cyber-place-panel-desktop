import MemberForm from "@/components/members/MemberForm";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import { memberRepository } from "@/repositories/MemberRepository";
import { IMember } from "@/types/members";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

const MembersList = () => {
  const { branchId } = useParams();
  const id = Number(branchId);
  const [members, setMembers] = useState<IMember[] | null>(null);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    setErr(null);
    try { setMembers(await memberRepository.list(id, search)); }
    catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
  };

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [id]);

  if (!Number.isFinite(id) || id <= 0) return <div className="error">Invalid branch id.</div>;

  return (
    <div className="col" style={{ gap: 18 }}>
      <div className="row-between">
        <h2 className="page-title" style={{ margin: 0 }}>Members · branch #{id}</h2>
        <Button onClick={() => setCreating(true)}>+ New member</Button>
      </div>
      <div className="row" style={{ gap: 6 }}>
        <input className="input" placeholder="Search name / phone / card" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} />
        <Button variant="secondary" onClick={load}>Search</Button>
      </div>
      {err && <div className="error">{err}</div>}
      {!members ? <Spinner /> : (
        <div className="list">
          {members.map((m) => (
            <Link key={m.id} to={`/branches/${id}/members/${m.id}`} className="list-item">
              <div>
                <div className="name">{m.name}</div>
                <div className="meta">{m.phone ?? "—"} · {m.email ?? "—"} {m.card_code && <>· card {m.card_code}</>}</div>
              </div>
              <div style={{ fontWeight: 700, color: "#07ddf1" }}>{Number(m.balance).toFixed(2)}</div>
            </Link>
          ))}
          {!members.length && <div className="muted">No members.</div>}
        </div>
      )}
      {creating && <MemberForm branchId={id} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); void load(); }} />}
    </div>
  );
};

export default MembersList;
