import { SkeletonStats } from "@/components/ui/Skeleton";
import { IMetrikaSummary, METRIKA_PERIODS, MetrikaPeriod } from "@/api/metrika";
import { TELEMETRY_APPS, TelemetryApp } from "@/api/telemetry";
import PulseDashboardCard from "@/components/admin/PulseDashboardCard";
import TelemetrySection from "@/components/admin/TelemetrySection";
import Button from "@/components/ui/Button";
import ScreenWithBg from "@/components/ui/ScreenWithBg";
import Spinner from "@/components/ui/Spinner";
import TrendChart from "@/components/ui/TrendChart";
import { useAsync } from "@/hooks/useAsync";
import { fmt } from "@/i18n/translations";
import { useLang } from "@/i18n/LanguageContext";
import { metrikaRepository } from "@/repositories/MetrikaRepository";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/** Series colours — the panel's accent for visits, a muted violet for users. */
const COLOR_VISITS = "#07ddf1";
const COLOR_USERS = "#9b7bff";

/**
 * How often an open website tab re-reads by itself. Matched to the backend's
 * cache TTL: polling faster would only re-serve the same cached window, and
 * polling slower would leave the section visibly frozen while somebody is
 * watching it.
 */
const AUTO_REFRESH_MS = 60_000;

/**
 * Floor between the automatic refreshes triggered by the window regaining
 * focus. Coming back from the browser is the moment the figures matter most —
 * but clicking between windows must not turn into a burst of upstream reads.
 */
const FOCUS_REFRESH_FLOOR_MS = 15_000;

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
  const { t } = useLang();
  const [period, setPeriod] = useState<MetrikaPeriod>("week");
  const [app, setApp] = useState<TelemetryApp>("mobile");

  return (
    <ScreenWithBg bg="./bg/admin-home.jpg" title={t("monitoring.title")}>
      {/* Which app is being monitored. First choice on the screen, because
          every number below it is meaningless without knowing whose it is. */}
      <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {TELEMETRY_APPS.map((a) => (
          <Button
            key={a}
            variant={a === app ? "primary" : "secondary"}
            onClick={() => setApp(a)}
            aria-pressed={a === app}
          >
            {t(`monitoring.app.${a}`)}
          </Button>
        ))}
      </div>

      {/* Reporting window. Shared by every section so switching app keeps the
          period you were already looking at. */}
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
      </div>

      {app === "website"
        ? <WebsiteSection period={period} />
        : <TelemetrySection app={app} period={period} />}

      {/* Backend performance monitoring sits under every tab — it is the one
          layer all four clients share, so it belongs to none of them alone. */}
      <div className="row" style={{ gap: 12, flexWrap: "wrap", marginTop: 8 }}>
        <PulseDashboardCard />
      </div>
    </ScreenWithBg>
  );
};

/**
 * The website tab — Yandex.Metrica for the public landing page, proxied by our
 * own backend so no counter id or credential ever lives in this client.
 *
 * ## Why this section refreshes itself
 * The figures used to be loaded once, on mount, and served from a server-side
 * cache on top of that — so an admin who opened the site in a browser and came
 * straight back saw yesterday's picture and no way to tell it was stale. Three
 * things fix that, in ascending order of force:
 *
 *  1. a periodic reload, which is happy to be served from the server cache;
 *  2. a reload when the window regains focus — exactly the moment somebody
 *     returns from the browser they just visited the site in;
 *  3. an explicit refresh button, which tells the backend to skip its cache
 *     and re-read Yandex now.
 *
 * `fetched_at` is displayed alongside, because a screen that refreshes but
 * cannot say WHEN its numbers are from is no more trustworthy than one that
 * never refreshes at all.
 */
