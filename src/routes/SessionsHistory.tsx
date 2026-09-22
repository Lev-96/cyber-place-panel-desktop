import { preciseWhenSmall } from "@/i18n/currency";
import ScreenWithBg from "@/components/ui/ScreenWithBg";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { useAsync } from "@/hooks/useAsync";
import { useSessionsSummary } from "@/hooks/useSessionsSummary";
import { formatDateTime, formatTime } from "@/i18n/dates";
import { useLang } from "@/i18n/LanguageContext";
import { padChargeOf } from "@/components/sessions/joystickView";
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
            value={[session.branch.company_name, session.branch.address].filter(Boolean).join(", ")}
            by={null}
            byLabel=""
          />
        )}
      </div>

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

      <SessionTimeline sessionId={session.id} />
    </div>
  );
};

/**
 * One session's own path, seat by seat.
 *
 * ⚠️ Collapsed by default and fetched only when opened. The list above can hold
 * a whole evening's sessions, and asking the server for every one of their
 * timelines to render a summary card nobody has asked to expand is a page that
 * takes seconds to load for a question nobody asked.
 *
 * Separate from the branch-wide feed at the bottom of the page: that one
 * interleaves every session in the venue and cannot be cut by seat, because
 * consecutive lines in it belong to different players.
 */
