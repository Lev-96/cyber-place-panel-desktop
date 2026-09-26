import ScreenWithBg from "@/components/ui/ScreenWithBg";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { useAsync } from "@/hooks/useAsync";
import { useSessionsSummary } from "@/hooks/useSessionsSummary";
import { formatDate, formatDateTime, formatTime } from "@/i18n/dates";
import { useLang } from "@/i18n/LanguageContext";
import SessionHistoryBill from "@/components/sessions/SessionHistoryBill";
import SessionHistoryTimeline from "@/components/sessions/SessionHistoryTimeline";
import { feedCoversSession, groupBySession, seatRoute, seatSteps } from "@/components/sessions/sessionHistoryModel";
import { sessionRepository } from "@/repositories/SessionRepository";
import { ISessionEvent } from "@/api/sessions";
import { ISessionApi } from "@/types/sessions";
import { useEffect, useMemo, useRef, useState } from "react";
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

/**
 * The branch's events for the range, in one request. The server's own cap: a
 * range with more is cut from the oldest end, and the cards it cut fetch their
 * own (`feedCoversSession`).
 */
const FEED_LIMIT = 1000;

const SessionsHistory = () => {
  const { branchId } = useParams();
  const id = Number(branchId);
  const { t, money } = useLang();

  const today = useMemo(() => toDateInput(new Date()), []);
  const [from, setFrom] = useState<string>(today);
  const [to, setTo] = useState<string>(today);

  const fromIso = useMemo(() => toLocalBoundary(from, "start"), [from]);
  const toIso = useMemo(() => toLocalBoundary(to, "end"), [to]);

  /**
   * Whose actions to show — null for everyone. Remembered WITH its branch, so
   * opening another branch starts from «everyone» without an effect to reset
   * it: a person picked in one venue means nothing in the next.
   */
  const [actor, setActor] = useState<{ branch: number; id: number } | null>(null);
  const actorId = actor !== null && actor.branch === id ? actor.id : null;

  // The people this branch's log may hold — the server's list, scoped to the caller.
  const actors = useAsync(() => sessionRepository.listEventActors(id), [id]);

  const { data, loading, error, reload } = useAsync(
    () => sessionRepository.list({ branch_id: id, from: fromIso, to: toIso, limit: 1000 }),
    [id, fromIso, toIso],
  );

  const summary = useSessionsSummary(data);

  /**
   * With a person picked, the cards are the sessions THEY acted in — asked of
   * the server, which answers that branch-wide (for a manager too: every
   * session their owner touched in their branch, not only their own shifts).
   * The stat tiles above keep the day's totals from the list as it always was.
   */
  const acted = useAsync(
    () => (actorId === null
      ? Promise.resolve(null)
      : sessionRepository.list({ branch_id: id, from: fromIso, to: toIso, limit: 1000, acted_by: actorId })),
    [id, fromIso, toIso, actorId],
  );

  // Who did what, for every card at once: ONE request for the whole range,
  // split by session below, rather than one per card. A card whose slice the
  // feed cannot vouch for fetches its own (see `SessionRow`). With a person
  // picked the SERVER narrows it — the filter never pulls the whole log to
  // sift it here.
  const events = useAsync(
    () => sessionRepository.listEvents({
      branch_id: id, from: fromIso, to: toIso, limit: FEED_LIMIT,
      ...(actorId !== null ? { user_id: actorId } : {}),
    }),
    [id, fromIso, toIso, actorId],
  );
  const feed = useMemo(() => ({
    bySession: groupBySession(events.data ?? []),
    truncated: (events.data?.length ?? 0) >= FEED_LIMIT,
  }), [events.data]);

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
            {/* Whose actions. A native select: keyboard, screen reader and
                Escape behave as everywhere else in the panel. «All» is the
                screen as it always was. */}
            <label className="col" style={{ gap: 4 }}>
              <span className="label">{t("history.actorLabel")}</span>
              <select
                className="input"
                value={actorId ?? ""}
                onChange={(e) => setActor(e.target.value === "" ? null : { branch: id, id: Number(e.target.value) })}
              >
                <option value="">{t("history.actorAll")}</option>
                {(actors.data ?? []).map((a) => (
                  <option key={a.id} value={a.id}>{a.name} · {t(`role.${a.role}`) || a.role}</option>
                ))}
              </select>
            </label>
            <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
              <button type="button" className="pill" onClick={() => setRange("today")}>{t("history.today")}</button>
              <button type="button" className="pill" onClick={() => setRange("yesterday")}>{t("history.yesterday")}</button>
              <button type="button" className="pill" onClick={() => setRange("month")}>{t("history.month")}</button>
              {/* Both: the cards read their events from the feed, so a refresh
                  of the sessions alone would show a new stop with an old story. */}
              <button type="button" className="pill" onClick={() => { void reload(); void events.reload(); void acted.reload(); }}>
                {t("action.refresh")}
              </button>
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

      {/* A new person's feed is loading: a skeleton, never the previous
          person's cards under the new name. */}
      {!loading && !error && actorId !== null && (events.loading || acted.loading) && <ListSkeleton />}
      {!loading && !error && !(actorId !== null && (events.loading || acted.loading)) && (
        <SessionsList
          sessions={actorId === null ? data ?? [] : acted.data ?? []}
          feed={events.loading ? null : { ...feed, to: toIso }}
          actorId={actorId}
        />
      )}
    </ScreenWithBg>
  );
};

interface Feed {
  bySession: Map<number, ISessionEvent[]>;
  truncated: boolean;
  /** The range's end, as sent. */
  to: string;
}

