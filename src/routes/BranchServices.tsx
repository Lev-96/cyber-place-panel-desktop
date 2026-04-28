import Button from "@/components/ui/Button";
import ScreenWithBg from "@/components/ui/ScreenWithBg";
import Spinner from "@/components/ui/Spinner";
import { branchRepository } from "@/repositories/BranchRepository";
import { serviceRepository } from "@/repositories/ServiceRepository";
import { IBranchService } from "@/types/api";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

const BranchServices = () => {
  const { branchId } = useParams();
  const id = Number(branchId);

  const [allServices, setAllServices] = useState<IBranchService[] | null>(null);
  const [activeIds, setActiveIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isFinite(id) || id <= 0) return;
    setLoading(true); setError(null);
    void Promise.all([serviceRepository.listAll(), serviceRepository.listByBranch(id)])
      .then(([all, current]) => {
        setAllServices(all);
        setActiveIds(new Set(current.map((s) => s.id)));
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"))
      .finally(() => setLoading(false));
  }, [id]);

  if (!Number.isFinite(id) || id <= 0) return <div className="error">Invalid branch id.</div>;

  const toggle = (sid: number) => {
    const next = new Set(activeIds);
    if (next.has(sid)) next.delete(sid); else next.add(sid);
    setActiveIds(next);
  };

  const save = async () => {
    setSaving(true); setMsg(null);
    try {
      await branchRepository.updateServices(id, Array.from(activeIds));
      setMsg("Saved");
    } catch (e) { setMsg(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(false); }
  };

  return (
    <ScreenWithBg bg="./bg/branch.jpg" title={`Services · branch #${id}`}>
      <span className="muted">Toggle which services this branch provides.</span>
      {loading && <Spinner />}
      {error && <div className="error">{error}</div>}
      {!loading && !error && (
        <>
          <div className="list">
            {(allServices ?? []).map((s) => {
              const active = activeIds.has(s.id);
              return (
                <label key={s.id} className="list-item" style={{ cursor: "pointer", borderColor: active ? "#07ddf1" : undefined, background: active ? "#101a35" : undefined }}>
                  <div className="row" style={{ gap: 10 }}>
                    <input type="checkbox" checked={active} onChange={() => toggle(s.id)} />
                    <div>
                      <div className="name">{s.name_en}</div>
                      <div className="meta">{s.name_ru} · {s.name_am}</div>
                    </div>
                  </div>
                </label>
              );
            })}
            {!allServices?.length && <div className="muted">No services exist globally yet.</div>}
          </div>
          <div className="row-between">
            {msg && <span className={msg === "Saved" ? "muted" : "error"}>{msg}</span>}
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </div>
        </>
      )}
    </ScreenWithBg>
  );
};

export default BranchServices;
