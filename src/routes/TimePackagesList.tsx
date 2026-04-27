import PackageForm from "@/components/packages/PackageForm";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import { useAsync } from "@/hooks/useAsync";
import { timePackageRepository } from "@/repositories/TimePackageRepository";
import { ITimePackage } from "@/types/sessions";
import { useState } from "react";
import { useParams } from "react-router-dom";

const TimePackagesList = () => {
  const { branchId } = useParams();
  const id = Number(branchId);
  const { data: packages, loading, error, reload } = useAsync(() => timePackageRepository.listByBranch(id), [id]);

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ITimePackage | null>(null);

  if (!Number.isFinite(id) || id <= 0) return <div className="error">Invalid branch id.</div>;

  const remove = async (pkg: ITimePackage) => {
    if (!confirm(`Delete tariff "${pkg.name}"?`)) return;
    await timePackageRepository.remove(pkg.id);
    void reload();
  };

  const toggle = async (pkg: ITimePackage) => {
    await timePackageRepository.update(pkg.id, { is_active: !(pkg as any).is_active });
    void reload();
  };

  return (
    <div className="col" style={{ gap: 18 }}>
      <div className="row-between">
        <h2 className="page-title" style={{ margin: 0 }}>Tariffs · branch #{id}</h2>
        <Button onClick={() => setCreating(true)}>+ New tariff</Button>
      </div>

      {loading && <Spinner />}
      {error && <div className="error">{error.message}</div>}
      {!loading && !error && (
        <div className="list">
          {(packages ?? []).map((p) => {
            const active = (p as any).is_active !== false;
            return (
              <div key={p.id} className="list-item" style={{ opacity: active ? 1 : 0.5 }}>
                <div>
                  <div className="name">{p.name}</div>
                  <div className="meta">{p.duration_minutes} min · {Number(p.price).toFixed(2)}</div>
                </div>
                <div className="row" style={{ gap: 6 }}>
                  <Button variant="secondary" onClick={() => toggle(p)} style={btn}>{active ? "Deactivate" : "Activate"}</Button>
                  <Button variant="secondary" onClick={() => setEditing(p)} style={btn}>Edit</Button>
                  <Button variant="secondary" onClick={() => remove(p)} style={{ ...btn, color: "#ef4444", borderColor: "#4a1a1a" }}>Delete</Button>
                </div>
              </div>
            );
          })}
          {!packages?.length && <div className="muted">No tariffs yet. Add at least one to start sessions.</div>}
        </div>
      )}

      {creating && (
        <PackageForm
          branchId={id}
          onClose={() => setCreating(false)}
          onSaved={() => { setCreating(false); void reload(); }}
        />
      )}
      {editing && (
        <PackageForm
          branchId={id}
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); void reload(); }}
        />
      )}
    </div>
  );
};

const btn: React.CSSProperties = { padding: "6px 10px", fontSize: 12 };

export default TimePackagesList;
