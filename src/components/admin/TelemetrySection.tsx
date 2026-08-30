import { ITelemetryCount, ITelemetrySummary, TelemetryApp } from "@/api/telemetry";
import { MetrikaPeriod } from "@/api/metrika";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import TrendChart from "@/components/ui/TrendChart";
import { useAsync } from "@/hooks/useAsync";
import { useLang } from "@/i18n/LanguageContext";
import { telemetryRepository } from "@/repositories/TelemetryRepository";
import { useMemo } from "react";

const COLOR_EVENTS = "#07ddf1";
const COLOR_ERRORS = "#ff6b81";

/**
 * One app's monitoring section: mobile, desktop panel, or kiosk agent.
 *
 * Reads exactly like the website tab beside it — status, headline tiles,
 * trend, breakdowns — so switching tab never means re-learning the layout.
 *
 * Every state is explicit. A zeroed card here means "this app has reported
 * nothing in this window", which is a real answer and a different one from
 * "the request failed"; `last_seen_at` is what separates "quiet today" from
 * "we have never heard from this app at all", and it is deliberately not
 * bounded by the selected period.
 */
const TelemetrySection = ({ app, period }: { app: TelemetryApp; period: MetrikaPeriod }) => {
  const { t, lang } = useLang();
  const { data, loading, error, reload } = useAsync(
    () => telemetryRepository.summary(app, period),
    [app, period],
  );

  if (loading && !data) return <Spinner />;

  if (error) {
    return (
      <div className="card">
        <div style={{ fontWeight: 700 }}>{t("monitoring.loadFailed")}</div>
        <div className="muted" style={{ marginBottom: 10 }}>{t("monitoring.loadFailedSub")}</div>
        <Button variant="secondary" onClick={() => void reload()}>{t("metrics.retry")}</Button>
      </div>
    );
  }

  if (!data) return null;

  if (data.status === "disabled") {
    return (
      <div className="card">
        <div style={{ fontWeight: 700 }}>{t("monitoring.disabled")}</div>
        <div className="muted">{t("monitoring.disabledSub")}</div>
      </div>
    );
  }

  if (data.status === "unavailable") {
    return (
      <div className="card">
        <div style={{ fontWeight: 700 }}>{t("metrics.unavailable")}</div>
        <div className="muted">{t("metrics.unavailableSub")}</div>
      </div>
    );
  }

  return <Body summary={data} lang={lang} t={t} />;
};

interface BodyProps {
  summary: ITelemetrySummary;
  lang: string;
  t: (key: string) => string;
}

