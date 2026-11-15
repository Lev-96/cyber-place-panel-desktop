import { paymentText, type PaidPart } from "@/components/payments/paymentText";
import { ISessionEvent } from "@/api/sessions";
import { formatTime } from "@/i18n/dates";
import { fmt, hasTranslation } from "@/i18n/translations";
import { durationLabel as sharedDurationLabel } from "@/utils/durationLabel";
import { ISessionApi } from "@/types/sessions";
import { isOutsideFoodLine, sessionLineLabel } from "./outsideFood";

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

/** "2 h", "30 min", "1 h 15 min": the panel's shared reading of a length. */
const shortDuration = (minutes: number, t: (k: string) => string): string =>
  sharedDurationLabel(Math.max(0, Math.round(minutes)), t);

const metaNum = (meta: Record<string, unknown> | null, key: string): number | null => {
  const raw = meta?.[key];
  if (typeof raw === "number") return raw;
  if (typeof raw === "string" && raw.trim() !== "" && Number.isFinite(Number(raw))) return Number(raw);
  return null;
};
/** The parts of a payment as the audit line keeps them (`meta.payments`), well-formed ones only. */
const paidPartsOf = (meta: Record<string, unknown> | null): PaidPart[] => {
  const raw = meta?.payments;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((p) => {
    const m = (p as { method?: unknown }).method;
    const a = (p as { amount?: unknown }).amount;
    return (m === "cash" || m === "card" || m === "other" || m === "deposit") && (typeof a === "number" || typeof a === "string")
      ? [{ method: m, amount: a } as PaidPart] : [];
  });
};

const metaStr = (meta: Record<string, unknown> | null, key: string): string | null => {
  const raw = meta?.[key];
  return typeof raw === "string" && raw.trim() !== "" ? raw : null;
};

const metaTrue = (meta: Record<string, unknown> | null, key: string): boolean => meta?.[key] === true;

/** A positive figure from the meta, or null (absent, zero, unreadable). */
const metaPositive = (meta: Record<string, unknown> | null, key: string): number | null => {
  const n = metaNum(meta, key);
  return n !== null && n > 0 ? n : null;
};

/**
 * What an hour of the seat costs, as the server wrote it (`rate_now`,
 * 2026-11-15): "1500 AMD/h (seat 1000 AMD + joysticks 500 AMD)". The parts
 * only when something besides the seat bills by the hour. Null without it.
 */
