import HourlyRatesForm from "@/components/branches/HourlyRatesForm";
import PackageForm from "@/components/packages/PackageForm";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import { useAsync } from "@/hooks/useAsync";
import { useLang } from "@/i18n/LanguageContext";
import { timePackageNameOf } from "@/i18n/timePackageName";
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
 * StartSessionDialog's fixed-mode flow still uses them. Each package
 * now carries an optional time-windowed discount (set inline in
 * PackageForm) — the active discount renders on the mobile
 * durationSelect card; no separate "Promos" section.
 */
const BranchPricesPage = () => {
  const { branchId } = useParams();
  const id = Number(branchId);
  const { t, money, lang } = useLang();
  const branch = useAsync(() => branchRepository.byId(id), [id]);
  const packages = useAsync(() => timePackageRepository.listByBranch(id), [id]);

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ITimePackage | null>(null);

  if (!Number.isFinite(id) || id <= 0) return <div className="error">{t("hub.invalidId")}</div>;

  const removePackage = async (pkg: ITimePackage) => {
    if (!confirm(`${t("tariffs.confirmDelete")} "${timePackageNameOf(pkg, lang)}"?`)) return;
    await timePackageRepository.remove(pkg.id);
    void packages.reload();
  };

  const togglePackage = async (pkg: ITimePackage) => {
    await timePackageRepository.update(pkg.id, { is_active: !pkg.is_active });
    void packages.reload();
  };

  // ISO 1..7 → short weekday label, matching branch.weekday.* keys we
  // already ship. Used to render "Пн · Ср · Пт" under each tariff
  // that has a discount window configured.
  const weekdayKeys = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  const renderDays = (days: number[] | null | undefined) =>
    (days ?? [])
      .map((d) => (d >= 1 && d <= 7 ? t(`branch.weekday.${weekdayKeys[d - 1]}`) : ""))
      .filter(Boolean)
      .join(" · ");

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

      {/* Time packages — used by StartSessionDialog fixed mode AND now
          carry the optional time-windowed discount inline. */}
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
              const hasDiscount =
                typeof p.discount_price === "number" &&
                !!p.discount_start_time &&
                !!p.discount_end_time &&
                Array.isArray(p.discount_days_of_week) &&
                p.discount_days_of_week.length > 0;
              return (
                <div key={p.id} className="list-item" style={{ opacity: active ? 1 : 0.5 }}>
                  <div>
                    <div className="name">
                      {timePackageNameOf(p, lang)}
                      {p.platform && (
                        <span
                          style={{
                            marginLeft: 8,
                            fontSize: 11,
                            padding: "2px 6px",
                            borderRadius: 4,
                            background: "rgba(7, 221, 241, 0.18)",
                            color: "#07ddf1",
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: 0.5,
                          }}
                        >
                          {p.platform}
                        </span>
                      )}
                      {hasDiscount && p.is_discount_currently_active && (
                        <span
                          style={{
                            marginLeft: 8,
                            fontSize: 11,
                            padding: "2px 6px",
                            borderRadius: 4,
                            background: "#1f3a1f",
                            color: "#7ee87e",
                            fontWeight: 600,
                          }}
                        >
                          {t("tariff.discount.activeNow")}
                        </span>
                      )}
                    </div>
                    <div className="meta">
                      {p.duration_minutes} {t("time.minShort")} · {money(Number(p.price))}
                      {hasDiscount && (
                        <>
                          {" "}·{" "}
                          <span style={{ color: "#07ddf1", fontWeight: 600 }}>
                            {t("tariff.discount.tag")}{" "}
                            {money(Number(p.discount_price))}{" "}
                            ({p.discount_start_time?.slice(0, 5)}–{p.discount_end_time?.slice(0, 5)}{" "}
                            {renderDays(p.discount_days_of_week)})
                          </span>
                        </>
                      )}
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