const SessionTimeline = ({ sessionId }: { sessionId: number }) => {
  const { t, money } = useLang();
  const [open, setOpen] = useState(false);
  const events = useAsync(
    (): Promise<ISessionEvent[]> =>
      open ? sessionRepository.eventsForSession(sessionId) : Promise.resolve([]),
    [open, sessionId],
  );

  const segments = useMemo(() => segmentsOf(events.data ?? []), [events.data]);

  return (
    <div className="col" style={{ gap: 6, marginTop: 6 }}>
      <button
        type="button"
        className="muted"
        onClick={() => setOpen((v) => !v)}
        style={{
          alignSelf: "flex-start",
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          fontSize: 12,
          textDecoration: "underline",
        }}
      >
        {open ? t("history.timelineHide") : t("history.timelineShow")}
      </button>

      {open && events.loading && <span className="muted" style={{ fontSize: 12 }}>…</span>}

      {open && !events.loading && segments.length === 0 && (
        <span className="muted" style={{ fontSize: 12 }}>{t("history.actionsEmpty")}</span>
      )}

      {open &&
        segments.map((seg, i) => (
          <div
            key={`${seg.seat ?? "?"}-${i}`}
            className="col"
            style={{
              gap: 3,
              paddingLeft: 10,
              borderLeft: "2px solid var(--color-border)",
            }}
          >
            {/* The seat this stretch was played on. A session that never moved
                has exactly one of these, which is why it is a quiet line
                rather than a heading. */}
            <span style={{ fontSize: 12, fontWeight: 600 }}>
              {seg.seat ?? t("history.seatUnknown")}
            </span>
            {seg.events.map((e) => {
              const detail = eventDetail(e, t, money);
              return (
                <div key={e.id} className="col" style={{ gap: 1, fontSize: 12 }}>
                  <div className="row" style={{ gap: 6, flexWrap: "wrap", alignItems: "baseline" }}>
                    <span className="muted">{formatTime(new Date(e.created_at))}</span>
                    <span>{t(`history.action.${e.action}`) || e.action}</span>
                    {e.user && <span className="muted">· {e.user.name}</span>}
                    {e.amount !== null && <span className="muted">· {money(e.amount)}</span>}
                  </div>
                  {detail !== null && (
                    <span className="muted" style={{ paddingLeft: 2 }}>{detail}</span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
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
/** "1 h 20 min", or "45 min" when it is under the hour. */
const durationLabel = (minutes: number, t: (k: string) => string): string => {
  const whole = Math.max(0, Math.round(minutes));
  const h = Math.floor(whole / 60);
  const m = whole % 60;
  return h > 0 ? `${h} ${t("time.hourShort")} ${m} ${t("time.minShort")}` : `${m} ${t("time.minShort")}`;
};

const metaNum = (meta: Record<string, unknown> | null, key: string): number | null => {
  const raw = meta?.[key];
  if (typeof raw === "number") return raw;
  if (typeof raw === "string" && raw.trim() !== "" && Number.isFinite(Number(raw))) return Number(raw);
  return null;
};
const metaStr = (meta: Record<string, unknown> | null, key: string): string | null => {
  const raw = meta?.[key];
  return typeof raw === "string" && raw.trim() !== "" ? raw : null;
};

/**
 * The seat a line was written on, NOT the seat the session ended up at.
 *
 * ⚠️ `place_name` / `pc_label` on the row are resolved by walking the session's
 * CURRENT device, so after a move every line it ever wrote claims the new
 * seat — including the ones that plainly did not happen there. The audit
 * logger freezes `place_number` in `meta` at write time; that is the one to
 * trust. The row's own fields survive only as the fallback for lines written
 * before it did.
 */
export const eventSeat = (e: ISessionEvent): string | null => {
  const frozen = metaNum(e.meta, "place_number");
  if (frozen !== null) return `№${frozen}`;

  const name = metaStr(e.meta, "place_name");
  if (name !== null) return name;

  return e.place_name || e.pc_label || null;
};

/**
 * The words to print for how a session was settled, or null.
 *
 * ⚠️ `other` prints what the cashier TYPED, never the word "other" — the whole
 * point of the free text is that "Idram" is the answer the owner is looking
 * for, and "Другой способ" tells them nothing they did not already know.
 *
 * Null means "not recorded", which is every session stopped before this was
 * kept and every session still running. The row is omitted entirely for it: a
 * bold empty gap under "Payment method" reads as a fault rather than as
 * silence. A method of `other` with nothing typed cannot be created (the
 * server refuses it) and is folded into the same null for the same reason.
 */
/** What a finished session's charged pads cost, and how that figure is quoted. */
export const paymentLabelOf = (
  session: Pick<ISessionApi, "payment_method" | "payment_method_other">,
  t: (k: string) => string,
): string | null => {
  const method = session.payment_method;
  if (!method) return null;

  if (method === "other") {
    const typed = (session.payment_method_other ?? "").trim();
    return typed === "" ? null : typed;
  }

  return t(method === "cash" ? "session.payCash" : "session.payCard");
};

/** One stretch of an evening spent on ONE seat. */
export interface HistorySegment {
  /** "№2", or null when nothing in the segment says where it was. */
  seat: string | null;
  /** The lines that happened there, oldest first. */
  events: ISessionEvent[];
}

/**
 * One session's timeline, cut into the seats it was played on.
 *
 * ⚠️ A move is NOT a new session. The player keeps their clock, their bill,
 * their products and their pads; only the seat changes. So the timeline is one
 * list that changes seat partway, and a segment is a reading aid rather than a
 * record of its own — nothing here invents an entity the server does not have.
 *
 * The move itself closes the segment it happened in. It was performed on the
 * seat being left, which is where a reader looks for it.
 *
 * Ordering is by the server's `created_at`, ascending: a timeline reads
 * downwards. Never by array position — the feed's order is the API's business
 * and has changed before.
 */
export const segmentsOf = (events: ISessionEvent[]): HistorySegment[] => {
  const ordered = [...events].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  const segments: HistorySegment[] = [];
  let current: HistorySegment | null = null;

  for (const e of ordered) {
    if (current === null) current = { seat: eventSeat(e), events: [] };
    // A segment that started before anything named a seat takes the first name
    // it is given, rather than staying anonymous for the whole stretch.
    if (current.seat === null) current.seat = eventSeat(e);

    current.events.push(e);

    if (e.action === "moved") {
      segments.push(current);
      const to = metaNum(e.meta, "to_place_number");
      current = { seat: to !== null ? `№${to}` : null, events: [] };
    }
  }

  if (current !== null && current.events.length > 0) segments.push(current);

  return segments;
};

/**
 * WHAT changed, under the name of the action that changed it.
 *
 * Exported and dependency-injected so it can be checked without rendering the
 * route, the way `shouldShowBookingsFeed` is in `Notifications.tsx`.
 */
export const eventDetail = (
  e: ISessionEvent,
  t: (k: string) => string,
  money: (n: number) => string,
): string | null => {
  const meta = e.meta;
  const parts: string[] = [];

  switch (e.action) {
    case "moved": {
      const from = metaNum(meta, "from_place_number");
      const to = metaNum(meta, "to_place_number");
      if (from !== null && to !== null) parts.push(`№${from} -> №${to}`);

      // ⚠️ The SERVER's figure first. It is computed inside the same
      // transaction as the move, from the session's own start against the
      // move's own instant. The subtraction below is the fallback for rows
      // written before that field existed — an old line must still read.
      const playedMinutes = metaNum(meta, "played_minutes_before");
      if (playedMinutes !== null) {
        parts.push(`${t("history.playedBeforeMove")}: ${durationLabel(playedMinutes, t)}`);
      } else {
        const startedAt = metaStr(meta, "session_started_at");
        if (startedAt !== null) {
          const playedMs = new Date(e.created_at).getTime() - new Date(startedAt).getTime();
          if (Number.isFinite(playedMs) && playedMs > 0) {
            parts.push(
              `${t("history.playedBeforeMove")}: ${durationLabel(playedMs / 60000, t)}`,
            );
          }
        }
      }

      // What the seat that was left had run up. Only the total: the split into
      // products and pads is detail for the row's own block, not for a line
      // that has to read at a glance.
      const totalBefore = metaNum(meta, "total_before");
      if (totalBefore !== null) {
        parts.push(`${t("history.totalBeforeMove")}: ${money(totalBefore)}`);
      }
      const granted = metaNum(meta, "requested_minutes");
      if (granted !== null && granted > 0) parts.push(`+${granted} ${t("time.minShort")}`);
      break;
    }

    case "time_added": {
      const minutes = metaNum(meta, "minutes");
      if (minutes !== null) parts.push(`+${minutes} ${t("time.minShort")}`);
      const newEnd = metaStr(meta, "new_ends_at");
      if (newEnd !== null) parts.push(`${t("history.untilLabel")} ${formatTime(new Date(newEnd))}`);
      break;
    }

    case "made_unlimited": {
      // ⚠️ Only when the server said what it was BEFORE. With no `old_mode` —
      // a row written before the key existed — the detail would be the word
      // "unlimited" under a line that already reads "Switched to unlimited",
      // which is a second line saying nothing.
      const oldMode = metaStr(meta, "old_mode");
      if (oldMode !== null) parts.push(`${oldMode} -> ${t("session.unlimited")}`);
      const rate = metaNum(meta, "hourly_rate");
      if (rate !== null && rate > 0) parts.push(`${money(rate)} / ${t("time.hourShort")}`);
      break;
    }

    case "joystick_added": {
      const after = metaNum(meta, "count_after");
      const price = metaNum(meta, "price");
      // WHICH strategy priced this pad, written on the event by the server.
      // Without it the line printed a per-hour RATE as a plain sum: "Price for
      // one: 500 AMD" on a pad that put about nothing on the bill at that
      // instant and would earn 500 only after a full hour.
      const hourly = meta !== null && (meta as Record<string, unknown>).hourly === true;
      // The count is the seat's TOTAL after the add, which is how the floor
      // counts pads: a PlayStation with one extra is "2 joysticks".
      if (after !== null) parts.push(`${t("history.padsNow")}: ${after}`);
      if (price !== null) {
        parts.push(`${t("history.padUnitPrice")}: ${money(price)}`
          + (hourly ? t("session.perHourShort") : ""));
      }
      break;
    }

    case "joystick_removed": {
      const after = metaNum(meta, "count_after");
      if (after !== null) parts.push(`${t("history.padsNow")}: ${after}`);
      // ⚠️ Spelled out, because it is the question the counter argues about.
      // Taking a pad out of play refunds nothing, and the amount on this line
      // is already 0 — saying so in words is what stops it reading as an
      // omission.
      parts.push(t("history.padNoRefund"));
      break;
    }

    case "item_added":
    case "item_removed":
    case "item_returned": {
      const count = metaNum(meta, "count");
      if (count !== null) parts.push(`${t("history.itemsCount")}: ${count}`);
      // The names, so a disputed line can be found without opening the bill.
      const lines = Array.isArray(meta?.lines) ? meta.lines : [];
      const named = lines
        .map((l) => (l !== null && typeof l === "object" ? (l as { name?: unknown }).name : null))
        .filter((n): n is string => typeof n === "string" && n.trim() !== "");
      if (named.length > 0) parts.push(named.join(", "));
      // ⚠️ Taking a product off the bill returns nothing, the same rule the
      // pads follow. The amount on the line is already 0; saying so is what
      // stops it reading as an omission.
      if (e.action === "item_removed") parts.push(t("history.noRefundShort"));
      // How long it was out, and that nothing came back over the counter —
      // the two things a returned pad's line already says.
      if (e.action === "item_returned") {
        const minutes = metaNum(meta, "minutes");
        if (minutes !== null) parts.push(`${minutes} ${t("time.minShort")}`);
        parts.push(t("history.noRefundShort"));
      }
      break;
    }

    case "time_add_refused": {
      const minutes = metaNum(meta, "minutes");
      if (minutes !== null) parts.push(`+${minutes} ${t("time.minShort")}`);
      // The reason in the vocabulary of the floor. The booking's own details
      // are not a cashier's business and are not shown.
      if (metaStr(meta, "reason") === "seat_unavailable") parts.push(t("history.seatBooked"));
      const max = metaNum(meta, "max_minutes");
      if (max !== null && max > 0) {
        parts.push(`${t("history.untilLabel")} +${max} ${t("time.minShort")}`);
      }
      break;
    }

    case "move_failed": {
      const from = metaNum(meta, "from_place_number");
      const minutes = metaNum(meta, "minutes");
      if (from !== null) parts.push(`№${from}`);
      if (minutes !== null) parts.push(`+${minutes} ${t("time.minShort")}`);
      if (metaStr(meta, "reason") === "target_taken") parts.push(t("history.seatTaken"));
      break;
    }

    default:
      return null;
  }

  return parts.length > 0 ? parts.join(" · ") : null;
};

const ActionsLog = ({ events }: { events: ISessionEvent[] }) => {
  const { t, money } = useLang();


  /**
   * WHAT changed, under the name of the action that changed it.
   *
   * ⚠️ The backend has always written this. `SessionAuditLogger` stores a
   * `meta` blob on every line — the seats a move went between, the minutes a
   * grant was worth, the fee a pad was charged at — and this log printed the
   * action's name and threw the rest away. An owner reading "Moved" learned
   * that something moved and nothing else, which is the whole reason the
   * history did not answer the questions asked of it.
   *
   * Nothing is computed here that the server did not state. The one derived
   * value is the time played before a move, and both of its terms are server
   * timestamps: the event's own `created_at` and the `session_started_at` the
   * move recorded.
   *
   * ⚠️ Returns null for an old row with no meta. Lines written before a key
   * existed must still render as the plain action they always were, never as
   * "undefined" or an empty block.
   */

  return (
    <div className="col" style={{ gap: 8, marginTop: 18 }}>
      <h3 className="page-title" style={{ margin: 0, fontSize: 16 }}>{t("history.actions")}</h3>
      {events.length === 0 ? (
        <div className="muted">{t("history.actionsEmpty")}</div>
      ) : (
        <div className="col" style={{ gap: 4 }}>
          {events.map((e) => {
            const detail = eventDetail(e, t, money);
            const seat = eventSeat(e);
            return (
              <div key={e.id} className="card" style={{ fontSize: 13, padding: "6px 10px" }}>
                <div className="row-between">
                  <span className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "baseline" }}>
                    <span>{t(`history.action.${e.action}`) || e.action}</span>
                    {/* The account may since have been deleted; the fact still
                        happened, so a nameless line is shown rather than hidden. */}
                    {e.user && <span className="muted">· {e.user.name}</span>}
                    {seat !== null && <span className="muted">· {seat}</span>}
                  </span>
                  <span className="row" style={{ gap: 8, alignItems: "baseline" }}>
                    {e.amount !== null && <span>{money(e.amount)}</span>}
                    <span className="muted" style={{ fontSize: 12 }}>{formatDateTime(new Date(e.created_at))}</span>
                  </span>
                </div>
                {/* Its own row, and only when there is something to say. An old
                    line with no meta renders exactly as it always did. */}
                {detail !== null && (
                  <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{detail}</div>
                )}
              </div>
            );
          })}
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
