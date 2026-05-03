import HourlyRatesForm from "@/components/branches/HourlyRatesForm";
import PackageForm from "@/components/packages/PackageForm";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import { useAsync } from "@/hooks/useAsync";
import { useLang } from "@/i18n/LanguageContext";
import { branchRepository } from "@/repositories/BranchRepository";
import { timePackageRepository } from "@/repositories/TimePackageRepository";
import { ITimePackage } from "@/types/sessions";
import { useState } from "react";
import { useParams } from "react-router-dom";

/**
 * Branch prices = the `price_for_branches` matrix that drives every
 * billing path (mobile UI, auto-session-after-QR, manual session-
 * start). Replaces the old "Tariffs" page so the player-facing rate
 * table lives in one obvious place instead of being buried in
 * branch settings.
 *
 * Below the matrix, time packages stay editable since
 * StartSessionDialog's fixed-mode flow still uses them. Two clean
 * sections keep responsibilities separated — one form per concern.
 */
const BranchPricesPage = () => {
  const { branchId } = useParams();
  const id = Number(branchId);
  const { t, money } = useLang();
  const branch = useAsync(() => branchRepository.byId(id), [id]);
  const packages = useAsync(() => timePackageRepository.listByBranch(id), [id]);

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ITimePackage | null>(null);

  if (!Number.isFinite(id) || id <= 0) return <div className="error">{t("hub.invalidId")}</div>;

  const removePackage = async (pkg: ITimePackage) => {
    if (!confirm(`${t("tariffs.confirmDelete")} "${pkg.name}"?`)) return;
    await timePackageRepository.remove(pkg.id);
    void packages.reload();
  };

  const togglePackage = async (pkg: ITimePackage) => {
    await timePackageRepository.update(pkg.id, { is_active: !pkg.is_active });
    void packages.reload();
  };

  return (
    <div className="col" style={{ gap: 24 }}>
      {/* Hourly rates matrix — primary section, what the player sees */}
      <section className="col" style={{ gap: 12 }}>
        <h2 className="page-title" style={{ margin: 0 }}>
          {t("branch.prices.title")}
        </h2>
        {branch.loading && <Spinner />}
        {branch.error && <div className="error">{branch.error.message}</div>}
        {branch.data && (
          <HourlyRatesForm branch={branch.data} onSaved={() => void branch.reload()} />
        )}
      </section>

      {/* Time packages — used by StartSessionDialog fixed mode */}
      <section className="col" style={{ gap: 12 }}>
        <div className="row-between">
          <h2 className="page-title" style={{ margin: 0 }}>
            {t("branch.prices.packagesSubtitle")}
          </h2>
          <Button onClick={() => setCreating(true)}>{t("tariffs.new")}</Button>
        </div>
        {packages.loading && <Spinner />}
        {packages.error && <div className="error">{packages.error.message}</div>}
        {!packages.loading && !packages.error && (
          <div className="list">
            {(packages.data ?? []).map((p) => {
              const active = p.is_active !== false;
              return (
                <div key={p.id} className="list-item" style={{ opacity: active ? 1 : 0.5 }}>
                  <div>
                    <div className="name">{p.name}</div>
                    <div className="meta">
                      {p.duration_minutes} {t("time.minShort")} · {money(Number(p.price))}
                    </div>
                  </div>
                  <div className="row" style={{ gap: 6 }}>
                    <Button variant="secondary" onClick={() => togglePackage(p)} style={btn}>
                      {active ? t("action.deactivate") : t("action.activate")}
                    </Button>
                    <Button variant="secondary" onClick={() => setEditing(p)} style={btn}>
                      {t("action.edit")}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => removePackage(p)}
                      style={{ ...btn, color: "#ef4444", borderColor: "#4a1a1a" }}
                    >
                      {t("action.delete")}
                    </Button>
                  </div>
                </div>
              );
            })}
            {!packages.data?.length && (
              <div className="muted">{t("tariffs.empty")}</div>
            )}
          </div>
        )}
      </section>

      {creating && (
        <PackageForm
          branchId={id}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            void packages.reload();
          }}
        />
      )}
      {editing && (
        <PackageForm
          branchId={id}
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void packages.reload();
          }}
        />
      )}
    </div>
  );
};

const btn: React.CSSProperties = {
  padding: "6px 10px",
  fontSize: 12,
  minWidth: 80,
  textAlign: "center",
};

export default BranchPricesPage;
