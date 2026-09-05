import ScreenWithBg from "@/components/ui/ScreenWithBg";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { useAsync } from "@/hooks/useAsync";
import { useSessionsSummary } from "@/hooks/useSessionsSummary";
import { formatDateTime, formatTime } from "@/i18n/dates";
import { useLang } from "@/i18n/LanguageContext";
import { sessionRepository } from "@/repositories/SessionRepository";
import { ISessionEvent } from "@/api/sessions";
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

  // The owner's question the session rows cannot answer: who did what. Its own
  // request rather than a field on each session, because it is one flat list
  // for the whole range and joining it onto rows would fetch it many times.
  const events = useAsync(
    () => sessionRepository.listEvents({ branch_id: id, from: fromIso, to: toIso, limit: 500 }),
    [id, fromIso, toIso],
  );

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
    <ScreenWithBg bg="./bg/branch.jpg" title={`${t("history.title")} · №${id}`}>
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
            {/* Counted, and worth nothing — which is the point of showing it
                beside the takings rather than folded into them. */}
            {summary.free > 0 && <Tile k={t("history.sumFree")} v={String(summary.free)} />}
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

      {loading && <ListSkeleton />}
      {error && <div className="error">{error.message}</div>}

      {!loading && !error && (
        <SessionsList sessions={data ?? []} />
      )}

      {!loading && !error && <ActionsLog events={events.data ?? []} />}
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

/**
 * How long the session ran, in whole minutes. 0 while it is still running —
 * `ends_at` is null there and a duration would be a guess.
 *
 * This used to also build a "start → end" label for the header. The instants
 * now live in the attribution block, labelled and each next to the person who
 * caused it, so the header keeps only the figure it alone was showing.
 */
const sessionDurationMinutes = (startedAt: string, endsAt: string | null): number => {
  if (!endsAt) return 0;
  const durationMs = Math.max(0, new Date(endsAt).getTime() - new Date(startedAt).getTime());
  return Math.round(durationMs / 60_000);
};

/**
 * One "Label: value · Who" line.
 *
 * A component rather than three copies of the same JSX: the three lines differ
 * only in their words, and the one that drifts is always the one edited last.
 */
const AttrLine = ({ label, value, by, byLabel }: {
  label: string;
  value: string;
  by: string | null;
  byLabel: string;
}) => (
  <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
    <span className="muted">{label}:</span>
    <span>{value}</span>
    {by && <span className="muted">· {byLabel}: <span style={{ color: "#e6ebf5" }}>{by}</span></span>}
  </div>
);