const Body = ({ summary, lang, t }: BodyProps) => {
  const labels = useMemo(
    () => summary.trend.map((p) => formatLabel(p.label, lang)),
    [summary.trend, lang],
  );

  const silent = summary.totals.events === 0;

  return (
    <>
      <div className="row" style={{ gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <HealthBadge summary={summary} t={t} lang={lang} />
      </div>

      {silent && (
        <div className="card muted">
          {summary.last_seen_at ? t("monitoring.quietWindow") : t("monitoring.neverReported")}
        </div>
      )}

      <div className="stat-grid">
        <Tile k={t("monitoring.installs")} v={summary.totals.installs.toLocaleString(lang)} />
        <Tile k={t("monitoring.launches")} v={summary.totals.launches.toLocaleString(lang)} />
        <Tile k={t("monitoring.events")} v={summary.totals.events.toLocaleString(lang)} />
        <Tile k={t("monitoring.errors")} v={summary.totals.errors.toLocaleString(lang)} tone={summary.totals.errors > 0 ? "bad" : undefined} />
        <Tile k={t("monitoring.errorRate")} v={`${summary.totals.error_rate}%`} tone={summary.totals.error_rate >= 5 ? "bad" : undefined} />
      </div>

      {labels.length >= 2 ? (
        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 8 }}>{t("monitoring.activity")}</div>
          <TrendChart
            labels={labels}
            series={[
              { name: t("monitoring.events"), values: summary.trend.map((p) => p.events), color: COLOR_EVENTS },
              { name: t("monitoring.errors"), values: summary.trend.map((p) => p.errors), color: COLOR_ERRORS },
            ]}
          />
        </div>
      ) : (
        <div className="card muted">{t("metrics.noData")}</div>
      )}

      <div className="row" style={{ gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
        <BarCard title={t("monitoring.versions")} rows={summary.versions} lang={lang} t={t} suffix={t("monitoring.installsShort")} />
        <BarCard title={t("monitoring.platforms")} rows={summary.platforms} lang={lang} t={t} suffix={t("monitoring.installsShort")} />
      </div>

      <BarCard title={t("monitoring.screens")} rows={summary.screens} lang={lang} t={t} suffix={t("monitoring.viewsShort")} />

      <div className="card">
        <div style={{ fontWeight: 700, marginBottom: 8 }}>{t("monitoring.recentErrors")}</div>
        {summary.recent_errors.length === 0 && (
          <div className="muted">{t("monitoring.noErrors")}</div>
        )}
        {summary.recent_errors.map((e, i) => (
          <div
            key={`${e.occurred_at}-${i}`}
            style={{
              padding: "8px 0",
              borderTop: i === 0 ? "none" : "1px solid rgba(255,255,255,.06)",
            }}
          >
            <div className="row" style={{ justifyContent: "space-between", gap: 12 }}>
              <span style={{ fontWeight: 600, color: COLOR_ERRORS }}>{e.name}</span>
              <span className="muted" style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                {formatMoment(e.occurred_at, lang)}
              </span>
            </div>
            {e.message && (
              <div className="muted" style={{ fontSize: 13, marginTop: 2, wordBreak: "break-word" }}>
                {e.message}
              </div>
            )}
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
              {[e.app_version, e.platform].filter(Boolean).join(" · ") || "—"}
            </div>
          </div>
        ))}
      </div>
    </>
  );
};

/**
 * "Is this app alive?" — the first question anyone opens this screen to ask,
 * so it is answered before any number.
 */
const HealthBadge = ({ summary, t, lang }: { summary: ITelemetrySummary; t: (k: string) => string; lang: string }) => {
  const seen = summary.last_seen_at ? new Date(summary.last_seen_at) : null;
  const minutesAgo = seen ? (Date.now() - seen.getTime()) / 60000 : Infinity;

  const tone = !seen ? "idle" : minutesAgo <= 60 ? "good" : minutesAgo <= 60 * 24 ? "warn" : "idle";
  const color = tone === "good" ? "#3ddc97" : tone === "warn" ? "#ffc857" : "rgba(255,255,255,.35)";

  return (
    <span
      className="row"
      style={{
        gap: 8, alignItems: "center", padding: "6px 12px", borderRadius: 999,
        background: "rgba(255,255,255,.05)", fontSize: 13,
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flex: "0 0 auto" }} />
      <span className="muted">
        {seen ? `${t("monitoring.lastSeen")}: ${formatMoment(summary.last_seen_at!, lang)}` : t("monitoring.neverSeen")}
      </span>
    </span>
  );
};

const BarCard = ({
  title, rows, lang, t, suffix,
}: {
  title: string;
  rows: ITelemetryCount[];
  lang: string;
  t: (k: string) => string;
  suffix: string;
}) => (
  <div className="card" style={{ flex: "1 1 280px", minWidth: 260 }}>
    <div style={{ fontWeight: 700, marginBottom: 8 }}>{title}</div>
    {rows.length === 0 && <div className="muted">{t("metrics.noData")}</div>}
    {rows.map((r) => (
      <div key={r.label} style={{ marginBottom: 10 }}>
        <div className="row" style={{ justifyContent: "space-between", gap: 12 }}>
          <span style={{ wordBreak: "break-word" }}>{r.label}</span>
          <span className="muted" style={{ whiteSpace: "nowrap" }}>
            {r.value.toLocaleString(lang)} {suffix}
          </span>
        </div>
        <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,.08)", marginTop: 4 }}>
          <div
            style={{
              width: `${Math.min(100, Math.max(0, r.share))}%`,
              height: "100%",
              borderRadius: 3,
              background: COLOR_EVENTS,
            }}
          />
        </div>
      </div>
    ))}
  </div>
);

const Tile = ({ k, v, tone }: { k: string; v: string; tone?: "bad" }) => (
  <div className="stat-tile">
    <span className="k">{k}</span>
    <span className="v" style={tone === "bad" ? { color: COLOR_ERRORS } : undefined}>{v}</span>
  </div>
);

/** Buckets come back as "YYYY-MM-DD" or "YYYY-MM-DD HH:00:00". */
const formatLabel = (raw: string, lang: string): string => {
  const parsed = new Date(raw.replace(" ", "T"));
  if (Number.isNaN(parsed.getTime())) return raw;

  return raw.includes(":")
    ? parsed.toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit", hour12: false })
    : parsed.toLocaleDateString(lang, { day: "2-digit", month: "2-digit" });
};

const formatMoment = (iso: string, lang: string): string => {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;

  return parsed.toLocaleString(lang, {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  });
};

export default TelemetrySection;