const WebsiteSection = ({ period }: { period: MetrikaPeriod }) => {
  const { t, lang } = useLang();
  // Read at call time by the loader below, which lets one useAsync serve both
  // the ordinary cached load and a forced, cache-skipping refresh.
  const freshRef = useRef(false);
  const lastFreshAtRef = useRef(0);
  const { data, loading, error, reload } = useAsync(
    () => metrikaRepository.summary(period, freshRef.current),
    [period],
  );

  const refresh = useCallback(
    async (floorMs = 0) => {
      const now = Date.now();
      if (floorMs > 0 && now - lastFreshAtRef.current < floorMs) return;

      lastFreshAtRef.current = now;
      freshRef.current = true;
      try {
        await reload();
      } finally {
        // Cleared in `finally` so a failed refresh cannot leave every later
        // periodic reload silently forcing an upstream call.
        freshRef.current = false;
      }
    },
    [reload],
  );

  // Periodic reload. Skipped while the window is hidden: a panel minimised for
  // a whole shift should cost nothing, and it reloads on focus anyway.
  useEffect(() => {
    const timer = setInterval(() => {
      if (!document.hidden) void reload();
    }, AUTO_REFRESH_MS);

    return () => clearInterval(timer);
  }, [reload]);

  // Back from the browser → re-read Yandex, not the cache.
  useEffect(() => {
    const onFocus = () => {
      if (!document.hidden) void refresh(FOCUS_REFRESH_FLOOR_MS);
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [refresh]);

  const updatedAt = useMemo(
    () => (data ? formatClock(data.fetched_at, lang) : null),
    [data, lang],
  );

  return (
    <>
      <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <span className="muted" style={{ fontSize: 12, flex: 1 }}>
          {/* Absent while the first load is in flight, and on a backend that
              predates the stamp — in both cases showing nothing beats showing
              a time that is not one. */}
          {updatedAt && fmt(t("metrics.updatedAt"), updatedAt)}
        </span>
        <Button variant="secondary" onClick={() => void refresh()} disabled={loading}>
          {loading ? t("metrics.refreshing") : t("metrics.refresh")}
        </Button>
        {data?.dashboard_url && (
          <Button
            variant="secondary"
            onClick={() => window.open(data.dashboard_url!, "_blank", "noopener,noreferrer")}
          >
            {t("metrics.openYandex")}
          </Button>
        )}
      </div>

      {/* Sets the expectation the refresh button cannot: the last few minutes
          are Yandex's own aggregation lag, not our staleness. Only alongside
          real figures — on an unconfigured or unreachable counter it would be
          answering a question nobody is asking yet. */}
      {data?.status === "ok" && (
        <div className="muted" style={{ fontSize: 12 }}>{t("metrics.yandexLag")}</div>
      )}

      {/* Keep the previous window on screen while the next one loads —
          blanking the page on every period switch reads as a crash. */}
      {loading && !data && <SkeletonStats tiles={4} />}

      {error && (
        <div className="card">
          <div style={{ fontWeight: 700 }}>{t("metrics.loadFailed")}</div>
          <div className="muted" style={{ marginBottom: 10 }}>{t("metrics.loadFailedSub")}</div>
          <Button variant="secondary" onClick={() => void reload()}>{t("metrics.retry")}</Button>
        </div>
      )}

      {data && <SummaryBody summary={data} lang={lang} t={t} />}
    </>
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

/**
 * The `fetched_at` instant → a 24-hour wall clock in the operator's timezone.
 * Seconds are kept: the whole point of the stamp is telling "a moment ago"
 * apart from "a minute ago".
 *
 * Returns null — not "Invalid Date", not a dash — when there is no usable
 * instant, so the caller can leave the line out entirely. That is also what a
 * backend older than the `fetched_at` field degrades to.
 */
const formatClock = (iso: string, lang: string): string | null => {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed.toLocaleTimeString(lang, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
};

/** Seconds → "m:ss", the form an average visit length is read in. */
const formatDuration = (seconds: number): string => {
  const safe = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safe / 60);
  return `${minutes}:${String(safe % 60).padStart(2, "0")}`;
};

export default Metrics;
