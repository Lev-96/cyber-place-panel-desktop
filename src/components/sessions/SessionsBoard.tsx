import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import { useAsync } from "@/hooks/useAsync";
import { sessionRepository } from "@/repositories/SessionRepository";
import { IPcApi, ISessionApi } from "@/types/sessions";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import SessionTimer from "./SessionTimer";
import StartSessionDialog from "./StartSessionDialog";

const navBtn: React.CSSProperties = { padding: "6px 10px", border: "1px solid #1f2a44", borderRadius: 6 };

interface Props {
  branchId: number;
}

const SessionsBoard = ({ branchId }: Props) => {
  const pcs = useAsync(() => sessionRepository.listPcs(branchId), [branchId]);
  const sessions = useAsync(() => sessionRepository.listActive(branchId), [branchId]);
  const [startTarget, setStartTarget] = useState<IPcApi | null>(null);

  useEffect(() => {
    const t = setInterval(() => { void sessions.reload(); void pcs.reload(); }, 5_000);
    return () => clearInterval(t);
  }, [sessions, pcs]);

  const stop = async (s: ISessionApi) => {
    if (!confirm(`Stop session on ${s.pc_label}?`)) return;
    await sessionRepository.stop(s.id);
    void sessions.reload(); void pcs.reload();
  };

  if (pcs.loading || sessions.loading) return <Spinner />;
  if (pcs.error) return <div className="error">{pcs.error.message}</div>;
  if (sessions.error) return <div className="error">{sessions.error.message}</div>;

  const sessionByPc = new Map<number, ISessionApi>();
  for (const s of sessions.data ?? []) sessionByPc.set(s.pc_id, s);

  return (
    <div className="col" style={{ gap: 18 }}>
      <div className="row-between">
        <h2 className="page-title" style={{ margin: 0 }}>Sessions · branch #{branchId}</h2>
        <div className="row" style={{ gap: 8 }}>
          <Link to={`/branches/${branchId}/pcs`} className="muted" style={navBtn}>Manage PCs</Link>
          <Link to={`/branches/${branchId}/tariffs`} className="muted" style={navBtn}>Tariffs</Link>
        </div>
      </div>
      <div className="live-grid">
        {(pcs.data ?? []).map((pc) => {
          const sess = sessionByPc.get(pc.id);
          const color = sess ? "#22c55e" : "#6b7280";
          return (
            <div key={pc.id} className="place-cell" style={{ borderColor: color, minHeight: 130 }}>
              <span className="dot" style={{ background: color }} />
              <span className="platform">{pc.label}</span>
              {sess ? (
                <>
                  <span className="id" style={{ fontSize: 14 }}>{sess.user_display_name ?? "Anonymous"}</span>
                  <span className="status" style={{ color }}><SessionTimer endsAt={sess.ends_at} /></span>
                  <span className="until">{sess.package_name}</span>
                  <Button variant="secondary" onClick={() => stop(sess)} style={{ padding: "4px 8px", fontSize: 12, marginTop: 4 }}>Stop</Button>
                </>
              ) : (
                <>
                  <span className="status" style={{ color }}>Free</span>
                  <Button onClick={() => setStartTarget(pc)} style={{ padding: "6px 10px", fontSize: 12, marginTop: 6 }}>Start</Button>
                </>
              )}
            </div>
          );
        })}
        {!pcs.data?.length && <div className="muted">No PCs registered.</div>}
      </div>

      {startTarget && (
        <StartSessionDialog
          branchId={branchId}
          pc={startTarget}
          onClose={() => setStartTarget(null)}
          onStarted={() => { setStartTarget(null); void sessions.reload(); void pcs.reload(); }}
        />
      )}
    </div>
  );
};

export default SessionsBoard;
