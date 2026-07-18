import Avatar from "@/components/ui/Avatar";
import Pagination from "@/components/ui/Pagination";
import ScreenWithBg from "@/components/ui/ScreenWithBg";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { useAsync } from "@/hooks/useAsync";
import { useLang } from "@/i18n/LanguageContext";
import { branchRepository } from "@/repositories/BranchRepository";
import { useState } from "react";
import { Link } from "react-router-dom";

/**
 * Global branches list — paginated (page navigation at the bottom).
 * Per RN cyberplace-panel design: branches are NOT created here — a branch
 * always belongs to a company, so creation lives under
 * `/companies/:id/branches`. This screen is read-only navigation.
 */
const BranchesList = () => {
  const { t } = useLang();
  const [page, setPage] = useState(1);
  const { data, loading, error } = useAsync(() => branchRepository.listPaged(page), [page]);
  const branches = data?.data ?? [];
  const lastPage = data?.meta?.last_page ?? 1;

  return (
    <ScreenWithBg bg="./bg/branch.jpg" title={t("branchesList.title")}>
      {error && <div className="error">{error.message}</div>}
      {loading ? (
        <ListSkeleton />
      ) : !error ? (
        <div className="list">
          {branches.map((b) => (
            <Link key={b.id} to={`/branches/${b.id}`} className="list-item">
              <div className="row" style={{ gap: 12, flex: 1 }}>
                <Avatar src={b.branch_logo_path} name={b.address} size={44} />
                <div style={{ flex: 1 }}>
                  <div className="name">{b.company?.name ?? t("hub.branchFallback")} · {b.address}</div>
                  <div className="meta">
                    {b.country}, {b.city} · {t("branchesList.placesShort")} {b.places_count ?? 0} · {t("branchesList.servicesShort")} {b.service_count}
                  </div>
                </div>
              </div>
              <span className="muted">{t("common.open")}</span>
            </Link>
          ))}
          {!branches.length && <div className="muted">{t("common.empty.branches")}</div>}
        </div>
      ) : null}
      {!error && <Pagination page={page} lastPage={lastPage} onChange={setPage} disabled={loading} />}
    </ScreenWithBg>
  );
};

export default BranchesList;
