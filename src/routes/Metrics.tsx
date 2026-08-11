import { IMetrikaSummary, METRIKA_PERIODS, MetrikaPeriod } from "@/api/metrika";
import PulseDashboardCard from "@/components/admin/PulseDashboardCard";
import Button from "@/components/ui/Button";
import ScreenWithBg from "@/components/ui/ScreenWithBg";
import Spinner from "@/components/ui/Spinner";
import TrendChart from "@/components/ui/TrendChart";
import { useAsync } from "@/hooks/useAsync";
import { useLang } from "@/i18n/LanguageContext";
import { metrikaRepository } from "@/repositories/MetrikaRepository";
import { useMemo, useState } from "react";

/** Series colours — the panel's accent for visits, a muted violet for users. */
const COLOR_VISITS = "#07ddf1";
const COLOR_USERS = "#9b7bff";

/**
 * Admin "Метрики" section — website analytics for the public landing page,
 * proxied from Yandex.Metrica by our own backend.
 *
 * ## Why every state is explicit
 * The endpoint always answers 200 and reports WHY through `status`, so this
 * screen has one render path with three terminal states (live / not configured
 * / upstream unavailable) instead of inferring failure from empty numbers. A
 * zeroed card is a real "no traffic yet" answer here, never a disguised error.
 *
 * The backend also owns the counter id: this screen only ever follows the
 * `dashboard_url` it is handed, so no counter or credential lives in the client.
 */
const Metrics = () => {
  const { t, lang } = useLang();
  const [period, setPeriod] = useState<MetrikaPeriod>("week");

  const { data, loading, error, reload } = useAsync(
    () => metrikaRepository.summary(period),
    [period],
  );

  return (
    <ScreenWithBg bg="./bg/admin-home.jpg" title={t("metrics.title")}>
      <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {METRIKA_PERIODS.map((p) => (
          <Button
            key={p}
            variant={p === period ? "primary" : "secondary"}
            onClick={() => setPeriod(p)}
            aria-pressed={p === period}
          >
            {t(`metrics.period.${p}`)}
          </Button>
        ))}
        <span style={{ flex: 1 }} />
        {data?.dashboard_url && (
          <Button
            variant="secondary"
            onClick={() => window.open(data.dashboard_url!, "_blank", "noopener,noreferrer")}
          >
            {t("metrics.openYandex")}
          </Button>
        )}
      </div>

      {/* Keep the previous window on screen while the next one loads —
          blanking the page on every period switch reads as a crash. */}
      {loading && !data && <Spinner />}

      {error && (
        <div className="card">
          <div style={{ fontWeight: 700 }}>{t("metrics.loadFailed")}</div>
          <div className="muted" style={{ marginBottom: 10 }}>{t("metrics.loadFailedSub")}</div>
          <Button variant="secondary" onClick={() => void reload()}>{t("metrics.retry")}</Button>
        </div>
      )}

      {data && <SummaryBody summary={data} lang={lang} t={t} />}

      {/* Backend performance monitoring lives next to website analytics —
          both answer "how is the product doing", just at different layers. */}
      <div className="row" style={{ gap: 12, flexWrap: "wrap", marginTop: 8 }}>
        <PulseDashboardCard />
      </div>
    </ScreenWithBg>
  );
};

interface BodyProps {
  summary: IMetrikaSummary;
  lang: string;
  t: (key: string) => string;
}

const SummaryBody = ({ summary, lang, t }: BodyProps) => {
  // Labels come back as Metrica's raw interval starts; format them in the
  // operator's locale here rather than baking a format into the API.
  const labels = useMemo(
    () => summary.trend.map((p) => formatLabel(p.label, lang)),
    [summary.trend, lang],
  );

  if (summary.status === "not_configured") {
    return (
      <div className="card">
        <div style={{ fontWeight: 700 }}>{t("metrics.notConfigured")}</div>
        <div className="muted">{t("metrics.notConfiguredSub")}</div>
      </div>
    );
  }

  if (summary.status === "unavailable") {
    return (
      <div className="card">
        <div style={{ fontWeight: 700 }}>{t("metrics.unavailable")}</div>
        <div className="muted">{t("metrics.unavailableSub")}</div>
      </div>
    );
  }

  return (
    <>
      {summary.sampled && (
        <div className="muted" style={{ fontSize: 12 }}>{t("metrics.sampled")}</div>
      )}

      <div className="stat-grid">
        <Tile k={t("metrics.visits")} v={summary.totals.visits.toLocaleString(lang)} />
        <Tile k={t("metrics.users")} v={summary.totals.users.toLocaleString(lang)} />
        <Tile k={t("metrics.bounceRate")} v={`${summary.totals.bounce_rate}%`} />
        <Tile k={t("metrics.pageDepth")} v={String(summary.totals.page_depth)} />
        <Tile k={t("metrics.avgVisit")} v={formatDuration(summary.totals.avg_visit_seconds)} />
      </div>

      {labels.length >= 2 ? (
        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 8 }}>{t("metrics.trend")}</div>
          <TrendChart
            labels={labels}
            series={[
              { name: t("metrics.visits"), values: summary.trend.map((p) => p.visits), color: COLOR_VISITS },
              { name: t("metrics.users"), values: summary.trend.map((p) => p.users), color: COLOR_USERS },
            ]}
          />
        </div>
      ) : (
        <div className="card muted">{t("metrics.noData")}</div>
      )}

      <div className="card">
        <div style={{ fontWeight: 700, marginBottom: 8 }}>{t("metrics.sources")}</div>
        {summary.sources.length === 0 && <div className="muted">{t("metrics.noData")}</div>}
        {summary.sources.map((s) => (
          <div key={s.source} style={{ marginBottom: 10 }}>
            <div className="row" style={{ justifyContent: "space-between", gap: 12 }}>
              <span>{s.source}</span>
              <span className="muted">
                {s.visits.toLocaleString(lang)} · {s.share}%
              </span>
            </div>
            <div
              style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,.08)", marginTop: 4 }}
            >
              <div
                style={{
                  width: `${Math.min(100, Math.max(0, s.share))}%`,
                  height: "100%",
                  borderRadius: 3,
                  background: COLOR_VISITS,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </>
  );
};

const Tile = ({ k, v }: { k: string; v: string }) => (
  <div className="stat-tile">
    <span className="k">{k}</span>
    <span className="v">{v}</span>
  </div>
);

/**
 * Metrica returns "YYYY-MM-DD" for day granularity and "YYYY-MM-DD HH:00:00"
 * for the single-day (hourly) view. Anything unparseable is shown verbatim
 * rather than rendering "Invalid Date" across the axis.
 */
const formatLabel = (raw: string, lang: string): string => {
  const parsed = new Date(raw.replace(" ", "T"));
  if (Number.isNaN(parsed.getTime())) return raw;

  return raw.includes(":")
    ? parsed.toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit", hour12: false })
    : parsed.toLocaleDateString(lang, { day: "2-digit", month: "2-digit" });
};

/** Seconds → "m:ss", the form an average visit length is read in. */
const formatDuration = (seconds: number): string => {
  const safe = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safe / 60);
  return `${minutes}:${String(safe % 60).padStart(2, "0")}`;
};

export default Metrics;