const SessionRow = ({ session }: { session: ISessionApi }) => {
  const { t, money } = useLang();
  const durationMin = sessionDurationMinutes(session.started_at, session.ends_at);
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
          <strong style={{ fontSize: 15, color: "#07ddf1" }}>{session.pc_label || `№${session.pc_id}`}</strong>
          <span className="pill" style={{ fontSize: 11, textTransform: "none", letterSpacing: 0 }}>{modeLabel}</span>
          <span className="pill" style={{ fontSize: 11, textTransform: "none", letterSpacing: 0, opacity: isClosed ? 1 : 0.7 }}>{statusLabel}</span>
          {session.is_free && (
            <span className="pill" style={{ fontSize: 11, textTransform: "none", letterSpacing: 0 }}>
              {t("session.freeBillShort")}
            </span>
          )}
          {session.is_unlimited && (
            <span className="pill" style={{ fontSize: 11, textTransform: "none", letterSpacing: 0 }}>
              {t("session.unlimited")}
            </span>
          )}
        </div>
        {/* Duration only. The start and end instants moved into the
            attribution block below, where they are labelled and carry the
            person who caused each — printing them twice made the row taller and
            said nothing more. */}
        {durationMin > 0 && (
          <span className="muted" style={{ fontSize: 12 }}>{durationMin} {t("time.minShort")}</span>
        )}
      </div>

      {(session.user_display_name || session.package_name) && (
        <div className="muted" style={{ fontSize: 12 }}>
          {session.package_name && <>{t("session.tariffField")}: {session.package_name}</>}
          {session.user_display_name && <> {session.package_name ? "· " : ""}{session.user_display_name}</>}
        </div>
      )}

      {/* Who ran this seat, when, and where — the three facts the row carried
          an id for, or not at all. The venue's own question after a long
          evening is "who let that table run five hours", and it has no answer
          unless both people and the branch are on the line itself. */}
      <div className="col" style={{ gap: 2, fontSize: 12 }}>
        <AttrLine
          label={t("history.startedAt")}
          value={formatDateTime(session.started_at)}
          by={session.opened_by?.name ?? null}
          byLabel={t("history.startedBy")}
        />
        {isClosed && (
          <AttrLine
            label={t("history.endedAt")}
            value={formatDateTime(session.stopped_at ?? session.ends_at)}
            // Null is the answer, not a gap: the kiosk agent expired this
            // session when its paid time ran out and nobody pressed Stop.
            by={session.stopped_by?.name ?? t("history.endedAutomatically")}
            byLabel={t("history.endedBy")}
          />
        )}
        {session.branch && (
          <AttrLine
            label={t("history.branch")}
            value={[session.branch.company_name, session.branch.address].filter(Boolean).join(" — ")}
            by={null}
            byLabel=""
          />
        )}
      </div>

      {/* Each pad over the interval it was actually in play. "Joystick #3,
          15:00→16:00" is a line a cashier can defend at the counter; a count
          multiplied by the session's length is the line that starts the
          argument. */}
      {(session.joysticks?.length ?? 0) > 0 && (
        <div className="col" style={{ gap: 2, fontSize: 12 }}>
          {(session.joysticks ?? []).map((j) => (
            <div key={j.id} className="row-between">
              <span className="muted">
                {t("session.joystickSlot").replace("{0}", String(j.slot))}
              </span>
              <span className="muted">
                {formatTime(new Date(j.started_at))} → {j.stopped_at ? formatTime(new Date(j.stopped_at)) : "…"}
              </span>
            </div>
          ))}
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
            {/* A waived bill reads as the words, not as a zero. "0" on a
                receipt line is ambiguous — it could be a session nobody played.
                The full phrase goes here rather than the short pill used above:
                "Free" beside a number column reads as a currency abbreviation,
                and "Free session" cannot. */}
            <span>{session.is_free ? t("session.freeBill") : money(total)}</span>
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

/**
 * Who did what, newest first.
 *
 * The session rows above say what is TRUE about each session; this says how it
 * got that way and who decided. An owner asking "why was that one free" has no
 * other place to look — the session row carries the outcome, not the author.
 *
 * Deliberately not merged into the rows: the actions of a busy evening are a
 * timeline, and splitting one across twenty collapsed cards is how a timeline
 * stops reading like one.
 */
const ActionsLog = ({ events }: { events: ISessionEvent[] }) => {
  const { t, money } = useLang();

  return (
    <div className="col" style={{ gap: 8, marginTop: 18 }}>
      <h3 className="page-title" style={{ margin: 0, fontSize: 16 }}>{t("history.actions")}</h3>
      {events.length === 0 ? (
        <div className="muted">{t("history.actionsEmpty")}</div>
      ) : (
        <div className="col" style={{ gap: 4 }}>
          {events.map((e) => (
            <div key={e.id} className="row-between card" style={{ fontSize: 13, padding: "6px 10px" }}>
              <span className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "baseline" }}>
                <span>{t(`history.action.${e.action}`) || e.action}</span>
                {/* The account may since have been deleted; the fact still
                    happened, so a nameless line is shown rather than hidden. */}
                {e.user && <span className="muted">· {e.user.name}</span>}
                {(e.pc_label || e.place_name) && (
                  <span className="muted">· {e.place_name || e.pc_label}</span>
                )}
              </span>
              <span className="row" style={{ gap: 8, alignItems: "baseline" }}>
                {e.amount !== null && <span>{money(e.amount)}</span>}
                <span className="muted" style={{ fontSize: 12 }}>{formatDateTime(new Date(e.created_at))}</span>
              </span>
            </div>
          ))}
        </div>
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
