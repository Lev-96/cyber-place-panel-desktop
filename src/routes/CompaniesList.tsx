import Spinner from "@/components/ui/Spinner";
import { useAsync } from "@/hooks/useAsync";
import { companyRepository } from "@/repositories/CompanyRepository";
import { Link } from "react-router-dom";

const CompaniesList = () => {
  const { data: companies, loading, error } = useAsync(() => companyRepository.list(), []);

  return (
    <div className="col" style={{ gap: 16 }}>
      <h2 className="page-title">Companies</h2>
      {loading && <Spinner />}
      {error && <div className="error">{error.message}</div>}
      {!loading && !error && (
        <div className="list">
          {(companies ?? []).map((c) => (
            <Link key={c.id} to={`/companies/${c.id}/revenue`} className="list-item">
              <div>
                <div className="name">{c.name}</div>
                <div className="meta">{c.raw.email} · branches {c.raw.branches_count ?? 0}</div>
              </div>
              <span className="muted">Revenue →</span>
            </Link>
          ))}
          {!companies?.length && <div className="muted">No companies.</div>}
        </div>
      )}
    </div>
  );
};

export default CompaniesList;
