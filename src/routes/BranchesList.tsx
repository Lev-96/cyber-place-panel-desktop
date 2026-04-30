import Avatar from "@/components/ui/Avatar";
import ScreenWithBg from "@/components/ui/ScreenWithBg";
import Spinner from "@/components/ui/Spinner";
import { useAsync } from "@/hooks/useAsync";
import { useLang } from "@/i18n/LanguageContext";
import { branchRepository } from "@/repositories/BranchRepository";
import { Link } from "react-router-dom";

/**
 * Global branches list.
 * Per RN cyberplace-panel design: branches are NOT created here — a branch
 * always belongs to a company, so creation lives under
 * `/companies/:id/branches`. This screen is read-only navigation.
 */
const BranchesList = () => {
  const { t } = useLang();
  const { data: branches, loading, error } = useAsync(() => branchRepository.list(), []);

  return (
    <ScreenWithBg bg="./bg/branch.jpg" title={t("branchesList.title")}>
      {loading && <Spinner />}
      {error && <div className="error">{error.message}</div>}
      {!loading && !error && (
        <div className="list">
          {(branches ?? []).map((b) => (
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
          {!branches?.length && <div className="muted">{t("common.empty.branches")}</div>}
        </div>
      )}
    </ScreenWithBg>
  );
};

export default BranchesList;
