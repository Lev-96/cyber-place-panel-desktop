import { ListSkeleton, SkeletonForm } from "@/components/ui/Skeleton";
import HourlyRatesForm from "@/components/branches/HourlyRatesForm";
import PackageForm from "@/components/packages/PackageForm";
import BranchExtraItemForm from "@/components/prices/BranchExtraItemForm";
import BranchJoystickForm from "@/components/prices/BranchJoystickForm";
import MoneyRoundingForm from "@/components/prices/MoneyRoundingForm";
import PlatformPricesForm from "@/components/prices/PlatformPricesForm";
import SubplatformPricesForm from "@/components/prices/SubplatformPricesForm";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import { useAsync } from "@/hooks/useAsync";
import { useLang } from "@/i18n/LanguageContext";
import { timePackageNameOf } from "@/i18n/timePackageName";
import { branchRepository } from "@/repositories/BranchRepository";
import { billingSettingsRepository } from "@/repositories/BillingSettingsRepository";
import { platformPriceRepository } from "@/repositories/PlatformPriceRepository";
import { subplatformRepository } from "@/repositories/SubplatformRepository";
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
  const platformPrices = useAsync(() => platformPriceRepository.listByBranch(id), [id]);
  const subplatforms = useAsync(() => subplatformRepository.listByBranch(id), [id]);
  // One read for both money policies — the joystick fee and the rounding rule
  // are two fields on the same branch and the same endpoint.
  const billing = useAsync(() => billingSettingsRepository.get(id), [id]);

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
        {branch.loading && <SkeletonForm fields={3} />}
        {branch.error && <div className="error">{branch.error.message}</div>}
        {branch.data && (
          <HourlyRatesForm branch={branch.data} onSaved={() => void branch.reload()} />
        )}

      </section>

      {/* Custom-platform hourly rates — same shape as the matrix above so a
          custom platform reads exactly like pc/ps4/ps5 (a Standard column and
          a VIP column). Created automatically when a place of that type is
          added (in Places) — never by hand here — and editable (name in 3
          languages + each tier). Editing a tier re-points its places + devices. */}
      {(platformPrices.data?.length ?? 0) > 0 && (
        <section className="col" style={{ gap: 12 }}>
          <h2 className="page-title" style={{ margin: 0 }}>{t("platformPrice.sectionTitle")}</h2>
          <PlatformPricesForm
            key={(platformPrices.data ?? []).map((p) => p.id).join(",")}
            prices={platformPrices.data ?? []}
            onSaved={() => void platformPrices.reload()}
          />
        </section>
      )}

      {/* Subplatform rates — the sub-categories of a platform ("PS5 + VR").
          Created in Places on the second row of tabs; here they are renamed (in
          3 languages) and priced. An empty cell is a value, not a gap: it means
          "bill the same as the platform". */}
      {(subplatforms.data?.length ?? 0) > 0 && (
        <section className="col" style={{ gap: 12 }}>
          <h2 className="page-title" style={{ margin: 0 }}>{t("subplatform.sectionTitle")}</h2>
          <SubplatformPricesForm
            key={(subplatforms.data ?? []).map((s) => s.id).join(",")}
            subplatforms={subplatforms.data ?? []}
            onSaved={() => void subplatforms.reload()}
          />
        </section>
      )}

      {/* ⚠️ Extra joysticks had a section here and it is gone from this page
          ON PURPOSE, with nothing behind it removed. What a pad costs, how it
          is priced and how often it is charged are answers a ROOM gives — a
          club sells its VIP's controllers differently from its floor's — so
          they live in the place's own form, beside that room's rate, and are
          written by the same owner-level permission. The branch columns remain
          as the fallback every room inherits until it says otherwise. */}
      {/* The venue's joystick fee — the figure every room inherits until it
          prices its own pads. Small on purpose: which pads cost money and how
          much, and nothing else. HOW a pad is priced and how often it is
          charged are the room's questions and are asked on the place's form.
          The two must not both ask, or one venue gets two answers. */}
      <section className="col" style={{ gap: 12 }}>
        <h2 className="page-title" style={{ margin: 0 }}>{t("branchJoystick.sectionTitle")}</h2>
        {billing.data && (
          <BranchJoystickForm
            key={`${billing.data.joystick_price}:${billing.data.joystick_charged_slots}`}
            branchId={id}
            settings={billing.data}
            onSaved={() => void billing.reload()}
          />
        )}
      </section>

      {/* And the same question for a room on a CUSTOM platform — a billiard
          table's cue, a poker table's chips. The pads answer it for
          PlayStation seats above; this answers it for everything else, and a
          room that has set its own ignores both. A venue with ten billiard
          tables answers once. */}
      <section className="col" style={{ gap: 12 }}>
        <h2 className="page-title" style={{ margin: 0 }}>{t("branchExtraItem.sectionTitle")}</h2>
        {billing.data && (
          <BranchExtraItemForm
            key={`${billing.data.extra_item_name}:${billing.data.extra_item_price}`}
            branchId={id}
            settings={billing.data}
            onSaved={() => void billing.reload()}
          />
        )}
      </section>

      {/* Rounding. Last, and after every rate, because it is the rule applied
          to what all of them add up to. */}
      <section className="col" style={{ gap: 12 }}>
        <h2 className="page-title" style={{ margin: 0 }}>{t("rounding.sectionTitle")}</h2>
        {billing.data && (
          <MoneyRoundingForm
            key={`${billing.data.money_rounding_step}:${billing.data.money_rounding_mode}`}
            branchId={id}
            settings={billing.data}
            onSaved={() => void billing.reload()}
          />
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
        {packages.loading && <ListSkeleton rows={4} />}
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
