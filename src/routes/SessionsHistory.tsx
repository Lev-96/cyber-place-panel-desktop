import ScreenWithBg from "@/components/ui/ScreenWithBg";
import Spinner from "@/components/ui/Spinner";
import { useAsync } from "@/hooks/useAsync";
import { useSessionsSummary } from "@/hooks/useSessionsSummary";
import { formatDateTime, formatTime } from "@/i18n/dates";
import { useLang } from "@/i18n/LanguageContext";
import { sessionRepository } from "@/repositories/SessionRepository";
import { ISessionApi } from "@/types/sessions";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

/** Local "YYYY-MM-DD" — what `<input type="date">` reads/writes. */
const toDateInput = (d: Date): string => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

/**
 * Convert a local "YYYY-MM-DD" plus a side ("start" | "end") into an ISO timestamp
 * that represents that exact local-day boundary in UTC. Backend honours the offset,
 * so the cashier's "today" matches their wall clock — not server UTC.
 */
const toLocalBoundary = (dateInput: string, side: "start" | "end"): string => {
  const [y, m, d] = dateInput.split("-").map(Number);
  const date = side === "start"
    ? new Date(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0)
    : new Date(y, (m ?? 1) - 1, d ?? 1, 23, 59, 59, 999);
  return date.toISOString();
};

