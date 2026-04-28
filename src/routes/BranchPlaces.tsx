import PlaceForm from "@/components/places/PlaceForm";
import Button from "@/components/ui/Button";
import ScreenWithBg from "@/components/ui/ScreenWithBg";
import Spinner from "@/components/ui/Spinner";
import { useAsync } from "@/hooks/useAsync";
import { placeRepository } from "@/repositories/PlaceRepository";
import { IBranchPlace } from "@/types/api";
import { useState } from "react";
import { useParams } from "react-router-dom";

const BranchPlaces = () => {
  const { branchId } = useParams();
  const id = Number(branchId);
  const { data, loading, error, reload } = useAsync(() => placeRepository.listRawByBranch(id), [id]);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<IBranchPlace | null>(null);

  if (!Number.isFinite(id) || id <= 0) return <div className="error">Invalid branch id.</div>;

  const remove = async (p: IBranchPlace) => {
    if (!confirm(`Delete place #${(p as any).number ?? p.id}?`)) return;
    await placeRepository.remove(p.id);
    void reload();
  };

  return (
    <ScreenWithBg bg="./bg/branch.jpg" title={`Places · branch #${id}`}>
      <div className="row-between">
        <span className="muted">A place is a bookable seat (e.g. PC #1, PS5 VIP #2). Each place gets games linked.</span>
        <Button onClick={() => setCreating(true)}>+ New place</Button>
      </div>
      {loading && <Spinner />}
      {error && <div className="error">{error.message}</div>}
      {!loading && !error && (
        <div className="live-grid">
          {(data ?? []).map((p) => (
            <div key={p.id} className="place-cell" style={{ borderColor: p.status === "active" ? "#22c55e" : "#6b7280", minHeight: 130 }}>
              <span className="dot" style={{ background: p.status === "active" ? "#22c55e" : "#6b7280" }} />
              <span className="platform">{p.platform.toUpperCase()} · {p.type}</span>
              <span className="id">#{(p as any).number ?? p.id}</span>
              <span className="status" style={{ color: p.status === "active" ? "#22c55e" : "#6b7280" }}>{p.status}</span>
              <span className="until">{p.games?.length ?? 0} game(s)</span>
              <div className="row" style={{ gap: 4, marginTop: 6 }}>
                <Button variant="secondary" onClick={() => setEditing(p)} style={{ padding: "4px 8px", fontSize: 11, flex: 1 }}>Edit</Button>
                <Button variant="secondary" onClick={() => remove(p)} style={{ padding: "4px 8px", fontSize: 11, color: "#ef4444", borderColor: "#4a1a1a" }}>×</Button>
              </div>
            </div>
          ))}
          {!data?.length && <div className="muted">No places yet. Click "New place" to add the first one.</div>}
        </div>
      )}

      {creating && <PlaceForm branchId={id} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); void reload(); }} />}
      {editing && <PlaceForm branchId={id} initial={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void reload(); }} />}
    </ScreenWithBg>
  );
};

export default BranchPlaces;
