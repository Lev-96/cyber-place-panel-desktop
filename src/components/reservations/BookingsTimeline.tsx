import PlatformIcon from "@/components/ui/PlatformIcon";
import { StatusIcon } from "@/components/ui/StatusChip";
import type { StaffReservation } from "@/domain/StaffReservation";
import { reservationWho } from "@/domain/StaffReservation";
import { useLang } from "@/i18n/LanguageContext";
import { fmt } from "@/i18n/translations";
import { platformLabel } from "@/utils/platform";
import { CSSProperties, memo, MouseEvent, useLayoutEffect, useRef } from "react";
import type { CalendarPlace } from "./BookingsCalendar";
import {
  atHour, clubDayBounds, hm, minutesBetween, seatBlocks, slotAt, WEEKDAY_KEYS, dm,
  type CalendarSession, type TimelineBlock, type TimelineWindow,
} from "./calendarModel";
import { bookingTip, type SeatNames } from "./calendarText";

interface Props {
  places: readonly CalendarPlace[];
  /** The club day drawn (its 06:00 to the next 06:00). */
  day: Date;
  frame: TimelineWindow;
  reservations: readonly StaffReservation[];
  sessions: readonly CalendarSession[];
  now: Date;
  seats: SeatNames;
  /** A click on empty time of a seat's row: the form opens there. */
  onSlot: (placeId: number, start: Date) => void;
  onBooking: (id: number) => void;
}

type TimelineVars = CSSProperties & Record<`--tl-${string}`, number>;

const BlockView = memo(({ block, seats, now }: { block: TimelineBlock; seats: SeatNames; now: Date }) => {
  const { t } = useLang();
  const style: TimelineVars = {
    "--tl-start": block.startMin,
    "--tl-len": block.endMin - block.startMin,
    "--tl-lane": block.lane,
    "--tl-lanes": block.lanes,
  };
  const cut = `${block.fromBefore ? " is-from-before" : ""}${block.intoNext ? " is-into-next" : ""}`;

  if (block.kind === "session") {
    const s = block.session;
    const tip = block.openEnded
      ? fmt(t("calendar.sessionUnlimited"), hm(s.startedAt))
      : fmt(t("calendar.session"), hm(s.startedAt), hm(s.endsAt ?? now));
    return (
      <div className={`tl-block tl-block--session${block.openEnded ? " tl-block--open" : ""}${cut}`} style={style} data-tip={tip} data-testid="cal-session">
        <span className="tl-block__time">
          <StatusIcon tone="playing" />
          {block.openEnded ? hm(s.startedAt) : `${hm(s.startedAt)}–${hm(s.endsAt ?? now)}`}
        </span>
        {block.openEnded && <span className="tl-block__infinity" aria-label={t("calendar.legend.unlimited")}>∞</span>}
      </div>
    );
  }

  const r = block.reservation;
  const tip = bookingTip(r, seats, t);
  return (
    <button
      type="button"
      className={`tl-block tl-block--booking tl-block--${r.source}${r.status === "finished" ? " is-finished" : ""}${cut}`}
      style={style}
      data-tip={tip}
      aria-label={tip}
      data-testid="cal-booking"
      data-booking-id={r.id}
      data-booking-click
    >
      <span className="tl-block__time">{hm(r.start)}<span className="tl-block__end">–{hm(r.end)}</span></span>
      <span className="tl-block__who">{reservationWho(r) ?? t("reserve.noName")}</span>
    </button>
  );
});
BlockView.displayName = "BlockView";

/**
 * One club day as rows of seats against the clock (2026-11-07): the hours
 * across, a row per seat, its bookings (yellow; filled when made at the desk,
 * outlined when from the app) and its running session (green; unlimited
 * fades out with ∞) placed by their minutes through CSS custom properties,
 * so layout stays in CSS. A cyan line marks now. Opens scrolled to now on
 * today, to the day's first booking on another day.
 */
const BookingsTimeline = ({ places, day, frame, reservations, sessions, now, seats, onSlot, onBooking }: Props) => {
  const { t } = useLang();
  const scrollRef = useRef<HTMLDivElement>(null);
  const hours = frame.minutes / 60;
  const bounds = clubDayBounds(day);
  const nowMin = now >= frame.start && now < frame.end ? minutesBetween(frame.start, now) : null;
  const midnight = atHour(day, 24);
  const vars: TimelineVars = { "--tl-span": frame.minutes, "--tl-hours": hours, ...(nowMin === null ? {} : { "--tl-now": nowMin }) };

  const blocksBySeat = places.map((p) => seatBlocks(p.id, day, frame, reservations, sessions, now));
  const firstMin = Math.min(...blocksBySeat.flat().filter((b) => b.kind === "booking").map((b) => b.startMin), Infinity);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    const track = el?.querySelector<HTMLElement>(".tl__track");
    if (!el || !track || track.offsetWidth === 0) return;
    const focus = nowMin ?? (Number.isFinite(firstMin) ? firstMin : 0);
    el.scrollLeft = Math.max(0, (focus / frame.minutes) * track.offsetWidth - el.clientWidth / 4);
    // Only a new day re-scrolls; the 30 s tick and a re-read must not yank the view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bounds.start.getTime()]);

  const clickTrack = (placeId: number) => (e: MouseEvent<HTMLDivElement>) => {
    const booking = (e.target as HTMLElement).closest<HTMLElement>("[data-booking-click]");
    if (booking) {
      onBooking(Number(booking.dataset.bookingId));
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    onSlot(placeId, slotAt(frame, (e.clientX - rect.left) / rect.width));
  };

  return (
    <div className="tl" ref={scrollRef} data-testid="cal-timeline">
      <div className="tl__inner" style={vars}>
        <div className="tl__scale">
          <div className="tl__corner" />
          <div className="tl__hours" aria-hidden>
            {Array.from({ length: hours }, (_, i) => {
              const at = new Date(frame.start.getTime() + i * 3_600_000);
              const isMidnight = at.getTime() === midnight.getTime();
              return (
                <span key={i} className={`tl__hour${isMidnight ? " is-midnight" : ""}`}>
                  {hm(at)}
                  {isMidnight && <span className="tl__date">{t(`branch.weekday.${WEEKDAY_KEYS[at.getDay()]}`)} {dm(at)}</span>}
                </span>
              );
            })}
            {nowMin !== null && <span className="tl__now-pill" data-testid="cal-now">{hm(now)}</span>}
          </div>
        </div>

        <div className="tl__rows">
          {places.map((p, i) => (
            <div key={p.id} className={`tl__row${p.offline ? " is-offline" : ""}`} data-testid="cal-row" data-place-id={p.id}>
              <div className="tl__seat">
                <span className="tl__seat-name">{p.label}</span>
                {p.offline ? (
                  <span className="tl__seat-meta tl__seat-meta--offline"><StatusIcon tone="offline" />{t("calendar.legend.offline")}</span>
                ) : p.platform ? (
                  <span className="tl__seat-meta"><PlatformIcon platform={p.platform} size={12} tone="current" />{platformLabel(p.platform)}</span>
                ) : null}
              </div>
              <div
                className="tl__track"
                onClick={clickTrack(p.id)}
                data-testid="cal-track"
              >
                {blocksBySeat[i].map((b) => <BlockView key={b.key} block={b} seats={seats} now={now} />)}
              </div>
            </div>
          ))}
          {nowMin !== null && <div className="tl__now" role="presentation" aria-label={t("calendar.now")} />}
        </div>
      </div>
    </div>
  );
};

export default BookingsTimeline;
