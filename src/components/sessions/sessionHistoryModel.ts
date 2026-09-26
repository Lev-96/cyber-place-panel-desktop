import { ISessionEvent } from "@/api/sessions";
import { formatTime } from "@/i18n/dates";
import { ISessionApi } from "@/types/sessions";

/**
 * How the Sessions → History screen reads a session's audit log
 * (2026-09-26: moved out of the route so the card's timeline and the tests
 * share one reading). Pure: every figure is the server's, formatted here and
 * never recomputed.
 */

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
 * WHAT changed, under the name of the action that changed it — one fact per
 * entry, so the timeline can put each on its own line.
 *
 * Nothing is computed here that the server did not state. The one derived
 * value is the time played before a move, and both of its terms are server
 * timestamps. An old row with no meta gives no entries and renders as the
 * plain action it always was.
 *
 * Dependency-injected so it can be checked without rendering the route.
 */
export const eventDetailParts = (
  e: ISessionEvent,
  t: (k: string) => string,
  money: (n: number) => string,
): string[] => {
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

      // «Переместить игрока»: the price on each side, as the server wrote it.
      if (metaStr(meta, "reason") === "relocation") {
        const before = metaNum(meta, "rate_before");
        const after = metaNum(meta, "rate_after");
        const perHour = ` / ${t("time.hourShort")}`;
        if (before !== null && after !== null && before !== after) {
          parts.push(`${money(before)}${perHour} -> ${money(after)}${perHour}`);
        } else if (after !== null) {
          parts.push(`${money(after)}${perHour}`);
        }
        if (meta !== null && (meta as Record<string, unknown>).rate_overridden === true) {
          parts.push(t("history.rateSetByHand"));
        }
        const limitedUntil = metaStr(meta, "limited_until");
        if (limitedUntil !== null) parts.push(`${t("history.untilLabel")} ${formatTime(new Date(limitedUntil))}`);
      }
      break;
    }

    case "time_added": {
      const minutes = metaNum(meta, "minutes");
      if (minutes !== null) parts.push(`+${minutes} ${t("time.minShort")}`);
      const newEnd = metaStr(meta, "new_ends_at");
      if (newEnd !== null) parts.push(`${t("history.untilLabel")} ${formatTime(new Date(newEnd))}`);
      break;
    }

    case "resumed": {
      // How long the player was away, and where the end moved to — the
      // server's own figures, written in the resume's transaction.
      // Resumed by the SERVER at the branch's pause limit — nobody pressed it.
      if (metaStr(meta, "reason") === "pause_limit") parts.push(t("history.pauseLimitReason"));
      const seconds = metaNum(meta, "paused_seconds");
      if (seconds !== null) parts.push(`${t("history.pausedFor")}: ${durationLabel(seconds / 60, t)}`);
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
      // Each product on its own line, with the quantity the server wrote, so a
      // disputed line can be found without opening the bill.
      const lines = Array.isArray(meta?.lines) ? meta.lines : [];
      for (const l of lines) {
        if (l === null || typeof l !== "object") continue;
        const { name, qty } = l as { name?: unknown; qty?: unknown };
        if (typeof name !== "string" || name.trim() === "") continue;
        parts.push(typeof qty === "number" && qty > 0 ? `${name} × ${qty}` : name);
      }
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
      break;
  }

  return parts;
};

/** The colour family a timeline marker takes — what KIND of thing happened. */
export type EventTone = "start" | "stop" | "pause" | "resume" | "auto" | "move" | "charge" | "neutral" | "refused";

/**
 * Every action the server writes (`App\Enums\SessionAction`), and how its
 * marker reads. A table rather than a branch per action: a new action is one
 * line here, and one the panel has never heard of still renders (below).
 */
const ACTION_LOOK: Record<string, { tone: EventTone; icon: string }> = {
  started: { tone: "start", icon: "▶" },
  stopped: { tone: "stop", icon: "■" },
  paused: { tone: "pause", icon: "❚❚" },
  resumed: { tone: "resume", icon: "▶" },
  moved: { tone: "move", icon: "⇄" },
  item_added: { tone: "charge", icon: "+" },
  item_removed: { tone: "neutral", icon: "−" },
  item_returned: { tone: "neutral", icon: "↩" },
  joystick_added: { tone: "charge", icon: "+" },
  joystick_removed: { tone: "neutral", icon: "−" },
  time_added: { tone: "charge", icon: "+" },
  made_unlimited: { tone: "neutral", icon: "∞" },
  free_enabled: { tone: "neutral", icon: "0" },
  free_disabled: { tone: "neutral", icon: "֏" },
  time_add_refused: { tone: "refused", icon: "!" },
  move_failed: { tone: "refused", icon: "!" },
};