const num = (v: unknown): number => {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

const SessionsHistory = () => {
  const { branchId } = useParams();
  const id = Number(branchId);
  const { t, money } = useLang();

  const today = useMemo(() => toDateInput(new Date()), []);
  const [from, setFrom] = useState<string>(today);
  const [to, setTo] = useState<string>(today);

  const fromIso = useMemo(() => toLocalBoundary(from, "start"), [from]);
  const toIso = useMemo(() => toLocalBoundary(to, "end"), [to]);

  const { data, loading, error, reload } = useAsync(
    () => sessionRepository.list({ branch_id: id, from: fromIso, to: toIso, limit: 1000 }),
    [id, fromIso, toIso],
  );

  const summary = useSessionsSummary(data);

  if (!Number.isFinite(id) || id <= 0) return <div className="error">{t("hub.invalidId")}</div>;

  const setRange = (kind: "today" | "yesterday" | "month") => {
    const now = new Date();
    if (kind === "today") {
      setFrom(toDateInput(now));
      setTo(toDateInput(now));
    } else if (kind === "yesterday") {
      const y = new Date(now);
      y.setDate(now.getDate() - 1);
      setFrom(toDateInput(y));
      setTo(toDateInput(y));
    } else {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      setFrom(toDateInput(start));
      setTo(toDateInput(now));
    }
  };

  return (
    <ScreenWithBg bg="./bg/branch.jpg" title={`${t("history.title")} · #${id}`}>
      <div className="gradient-card">
        <div className="gradient-card-inner">
          <div className="row" style={{ gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div className="col" style={{ gap: 4 }}>
              <span className="label">{t("history.from")}</span>
              <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="input" />
            </div>
            <div className="col" style={{ gap: 4 }}>
              <span className="label">{t("history.to")}</span>
              <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="input" />
            </div>
            <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
              <button type="button" className="pill" onClick={() => setRange("today")}>{t("history.today")}</button>
              <button type="button" className="pill" onClick={() => setRange("yesterday")}>{t("history.yesterday")}</button>
              <button type="button" className="pill" onClick={() => setRange("month")}>{t("history.month")}</button>
              <button type="button" className="pill" onClick={() => void reload()}>{t("action.refresh")}</button>
            </div>
            <div style={{ marginLeft: "auto" }}>
              <Link to={`/branches/${id}/sessions`} className="muted">{t("history.backToBoard")}</Link>
            </div>
          </div>

          <div className="stat-grid" style={{ marginTop: 12 }}>
            <Tile k={t("history.sumSessions")} v={`${summary.stopped}${summary.active > 0 ? ` (+${summary.active})` : ""}`} />
            <Tile k={t("history.sumTotal")} v={money(summary.total)} />
            <Tile k={t("history.sumTime")} v={money(summary.timeTotal)} />
            <Tile k={t("history.sumItemsRevenue")} v={money(summary.itemsTotal)} />
            <Tile k={t("history.sumItemsQty")} v={String(summary.itemsQty)} />
          </div>

          {summary.topItems.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <span className="muted" style={{ fontSize: 12 }}>{t("history.topItems")}</span>
              <div className="row" style={{ gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                {summary.topItems.map((it) => (
                  <span key={it.name} className="pill" style={{ textTransform: "none", letterSpacing: 0 }}>
                    {it.name} · {it.qty} · {money(it.total)}
                  </span>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

      {loading && <Spinner />}
      {error && <div className="error">{error.message}</div>}

      {!loading && !error && (
        <SessionsList sessions={data ?? []} />
      )}
    </ScreenWithBg>
  );
};

const SessionsList = ({ sessions }: { sessions: ISessionApi[] }) => {
  const { t } = useLang();
  if (sessions.length === 0) return <div className="muted">{t("history.empty")}</div>;
  return (
    <div className="col" style={{ gap: 8 }}>
      {sessions.map((s) => <SessionRow key={s.id} session={s} />)}
    </div>
  );
};

const formatRange = (startedAt: string, endsAt: string | null): { dateLabel: string; durationMin: number } => {
  const start = new Date(startedAt);
  const end = endsAt ? new Date(endsAt) : null;
  const dateLabel = end
    ? `${formatDateTime(start)} → ${formatTime(end)}`
    : formatDateTime(start);
  const durationMs = end ? Math.max(0, end.getTime() - start.getTime()) : 0;
  return { dateLabel, durationMin: Math.round(durationMs / 60_000) };
};

const SessionRow = ({ session }: { session: ISessionApi }) => {
  const { t, money } = useLang();
  const { dateLabel, durationMin } = formatRange(session.started_at, session.ends_at);
  const items = session.items ?? [];
  const itemsTotal = items.reduce((sum, it) => sum + num(it.price) * num(it.qty), 0);
  const total = num(session.total_paid);
  const timeCost = Math.max(0, total - itemsTotal);
  const isClosed = session.status === "stopped" || session.status === "expired";
  const statusLabel = t(`history.status.${session.status}`) || session.status;
  const modeLabel = session.mode === "open" ? t("history.modeOpen") : t("history.modeFixed");

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div className="row-between" style={{ gap: 12, flexWrap: "wrap" }}>
        <div className="row" style={{ gap: 8, alignItems: "baseline" }}>
          <strong style={{ fontSize: 15, color: "#07ddf1" }}>{session.pc_label || `#${session.pc_id}`}</strong>
          <span className="pill" style={{ fontSize: 11, textTransform: "none", letterSpacing: 0 }}>{modeLabel}</span>
          <span className="pill" style={{ fontSize: 11, textTransform: "none", letterSpacing: 0, opacity: isClosed ? 1 : 0.7 }}>{statusLabel}</span>
        </div>
        <div className="row" style={{ gap: 8, alignItems: "baseline" }}>
          <span className="muted" style={{ fontSize: 12 }}>{dateLabel}</span>
          {durationMin > 0 && <span className="muted" style={{ fontSize: 12 }}>· {durationMin} {t("time.minShort")}</span>}
        </div>
      </div>

      {(session.user_display_name || session.package_name) && (
        <div className="muted" style={{ fontSize: 12 }}>
          {session.package_name && <>{t("session.tariffField")}: {session.package_name}</>}
          {session.user_display_name && <> {session.package_name ? "· " : ""}{session.user_display_name}</>}
        </div>
      )}

      {items.length > 0 && (
        <div className="col" style={{ gap: 2, marginTop: 4 }}>
          {items.map((it) => (
            <div key={it.id} className="row-between" style={{ fontSize: 13 }}>
              <span>{it.name} {num(it.qty) > 1 && <span className="muted">× {num(it.qty)}</span>}</span>
              <span>{money(num(it.price) * num(it.qty))}</span>
            </div>
          ))}
        </div>
      )}

      {isClosed ? (
        <>
          <div className="row-between" style={{ borderTop: "1px solid #1f2a44", paddingTop: 6, marginTop: 4, fontSize: 13 }}>
            <span className="muted">{t("history.timeCost")}</span>
            <span>{money(timeCost)}</span>
          </div>
          {items.length > 0 && (
            <div className="row-between" style={{ fontSize: 13 }}>
              <span className="muted">{t("history.itemsTotal")}</span>
              <span>{money(itemsTotal)}</span>
            </div>
          )}
          <div className="row-between" style={{ fontSize: 15, fontWeight: 700 }}>
            <span>{t("history.total")}</span>
            <span>{money(total)}</span>
          </div>
        </>
      ) : (
        items.length > 0 && (
          <div className="row-between" style={{ fontSize: 13, borderTop: "1px solid #1f2a44", paddingTop: 6, marginTop: 4 }}>
            <span className="muted">{t("history.itemsTotal")}</span>
            <span>{money(itemsTotal)}</span>
          </div>
        )
      )}
    </div>
  );
};

const Tile = ({ k, v }: { k: string; v: string | number }) => (
  <div className="stat-tile">
    <span className="k">{k}</span>
    <span className="v">{v}</span>
  </div>
);

export default SessionsHistory;
