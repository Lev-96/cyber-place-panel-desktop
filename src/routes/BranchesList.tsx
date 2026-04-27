import Spinner from "@/components/ui/Spinner";
import { useAsync } from "@/hooks/useAsync";
import { branchRepository } from "@/repositories/BranchRepository";
import { Link } from "react-router-dom";

const BranchesList = () => {
  const { data: branches, loading, error } = useAsync(() => branchRepository.list(), []);

  return (
    <div className="col" style={{ gap: 16 }}>
      <h2 className="page-title">Branches</h2>
      {loading && <Spinner />}
      {error && <div className="error">{error.message}</div>}
      {!loading && !error && (
        <div className="list">
          {(branches ?? []).map((b) => (
            <div key={b.id} className="list-item">
              <div>
                <div className="name">{b.company?.name ?? "Branch"} · {b.address}</div>
                <div className="meta">{b.country}, {b.city} · places {b.places_count ?? 0} · services {b.service_count}</div>
              </div>
              <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                <Link to={`/branches/${b.id}/sessions`} className="muted" style={pillBtn}>Sessions</Link>
                <Link to={`/branches/${b.id}/pos`} className="muted" style={pillBtn}>POS</Link>
                <Link to={`/branches/${b.id}/shift`} className="muted" style={pillBtn}>Shift</Link>
                <Link to={`/branches/${b.id}/members`} className="muted" style={pillBtn}>Members</Link>
                <Link to={`/branches/${b.id}/live`} className="muted" style={pillBtn}>Live</Link>
                <Link to={`/branches/${b.id}/pcs`} className="muted" style={pillBtn}>PCs</Link>
                <Link to={`/branches/${b.id}/tariffs`} className="muted" style={pillBtn}>Tariffs</Link>
                <Link to={`/branches/${b.id}/products`} className="muted" style={pillBtn}>Products</Link>
              </div>
            </div>
          ))}
          {!branches?.length && <div className="muted">No branches.</div>}
        </div>
      )}
    </div>
  );
};

const pillBtn: React.CSSProperties = { padding: "6px 10px", border: "1px solid #1f2a44", borderRadius: 6 };

export default BranchesList;