const SessionsList = ({ sessions, feed, actorId }: { sessions: ISessionApi[]; feed: Feed | null; actorId: number | null }) => {
  const { t } = useLang();
  if (sessions.length === 0) return <div className="muted">{t("history.empty")}</div>;
  const now = Date.now();
  const cards = sessions.map((s) => {
    const slice = feed?.bySession.get(s.id) ?? [];
    const covered = feed !== null && feedCoversSession(s, slice, { truncated: feed.truncated, to: feed.to, now });
    return { s, slice, covered };
  })
    // With a person picked, a card is there because they did something in it.
    // One the feed cannot vouch for stays, fetches its own and shows only
    // their lines (or nothing, see `SessionRow`).
    .filter(({ slice, covered }) => actorId === null || feed === null || slice.length > 0 || !covered);

  if (cards.length === 0) return <div className="muted">{t("history.noActions")}</div>;
  return (
    <div className="col hs-list">
      {cards.map(({ s, slice, covered }) => (
        <SessionRow key={s.id} session={s} feedEvents={feed === null ? null : slice} covered={covered} actorId={actorId} />
      ))}
    </div>
  );
};

/**
 * The card's events: the feed's slice when it is whole, else the session's own
 * list — fetched only once the card comes near the screen, so a month of old
 * sessions is not a burst of requests on load. Null while not known yet.
 */
const useCardEvents = (sessionId: number, feedEvents: ISessionEvent[] | null, covered: boolean, actorId: number | null) => {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const needOwn = feedEvents !== null && !covered;

  useEffect(() => {
    if (!needOwn || near) return;
    const el = ref.current;
    if (el === null || typeof IntersectionObserver === "undefined") {
      setNear(true);
      return;
    }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((x) => x.isIntersecting)) setNear(true);
    }, { rootMargin: "300px" });
    io.observe(el);
    return () => io.disconnect();
  }, [needOwn, near]);

  const own = useAsync(
    (): Promise<ISessionEvent[] | null> => (needOwn && near
      ? sessionRepository.eventsForSession(sessionId, actorId ?? undefined)
      : Promise.resolve(null)),
    [needOwn, near, sessionId, actorId],
  );

  return { ref, events: covered ? feedEvents : own.data };
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

const SessionRow = ({ session, feedEvents, covered, actorId }: {
  session: ISessionApi;
  feedEvents: ISessionEvent[] | null;
  covered: boolean;
  actorId: number | null;
}) => {
  const { t, money } = useLang();
  const { ref, events: loaded } = useCardEvents(session.id, feedEvents, covered, actorId);
  // Both lists are narrowed by the server when a person is picked; this is the
  // same rule again, so a backend that ignored the parameter could not put
  // someone else's line — or the system's, which has no author — on the card.
  const events = loaded === null || actorId === null ? loaded : loaded.filter((e) => e.user?.id === actorId);
  // Fetched on its own and nothing of theirs in it: not this person's card.
  // (After every hook, so the hook order never changes.)
  if (actorId !== null && events !== null && events.length === 0) return <div ref={ref} />;
  const durationMin = sessionDurationMinutes(session.started_at, session.ends_at);
  const isClosed = session.status === "stopped" || session.status === "expired";
  const statusLabel = t(`history.status.${session.status}`) || session.status;
  const modeLabel = session.mode === "open" ? t("history.modeOpen") : t("history.modeFixed");
  // The seats it was played on, in order — from the events, which froze each
  // seat when it was written. Only worth a line when there was a move, and
  // only from the whole story: one person's lines may skip a seat.
  const seats = events === null || actorId !== null
    ? []
    : seatRoute(seatSteps(events)).map((seat) => seat ?? t("history.seatUnknown"));
  const endAt = isClosed ? session.stopped_at ?? session.ends_at : null;

  return (
    <div ref={ref} className="card hs-card">
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

      {/* Who ran this seat, when, and where. Label above value, so a long
          branch address or name wraps inside its own cell instead of pushing
          the others around. An end on another day carries its date. */}
      <dl className="hs-facts">
        <div>
          <dt>{t("history.timeLabel")}</dt>
          <dd>
            {formatDate(session.started_at)}, {formatTime(session.started_at)}
            {endAt && ` – ${formatDate(endAt) === formatDate(session.started_at) ? formatTime(endAt) : formatDateTime(endAt)}`}
          </dd>
        </div>
        {seats.length > 1 && (
          <div>
            <dt>{t("history.seatsLabel")}</dt>
            <dd>{seats.join(" → ")}</dd>
          </div>
        )}
        {session.opened_by?.name && (
          <div>
            <dt>{t("history.startedBy")}</dt>
            <dd>{session.opened_by.name}</dd>
          </div>
        )}
        {isClosed && (
          <div>
            <dt>{t("history.endedBy")}</dt>
            {/* Null is the answer, not a gap: the kiosk agent expired this
                session when its paid time ran out and nobody pressed Stop. */}
            <dd>{session.stopped_by?.name ?? t("history.endedAutomatically")}</dd>
          </div>
        )}
        {session.branch && (
          <div>
            <dt>{t("history.branch")}</dt>
            <dd>{[session.branch.company_name, session.branch.address].filter(Boolean).join(", ")}</dd>
          </div>
        )}
      </dl>

      {/* What happened — every event of the session, once. */}
      <SessionHistoryTimeline events={events} startedAt={session.started_at} />

      {/* How much — after what happened, as its outcome. */}
      <SessionHistoryBill session={session} closed={isClosed} />
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
