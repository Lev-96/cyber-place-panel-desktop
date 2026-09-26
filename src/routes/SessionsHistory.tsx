import { preciseWhenSmall } from "@/i18n/currency";
import ScreenWithBg from "@/components/ui/ScreenWithBg";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { useAsync } from "@/hooks/useAsync";
import { useSessionsSummary } from "@/hooks/useSessionsSummary";
import { formatDate, formatDateTime, formatTime } from "@/i18n/dates";
import { useLang } from "@/i18n/LanguageContext";
import { padChargeOf } from "@/components/sessions/joystickView";
import { sessionItemLineTotal } from "@/components/sessions/sessionAmount";
import SessionHistoryTimeline from "@/components/sessions/SessionHistoryTimeline";
import { feedCoversSession, groupBySession, paymentLabelOf, segmentsOf } from "@/components/sessions/sessionHistoryModel";
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

  // Who did what, for every card at once: ONE request for the whole range,
  // split by session below, rather than one per card. A card whose slice the
  // feed cannot vouch for fetches its own (see `SessionRow`).
  const events = useAsync(
    () => sessionRepository.listEvents({ branch_id: id, from: fromIso, to: toIso, limit: FEED_LIMIT }),
    [id, fromIso, toIso],
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
            <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
              <button type="button" className="pill" onClick={() => setRange("today")}>{t("history.today")}</button>
              <button type="button" className="pill" onClick={() => setRange("yesterday")}>{t("history.yesterday")}</button>
              <button type="button" className="pill" onClick={() => setRange("month")}>{t("history.month")}</button>
              {/* Both: the cards read their events from the feed, so a refresh
                  of the sessions alone would show a new stop with an old story. */}
              <button type="button" className="pill" onClick={() => { void reload(); void events.reload(); }}>
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

      {!loading && !error && (
        <SessionsList
          sessions={data ?? []}
          feed={events.loading ? null : { ...feed, to: toIso }}
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

const SessionsList = ({ sessions, feed }: { sessions: ISessionApi[]; feed: Feed | null }) => {
  const { t } = useLang();
  if (sessions.length === 0) return <div className="muted">{t("history.empty")}</div>;
  const now = Date.now();
  return (
    <div className="col" style={{ gap: 8 }}>
      {sessions.map((s) => {
        const slice = feed?.bySession.get(s.id) ?? [];
        const covered = feed !== null && feedCoversSession(s, slice, { truncated: feed.truncated, to: feed.to, now });
        return <SessionRow key={s.id} session={s} feedEvents={feed === null ? null : slice} covered={covered} />;
      })}
    </div>
  );
};

/**
 * The card's events: the feed's slice when it is whole, else the session's own
 * list — fetched only once the card comes near the screen, so a month of old
 * sessions is not a burst of requests on load. Null while not known yet.
 */
const useCardEvents = (sessionId: number, feedEvents: ISessionEvent[] | null, covered: boolean) => {
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
    (): Promise<ISessionEvent[] | null> => (needOwn && near ? sessionRepository.eventsForSession(sessionId) : Promise.resolve(null)),
    [needOwn, near, sessionId],
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

const SessionRow = ({ session, feedEvents, covered }: {
  session: ISessionApi;
  feedEvents: ISessionEvent[] | null;
  covered: boolean;
}) => {
  const { t, money } = useLang();
  const { ref, events } = useCardEvents(session.id, feedEvents, covered);
  const durationMin = sessionDurationMinutes(session.started_at, session.ends_at);
  const items = session.items ?? [];
  const itemsTotal = items.reduce((sum, it) => sum + sessionItemLineTotal(it), 0);
  /**
   * What the extra pads put on this bill.
   *
   * Same shape and same rule as the tile on the board: charged pads only, and
   * a unit price only when every one of them agrees on it. Null on a waived
   * seat and when nothing was charged, because a fee printed under "Free
   * session" is two numbers telling one truth.
   */
  const padCharge = padChargeOf(session);

  const paymentLabel = paymentLabelOf(session, t);

  const total = num(session.total_paid);
  // What the CLOCK earned: the bill less everything that is not the clock.
  //
  // Joysticks used to be left in, so a seat that sold two pads at 500 showed
  // 1000 of them as "time" and the line disagreed with the pad line printed
  // directly beneath it. Subtracted from the same figure the pad line quotes,
  // so the two cannot drift.
  const padTotal = padCharge?.total ?? 0;
  const timeCost = Math.max(0, total - itemsTotal - padTotal);
  const isClosed = session.status === "stopped" || session.status === "expired";
  const statusLabel = t(`history.status.${session.status}`) || session.status;
  const modeLabel = session.mode === "open" ? t("history.modeOpen") : t("history.modeFixed");
  // The seats it was played on, in order — from the events, which froze each
  // seat when it was written. Only worth a line when there was a move.
  const seats = events === null ? [] : segmentsOf(events).map((seg) => seg.seat ?? t("history.seatUnknown"));
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

      {/* How much — the bill, as the board and the receipt compute it. */}
      <div className="hs-summary">
      {/* ⚠️ What the pads COST, not how long each was plugged in.
          This used to print one line per pad over the interval it was in play
          — "Joystick #3, 15:00 → 15:01". A pad is billed at a flat fee now, so
          an interval says nothing about the money and quietly suggests the pad
          is priced by the minute. Three of them a minute apart read as a fault
          rather than as three sales.
          The count is of CHARGED pads and the total is `sessionJoysticksTotal`
          — the same figure the receipt and the board use, so no third opinion
          about the bill can appear here. A unit price is printed only when all
          of them agree on one: the fee is frozen when a pad goes out, so a
          session that straddles a re-pricing holds two, and "3 × ?" would be a
          lie where the sum is always true. */}
      {padCharge !== null && (
        <div className="row-between" style={{ fontSize: 12 }}>
          <span className="muted">{t("history.joystickCharged")}</span>
          <span className="muted">
            {/* The unit figure is suffixed when it is a RATE, so a finished
                session can still be read a month later without guessing which
                strategy priced it. "2 × 500 = 1000" and "2 × 500/h = 250" are
                different facts and used to print identically. */}
            {/* Named, not multiplied. "2 × 500" is a count times a unit price
                and reads as nonsense beside numbers that are slot identities;
                "Joystick #3, 4 · 500/h = 250" is the same money, said about
                the controllers it was actually for. */}
            {t("session.joystickSlot").replace("{0}", padCharge.slots.join(", "))}
            {padCharge.each !== null
              ? ` · ${money(padCharge.each)}${padCharge.hourly ? t("session.perHourShort") : ""}`
                + ` = ${money(padCharge.total, preciseWhenSmall(padCharge.total))}`
              : ` · ${money(padCharge.total, preciseWhenSmall(padCharge.total))}`}
          </span>
        </div>
      )}

      {items.length > 0 && (
        <div className="col" style={{ gap: 2, marginTop: 4 }}>
          {items.map((it) => (
            <div key={it.id} className="row-between" style={{ fontSize: 13 }}>
              <span>{it.name} {num(it.qty) > 1 && <span className="muted">× {num(it.qty)}</span>}</span>
              <span>{money(sessionItemLineTotal(it))}</span>
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
          {/* ⚠️ How the money was taken, between the cost and the total, and
              the VALUE is the bold half. An owner reconciling a day scans for
              "was this cash or card", not for the words "payment method" —
              emphasising the label would put the weight on the part they
              already know. Omitted entirely when nothing was recorded: every
              session stopped before this existed has no method, and inventing
              one would be worse than the gap. */}
          {paymentLabel !== null && (
            <div className="row-between" style={{ fontSize: 13 }}>
              <span className="muted">{t("session.payTitle")}</span>
              <strong>{paymentLabel}</strong>
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

      {/* What happened — every event of the session, once. */}
      <SessionHistoryTimeline events={events} startedAt={session.started_at} />
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
