import { ListSkeleton } from "@/components/ui/Skeleton";
import HourlyRatesForm from "@/components/branches/HourlyRatesForm";
import PackageForm from "@/components/packages/PackageForm";
import BranchExtraItemForm from "@/components/prices/BranchExtraItemForm";
import BranchJoystickForm from "@/components/prices/BranchJoystickForm";
import MoneyRoundingForm from "@/components/prices/MoneyRoundingForm";
import PauseLimitForm from "@/components/prices/PauseLimitForm";
import PlatformPricesForm from "@/components/prices/PlatformPricesForm";
import SubplatformPricesForm from "@/components/prices/SubplatformPricesForm";
import Button from "@/components/ui/Button";
import SettingsSection from "@/components/ui/SettingsSection";
import { useConfirm } from "@/components/ui/ConfirmProvider";
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
  // One read for every billing rule below — they are fields of the same
  // branch policy and the same endpoint. STRICT (`getForEdit`): a failed load
  // shows an error and a retry, never defaults a Save could write back.
  const billing = useAsync(() => billingSettingsRepository.getForEdit(id), [id]);
  const confirm = useConfirm();

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ITimePackage | null>(null);

  if (!Number.isFinite(id) || id <= 0) return <div className="error">{t("hub.invalidId")}</div>;

  const removePackage = async (pkg: ITimePackage) => {
    // The app's own dialog: a native confirm() poisons the Electron renderer's
    // focus (see ConfirmProvider).
    const ok = await confirm(`${t("tariffs.confirmDelete")} "${timePackageNameOf(pkg, lang)}"?`, {
      destructive: true,
      confirmLabel: t("action.delete"),
    });
    if (!ok) return;
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
    <div className="col prices-page">
      <h2 className="page-title" style={{ margin: 0 }}>{t("branch.prices.title")}</h2>

      {/* ── What a seat costs ─────────────────────────────────────────── */}
      <div className="prices-group prices-group--rates">
        <h3 className="prices-group__title">{t("prices.group.rates")}</h3>

        {/* Hourly rates matrix — what the player sees. */}
        <SettingsSection
          title={t("prices.hourlyTitle")}
          loading={branch.loading && !branch.data}
          error={branch.data ? null : branch.error}
          onRetry={() => void branch.reload()}
        >
          {branch.data && (
            <HourlyRatesForm branch={branch.data} onSaved={() => void branch.reload()} />
          )}
        </SettingsSection>

        {/* Custom-platform hourly rates — same shape as the matrix above so a
            custom platform reads exactly like pc/ps4/ps5 (a Standard column and
            a VIP column). Created automatically when a place of that type is
            added (in Places) — never by hand here — and editable (name in 3
            languages + each tier). Editing a tier re-points its places + devices. */}
        {(platformPrices.data?.length ?? 0) > 0 && (
          <SettingsSection title={t("platformPrice.sectionTitle")}>
            <PlatformPricesForm
              key={(platformPrices.data ?? []).map((p) => p.id).join(",")}
              prices={platformPrices.data ?? []}
              onSaved={() => void platformPrices.reload()}
            />
          </SettingsSection>
        )}

        {/* Subplatform rates — the sub-categories of a platform ("PS5 + VR").
            Created in Places on the second row of tabs; here they are renamed
            (in 3 languages) and priced. An empty cell is a value, not a gap: it
            means "bill the same as the platform". */}
        {(subplatforms.data?.length ?? 0) > 0 && (
          <SettingsSection title={t("subplatform.sectionTitle")}>
            <SubplatformPricesForm
              key={(subplatforms.data ?? []).map((s) => s.id).join(",")}
              subplatforms={subplatforms.data ?? []}
              onSaved={() => void subplatforms.reload()}
            />
          </SettingsSection>
        )}
      </div>

      {/* ── What is sold as a package ─────────────────────────────────── */}
      {/* Time packages — used by StartSessionDialog fixed mode AND carrying the
          optional time-windowed discount inline. */}
      <div className="prices-group">
        <h3 className="prices-group__title">{t("prices.group.packages")}</h3>
        <SettingsSection
          title={t("branch.prices.packagesSubtitle")}
          description={t("prices.packagesHint")}
          actions={<Button onClick={() => setCreating(true)}>{t("tariffs.new")}</Button>}
          error={packages.data ? null : packages.error}
          onRetry={() => void packages.reload()}
        >
          {packages.loading && !packages.data ? (
            <ListSkeleton rows={4} />
          ) : (packages.data ?? []).length === 0 ? (
            <div className="prices-empty">
              <span className="muted">{t("tariffs.empty")}</span>
              <Button variant="secondary" onClick={() => setCreating(true)}>{t("tariffs.new")}</Button>
            </div>
          ) : (
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
                  <div
                    key={p.id}
                    className={`list-item list-item--static package-row${active ? "" : " package-row--inactive"}`}
                  >
                    <div className="package-row__main">
                      <div className="name">
                        {timePackageNameOf(p, lang)}
                        {p.platform && <span className="price-badge price-badge--platform">{p.platform}</span>}
                        {hasDiscount && p.is_discount_currently_active && (
                          <span className="price-badge price-badge--success">{t("tariff.discount.activeNow")}</span>
                        )}
                        {!active && <span className="price-badge price-badge--muted">{t("prices.packageInactive")}</span>}
                      </div>
                      <div className="meta">
                        {p.duration_minutes} {t("time.minShort")} · {money(Number(p.price))}
                        {hasDiscount && (
                          <>
                            {" "}·{" "}
                            <span className="package-row__discount">
                              {t("tariff.discount.tag")}{" "}
                              {money(Number(p.discount_price))}{" "}
                              ({p.discount_start_time?.slice(0, 5)}–{p.discount_end_time?.slice(0, 5)}{" "}
                              {renderDays(p.discount_days_of_week)})
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="package-row__actions">
                      <Button variant="secondary" onClick={() => togglePackage(p)} className="package-row__btn">
                        {active ? t("action.deactivate") : t("action.activate")}
                      </Button>
                      <Button variant="secondary" onClick={() => setEditing(p)} className="package-row__btn">
                        {t("action.edit")}
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => removePackage(p)}
                        className="package-row__btn is-danger"
                      >
                        {t("action.delete")}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SettingsSection>
      </div>

      {/* ── The rules applied on top of every bill ────────────────────── */}
      {/* Each block saves on its own; each PUTs the WHOLE policy it was drawn
          from and the page re-reads it after every save (the `key`s remount a
          form when the server's answer changes its values). */}
      <div className="prices-group">
        <h3 className="prices-group__title">{t("prices.group.rules")}</h3>
        <div className="prices-rules">
          {/* The venue's joystick fee — the figure every room inherits until it
              prices its own pads. HOW a pad is priced and how often it is
              charged are the room's questions, asked on the place's form. */}
          <SettingsSection
            title={t("branchJoystick.sectionTitle")}
            loading={billing.loading && !billing.data}
            error={billing.data ? null : billing.error}
            onRetry={() => void billing.reload()}
          >
            {billing.data && (
              <BranchJoystickForm
                key={`${billing.data.joystick_price}:${billing.data.joystick_charged_slots}`}
                branchId={id}
                settings={billing.data}
                onSaved={() => void billing.reload()}
              />
            )}
          </SettingsSection>

          {/* The same question for a room on a CUSTOM platform — a billiard
              table's cue, a poker table's chips. */}
          <SettingsSection
            title={t("branchExtraItem.sectionTitle")}
            loading={billing.loading && !billing.data}
            error={billing.data ? null : billing.error}
            onRetry={() => void billing.reload()}
          >
            {billing.data && (
              <BranchExtraItemForm
                key={`${billing.data.extra_item_name}:${billing.data.extra_item_price}`}
                branchId={id}
                settings={billing.data}
                onSaved={() => void billing.reload()}
              />
            )}
          </SettingsSection>

          {/* Rounding: the rule applied to what every rate adds up to. */}
          <SettingsSection
            title={t("rounding.sectionTitle")}
            loading={billing.loading && !billing.data}
            error={billing.data ? null : billing.error}
            onRetry={() => void billing.reload()}
          >
            {billing.data && (
              <MoneyRoundingForm
                key={`${billing.data.money_rounding_step}:${billing.data.money_rounding_mode}`}
                branchId={id}
                settings={billing.data}
                onSaved={() => void billing.reload()}
              />
            )}
          </SettingsSection>

          {/* The longest one pause may last before the server resumes it. */}
          <SettingsSection
            title={t("pauseLimit.sectionTitle")}
            loading={billing.loading && !billing.data}
            error={billing.data ? null : billing.error}
            onRetry={() => void billing.reload()}
          >
            {billing.data && (
              <PauseLimitForm
                key={String(billing.data.pause_limit_minutes ?? "")}
                branchId={id}
                settings={billing.data}
                onSaved={() => void billing.reload()}
              />
            )}
          </SettingsSection>
        </div>
      </div>

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

export default BranchPricesPage;