export interface EventPresentation {
  title: string;
  tone: EventTone;
  icon: string;
  /** Who did it — a person, «Automatically» for the server, or null when unknown. */
  actor: string | null;
  /** What changed, one fact per entry. */
  details: string[];
}

/** "some_new_action" → "Some new action": readable without a translation. */
const humanize = (action: string): string => {
  const words = action.replace(/_/g, " ").trim();
  return words === "" ? "?" : words[0].toUpperCase() + words.slice(1);
};

/**
 * How one event reads on the timeline.
 *
 * ⚠️ A resume the SERVER made at the pause limit is its own entry — its own
 * title, colour and «Automatically» for the actor — so it can never pass for a
 * cashier's press. An action this build does not know renders with a readable
 * name and whatever plain values its meta carries: never an error, never a gap.
 */
export const eventPresentation = (
  e: ISessionEvent,
  t: (k: string) => string,
  money: (n: number) => string,
): EventPresentation => {
  const known = ACTION_LOOK[e.action];
  const details = eventDetailParts(e, t, money);

  if (e.action === "resumed" && metaStr(e.meta, "reason") === "pause_limit") {
    return {
      title: t("history.autoResumeTitle"),
      tone: "auto",
      icon: "⟳",
      actor: e.user?.name ?? t("history.endedAutomatically"),
      details,
    };
  }

  if (known === undefined) {
    const plain = Object.entries(e.meta ?? {})
      .filter(([, v]) => typeof v === "string" || typeof v === "number" || typeof v === "boolean")
      .map(([k, v]) => `${humanize(k)}: ${String(v)}`);
    return {
      title: t(`history.action.${e.action}`) || humanize(e.action),
      tone: "neutral",
      icon: "•",
      actor: e.user?.name ?? null,
      details: plain,
    };
  }

  return {
    title: t(`history.action.${e.action}`) || humanize(e.action),
    tone: known.tone,
    icon: known.icon,
    actor: e.user?.name ?? null,
    details,
  };
};

/** Above this many events a card folds its middle away. */
export const HISTORY_FOLD_ABOVE = 7;
const FOLD_HEAD = 3;
const FOLD_TAIL = 2;

/**
 * Which events a folded card shows: the first few (how it began) and the last
 * few (how it ended, with the bill), the middle behind one button. Up to
 * `HISTORY_FOLD_ABOVE` nothing folds — hiding one or two lines behind a
 * button costs more than it saves.
 */
export const foldedIndexes = (count: number): { shown: Set<number>; hidden: number } => {
  if (count <= HISTORY_FOLD_ABOVE) return { shown: new Set(Array.from({ length: count }, (_, i) => i)), hidden: 0 };
  const shown = new Set<number>();
  for (let i = 0; i < FOLD_HEAD; i++) shown.add(i);
  for (let i = count - FOLD_TAIL; i < count; i++) shown.add(i);
  return { shown, hidden: count - FOLD_HEAD - FOLD_TAIL };
};

/** The branch feed, by session. */
export const groupBySession = (events: ISessionEvent[]): Map<number, ISessionEvent[]> => {
  const out = new Map<number, ISessionEvent[]>();
  for (const e of events) {
    const list = out.get(e.session_id);
    if (list) list.push(e);
    else out.set(e.session_id, [e]);
  }
  return out;
};

/**
 * Whether the branch feed already holds ALL of this session's events, so the
 * card needs no request of its own.
 *
 * The list is sessions STARTED in the range; the feed is events WRITTEN in the
 * range, newest first, up to `limit`. So a session's slice is whole when
 * nothing of it falls after the range (it ended by `to`, or is still running
 * while `to` is still ahead) and the feed was not cut short — or, if it was,
 * the cut came after this session's own start (its `started` is in the slice;
 * the feed is cut from the oldest end).
 */
export const feedCoversSession = (
  session: Pick<ISessionApi, "status" | "stopped_at" | "ends_at">,
  slice: ISessionEvent[],
  feed: { truncated: boolean; to: string; now: number },
): boolean => {
  const to = new Date(feed.to).getTime();
  const closed = session.status === "stopped" || session.status === "expired";
  const lastAt = closed ? session.stopped_at ?? session.ends_at : null;
  const endsInside = closed
    ? lastAt !== null && new Date(lastAt).getTime() <= to
    : feed.now <= to;
  if (!endsInside) return false;
  return !feed.truncated || slice.some((e) => e.action === "started");
};