const rateNowText = (meta: Record<string, unknown> | null, t: (k: string) => string, money: (n: number) => string): string | null => {
  const raw = meta?.rate_now;
  if (raw === null || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const total = metaNum(r, "total");
  if (total === null) return null;
  const seat = metaNum(r, "seat");
  const pads = metaPositive(r, "pads");
  const extras = metaPositive(r, "extras");
  const head = `${money(total)}${t("session.perHourShort")}`;
  if (pads === null && extras === null) return head;
  const parts = [
    seat !== null ? fmt(t("history.rateSeat"), money(seat)) : null,
    pads !== null ? fmt(t("history.ratePads"), money(pads)) : null,
    extras !== null ? fmt(t("history.rateExtras"), money(extras)) : null,
  ].filter((p): p is string => p !== null);
  return `${head} (${parts.join(" + ")})`;
};

/**
 * Paid ahead against the bill at the end (2026-11-15): "Paid ahead 2000 ·
 * Change 500", "· Due 500" or "· No change" — the server's three figures.
 */
const prepaidSettledText = (meta: Record<string, unknown> | null, t: (k: string) => string, money: (n: number) => string): string | null => {
  const prepaid = metaPositive(meta, "prepaid_amount");
  if (prepaid === null) return null;
  const change = metaPositive(meta, "change");
  if (change !== null) return fmt(t("history.prepaidChange"), money(prepaid), money(change));
  const due = metaPositive(meta, "due");
  if (due !== null) return fmt(t("history.prepaidDue"), money(prepaid), money(due));
  return fmt(t("history.prepaidExact"), money(prepaid));
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
  session: Pick<ISessionApi, "payment_method" | "payment_method_other" | "payments">,
  t: (k: string) => string,
  money: (n: number) => string = String,
): string | null => {
  const method = session.payment_method;
  // Paid in parts (2026-11-07): each part and how, from its lines.
  if (method === "split" || (session.payments?.length ?? 0) > 1) return paymentText(session, t, money);
  if (!method) return null;

  if (method === "other") {
    const typed = (session.payment_method_other ?? "").trim();
    return typed === "" ? null : typed;
  }

  return t(method === "cash" ? "session.payCash" : "session.payCard");
};

/** One event on the timeline, with the seat it happened on. */
export interface SeatStep {
  event: ISessionEvent;
  /** "№2", or null when nothing says where it was. */
  seat: string | null;
  /** True where the seat is worth naming: the first step, and every change. */
  chip: boolean;
}

/**
 * A session's events, oldest first, each with the seat it happened on
 * (2026-09-26: per event, replacing the per-move segments, so a list narrowed
 * to one person's actions — where the move itself may be somebody else's —
 * still says where each thing happened).
 *
 * ⚠️ A move is NOT a new session: the player keeps clock, bill, products and
 * pads; only the seat changes. The seat is the one frozen on the line
 * (`eventSeat`); a line written before seats were frozen takes the destination
 * of the move before it, and only then the row's own (current) seat.
 *
 * Ordering is by the server's `created_at`, never by array position — the
 * feed's order is the API's business and has changed before. Chips appear only
 * when the session was on more than one seat.
 */
export const seatSteps = (events: ISessionEvent[]): SeatStep[] => {
  const ordered = [...events].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  let afterMove: string | null = null;
  const seats = ordered.map((e) => {
    const frozen = metaNum(e.meta, "place_number");
    const seat = frozen !== null ? `№${frozen}` : afterMove ?? eventSeat(e);
    if (e.action === "moved") {
      const to = metaNum(e.meta, "to_place_number");
      afterMove = to !== null ? `№${to}` : null;
    }
    return seat;
  });

  const moved = new Set(seats).size > 1;
  return ordered.map((event, i) => ({
    event,
    seat: seats[i],
    chip: moved && (i === 0 || seats[i] !== seats[i - 1]),
  }));
};

/** The seats a session was played on, in order — "№9 → №14". */
export const seatRoute = (steps: SeatStep[]): (string | null)[] =>
  steps.filter((s) => s.chip).map((s) => s.seat);

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

    case "started": {
      // «На сумму» (2026-11-15): the sum and what it bought, first — it says
      // the length, so the plan's own "planned for" is not repeated under it.
      const byAmount = metaTrue(meta, "by_amount");
      if (byAmount) {
        const paid = metaNum(meta, "paid_amount");
        const seconds = metaNum(meta, "seconds");
        if (paid !== null && seconds !== null) {
          parts.push(fmt(t("history.byAmount"), money(paid), shortDuration(Math.ceil(seconds / 60), t)));
        }
        const fee = metaPositive(meta, "outside_food_fee");
        if (fee !== null) parts.push(fmt(t("history.byAmountFood"), money(fee)));
      }
      // A planned hourly start (2026-10-25): how long it was started for and
      // at what rate, as the server wrote it — the row's amount is the plan.
      // A start without a plan has none of these and prints nothing extra.
      const planned = metaNum(meta, "planned_minutes");
      if (planned !== null) {
        if (!byAmount) parts.push(`${t("history.plannedFor")} ${durationLabel(planned, t)}`);
        const rate = metaNum(meta, "hourly_rate");
        if (rate !== null) parts.push(`${money(rate)} / ${t("time.hourShort")}`);
        const end = new Date(new Date(e.created_at).getTime() + planned * 60_000);
        if (Number.isFinite(end.getTime())) parts.push(`${t("history.untilLabel")} ${formatTime(end)}`);
        // A total agreed at the counter, beside what the seat would have asked.
        if (meta !== null && (meta as Record<string, unknown>).price_set_by_hand === true) {
          const standard = metaNum(meta, "standard_amount");
          parts.push(standard !== null
            ? `${t("history.priceSetByHand")} (${t("session.plannedStandard")} ${money(standard)})`
            : t("history.priceSetByHand"));
        }
      }
      // Paid ahead with the «Оплачено вперёд» switch (by amount: the sum above IS it).
      const prepaid = metaPositive(meta, "prepaid_amount");
      if (prepaid !== null && !byAmount) parts.push(fmt(t("history.prepaidAhead"), money(prepaid)));
      break;
    }

    case "time_added": {
      const minutes = metaNum(meta, "minutes");
      if (minutes !== null) parts.push(`+${minutes} ${t("time.minShort")}`);
      const newEnd = metaStr(meta, "new_ends_at");
      if (newEnd !== null) parts.push(`${t("history.untilLabel")} ${formatTime(new Date(newEnd))}`);
      // A price agreed at the counter (2026-10-25), beside what the rate asked.
      if (meta !== null && (meta as Record<string, unknown>).price_set_by_hand === true) {
        const standard = metaNum(meta, "standard_charge");
        parts.push(standard !== null
          ? `${t("history.priceSetByHand")} (${t("session.plannedStandard")} ${money(standard)})`
          : t("history.priceSetByHand"));
      }
      // Paid at the counter with the grant, on a seat paid ahead (2026-11-15).
      const prepaidNow = metaTrue(meta, "prepaid") ? metaNum(meta, "prepaid_amount") : null;
      if (prepaidNow !== null) parts.push(fmt(t("history.prepaidWithTime"), money(prepaidNow)));
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
      // «Цена прежняя» (2026-11-15): the price it carries on at, pads and
      // extras included, in place of the bare seat rate.
      const nowText = rateNowText(meta, t, money);
      if (metaStr(meta, "rate_source") === "kept" && nowText !== null) {
        parts.push(fmt(t("history.rateKept"), nowText));
        break;
      }
      const rate = metaNum(meta, "hourly_rate");
      if (rate !== null && rate > 0) parts.push(`${money(rate)} / ${t("time.hourShort")}`);
      // What an hour costs in all, when more than the seat bills by the hour.
      const rateNow = meta?.rate_now as Record<string, unknown> | undefined;
      if (nowText !== null && rateNow && (metaPositive(rateNow, "pads") !== null || metaPositive(rateNow, "extras") !== null)) {
        parts.push(fmt(t("history.rateNow"), nowText));
      }
      break;
    }

    // A fixed time from now on an unlimited seat: what an hour costs (2026-11-15).
    case "limited": {
      const nowText = rateNowText(meta, t, money);
      if (nowText !== null) parts.push(fmt(t("history.rateNow"), nowText));
      break;
    }

    // An unpaid line paid now (2026-11-15, `scope: "item"`); the extra-time
    // switch's own line carries no meta and prints nothing, as before.
    case "unpaid_off": {
      if (metaStr(meta, "scope") !== "item") break;
      const item = meta?.item;
      if (item !== null && typeof item === "object") {
        const i = item as Record<string, unknown>;
        const name = metaStr(i, "name");
        const qty = metaNum(i, "qty");
        const total = metaNum(i, "line_total");
        if (name !== null) {
          parts.push(`${name}${qty !== null && qty > 0 ? ` × ${qty}` : ""}${total !== null ? ` · ${money(total)}` : ""}`);
        }
      }
      const left = metaPositive(meta, "unpaid_items_left");
      if (left !== null) parts.push(fmt(t("history.unpaidLeft"), left));
      break;
    }

    // The reminder a player asked for (2026-11-15).
    case "reminder_set": {
      const minutes = metaNum(meta, "minutes");
      if (minutes !== null) parts.push(fmt(t("history.reminderIn"), shortDuration(minutes, t)));
      const remindAt = metaStr(meta, "remind_at");
      if (remindAt !== null) parts.push(fmt(t("history.reminderAt"), formatTime(new Date(remindAt))));
      const note = metaStr(meta, "note");
      if (note !== null) parts.push(`«${note}»`);
      const previous = metaStr(meta, "previous_remind_at");
      if (previous !== null) parts.push(fmt(t("history.reminderWas"), formatTime(new Date(previous))));
      break;
    }
    case "reminder_cleared": {
      const remindAt = metaStr(meta, "remind_at");
      if (remindAt !== null) parts.push(fmt(t("history.reminderWas"), formatTime(new Date(remindAt))));
      if (meta !== null && typeof meta.fired === "boolean") {
        parts.push(t(meta.fired ? "history.reminderAfterRing" : "history.reminderBeforeRing"));
      }
      break;
    }
    case "reminder_fired": {
      const note = metaStr(meta, "note");
      if (note !== null) parts.push(`«${note}»`);
      const notified = metaNum(meta, "notified");
      if (notified !== null) parts.push(fmt(t("history.reminderNotified"), notified));
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
        const { name: stored, qty } = l as { name?: unknown; qty?: unknown };
        // A line with a kind (the own-food fee, 2026-11-13) is named by it:
        // its stored name is in the language of whoever started the session.
        const name = isOutsideFoodLine(l) ? sessionLineLabel(l, t) : stored;
        if (typeof name !== "string" || name.trim() === "") continue;
        const text = typeof qty === "number" && qty > 0 ? `${name} × ${qty}` : name;
        // Handed over NOT paid (2026-11-15): said on the line itself.
        parts.push((l as { unpaid?: unknown }).unpaid === true ? `${text} · ${t("history.notPaidTag")}` : text);
      }
      if (e.action === "item_added") {
        const unpaidTotal = metaPositive(meta, "unpaid_total");
        if (unpaidTotal !== null) parts.push(fmt(t("history.unpaidTotal"), money(unpaidTotal)));
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

    // The clock reset to zero (2026-11-05): what stays owed beside it.
    case "time_reset": {
      const kept = (metaNum(meta, "items_total") ?? 0) + (metaNum(meta, "joysticks_total") ?? 0);
      if (kept > 0) parts.push(fmt(t("history.resetKeeps"), money(kept)));
      break;
    }

    // The seat ended with nothing owed (2026-11-06): what each part came to.
    case "cancelled": {
      parts.push(fmt(t("history.cancelWaived"),
        money(metaNum(meta, "time_cost") ?? 0),
        money(metaNum(meta, "items_total") ?? 0),
        money(metaNum(meta, "joysticks_total") ?? 0)));
      // Paid ahead (2026-11-15): a cancel hands all of it back.
      const refund = metaPositive(meta, "change") ?? metaPositive(meta, "prepaid_amount");
      if (metaPositive(meta, "prepaid_amount") !== null && refund !== null) {
        parts.push(fmt(t("history.prepaidRefund"), money(refund)));
      }
      break;
    }

    // How it was paid (2026-11-07): at the stop, or recorded afterwards for a
    // seat that ended by itself. A stop the sweep made says so.
    case "stopped":
    case "payment_recorded": {
      if (e.action === "stopped" && metaStr(meta, "reason") === "expired") parts.push(t("history.endedAutomatically"));
      const paid = paidPartsOf(meta);
      const text = paymentText({
        payment_method: metaStr(meta, "payment_method"),
        payment_method_other: metaStr(meta, "payment_method_other"),
        payments: paid.map((p) => ({ ...p, note: metaStr(meta, "payment_note") })),
      }, t, money);
      if (text !== null) parts.push(text);
      // Paid ahead, the cash handed over, and what was left owing (2026-11-15).
      const ahead = prepaidSettledText(meta, t, money);
      if (ahead !== null) parts.push(ahead);
      const received = metaPositive(meta, "cash_received");
      if (received !== null && received !== metaNum(meta, "prepaid_amount")) {
        parts.push(fmt(t("history.cashReceived"), money(received)));
      }
      const owed = metaPositive(meta, "unpaid_amount");
      if (owed !== null) parts.push(fmt(t("history.unpaidAtEnd"), money(owed)));
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
export type EventTone = "start" | "stop" | "pause" | "resume" | "auto" | "move" | "charge" | "neutral" | "refused" | "waive";

/**
 * What an event's amount IS (2026-11-05, owner: the actions and the totals
 * must read apart at a glance): money put on the bill ("+300"), money waived
 * ("−400"), the bill's total ("Итог: 550"), or a plain figure.
 */
export type AmountKind = "charge" | "waive" | "total" | "plain";

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
  time_reset: { tone: "waive", icon: "↺" },
  cancelled: { tone: "stop", icon: "✕" },
  limited: { tone: "neutral", icon: "⏱" },
  unpaid_on: { tone: "refused", icon: "!" },
  unpaid_off: { tone: "neutral", icon: "✓" },
  // Had no entry until 2026-11-15, so its line printed its raw meta ("After:
  // expired") instead of how it was paid; the details below were never reached.
  payment_recorded: { tone: "neutral", icon: "֏" },
  time_add_refused: { tone: "refused", icon: "!" },
  move_failed: { tone: "refused", icon: "!" },
  reminder_set: { tone: "neutral", icon: "🔔" },
  reminder_cleared: { tone: "neutral", icon: "🔕" },
  reminder_fired: { tone: "auto", icon: "🔔" },
};

/** Written by the server with no person behind it: «Automatically», never a blank. */
const BY_SYSTEM = new Set(["reminder_fired"]);

export interface EventPresentation {
  title: string;
  tone: EventTone;
  icon: string;
  /** Who did it — a person, «Automatically» for the server, or null when unknown. */
  actor: string | null;
  /** What changed, one fact per entry. */
  details: string[];
  /**
   * Whether the event's `amount` is money put on the bill (2026-10-25). An
   * HOURLY pad's add event carries the pad's per-hour RATE as its amount, and
   * printed bare it read as a 500 charge on a pad that bills by the second;
   * that line hides it, and its details say "500/h" instead.
   */
  showAmount: boolean;
  /** How the amount reads: its sign, colour and weight. */
  amountKind: AmountKind;
}

const AMOUNT_KIND: Record<string, AmountKind> = {
  item_added: "charge",
  joystick_added: "charge",
  time_added: "charge",
  time_reset: "waive",
  cancelled: "waive",
  free_enabled: "waive",
  stopped: "total",
};
export const amountKindOf = (action: string): AmountKind => AMOUNT_KIND[action] ?? "plain";

/** "some_new_action" → "Some new action": readable without a translation. */
const humanize = (action: string): string => {
  const words = action.replace(/_/g, " ").trim();
  return words === "" ? "?" : words[0].toUpperCase() + words.slice(1);
};

/**
 * An action's title. ⚠️ The real `t` returns the KEY for a key it does not
 * have (never ""), so an action newer than this build used to print
 * "history.action.x" (fixed 2026-11-15). Asked of the dictionary itself, not
 * of what `t` answered, so an action with no entry reads as words whatever
 * `t` does with a missing key.
 */
const actionTitle = (action: string, t: (k: string) => string): string => {
  const key = `history.action.${action}`;
  if (!hasTranslation(key)) return humanize(action);
  const label = t(key);
  return label === "" ? humanize(action) : label;
};

/** A title that depends on the meta, not only on the action (2026-11-15). */
const titleOf = (e: ISessionEvent, t: (k: string) => string): string => {
  if (e.action === "unpaid_off" && metaStr(e.meta, "scope") === "item") return t("history.itemPaid");
  if (e.action === "reminder_set" && metaStr(e.meta, "previous_remind_at") !== null) return t("history.reminderChanged");
  return actionTitle(e.action, t);
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
      showAmount: true,
      amountKind: "plain",
    };
  }

  if (known === undefined) {
    const plain = Object.entries(e.meta ?? {})
      .filter(([, v]) => typeof v === "string" || typeof v === "number" || typeof v === "boolean")
      .map(([k, v]) => `${humanize(k)}: ${String(v)}`);
    return {
      title: actionTitle(e.action, t),
      tone: "neutral",
      icon: "•",
      actor: e.user?.name ?? null,
      details: plain,
      showAmount: true,
      amountKind: "plain",
    };
  }

  return {
    title: titleOf(e, t),
    tone: known.tone,
    icon: known.icon,
    actor: e.user?.name ?? (BY_SYSTEM.has(e.action) ? t("history.endedAutomatically") : null),
    details,
    showAmount: !(e.action === "joystick_added"
      && e.meta !== null && (e.meta as Record<string, unknown>).hourly === true),
    amountKind: amountKindOf(e.action),
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
