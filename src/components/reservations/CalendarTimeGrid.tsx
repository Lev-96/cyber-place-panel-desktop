import { useLang } from "@/i18n/LanguageContext";
import { fmt } from "@/i18n/translations";
import { CSSProperties, memo, MouseEvent, ReactNode, useLayoutEffect, useRef } from "react";
import { hm, MINUTES_PER_DAY, minuteOfDay, slotOf, type CalendarBlock } from "./calendarModel";
import { bookingTip, type SeatNames } from "./calendarText";

/** One column of the grid: a seat on a day (Day view) or a day of one seat / all seats (Week view). */
export interface TimeColumn {
  key: string;
  header: ReactNode;
  day: Date;
  /** The seat a click on empty time books; null = all seats (the form picks the first). */
  placeId: number | null;
  offline?: boolean;
  today?: boolean;
  blocks: CalendarBlock[];
}

interface Props {
  columns: TimeColumn[];
  now: Date;
  seats: SeatNames;
  /** What the grid scrolls to when it opens: changes of it re-scroll, ticks of `now` do not. */
  scrollKey: string;
  onSlot: (column: TimeColumn, minute: number) => void;
  onBooking: (id: number) => void;
}

type BlockStyle = CSSProperties & Record<`--cal-${string}`, number>;

const HOURS = Array.from({ length: 24 }, (_, h) => h);

const BlockView = memo(({ block, now, seats, withSeat, onBooking }: {
  block: CalendarBlock; now: Date; seats: SeatNames; withSeat: boolean; onBooking: (id: number) => void;
}) => {
  const { t } = useLang();
  const style: BlockStyle = {
    "--cal-start": block.startMin,
    "--cal-len": block.endMin - block.startMin,
    "--cal-lane": block.lane,
    "--cal-lanes": block.lanes,
  };
  const cut = `${block.fromBefore ? " cal-block--from-before" : ""}${block.intoNext ? " cal-block--into-next" : ""}`;

  if (block.kind === "session") {
    const s = block.session;
    const tip = block.openEnded
      ? fmt(t("calendar.sessionUnlimited"), hm(s.startedAt))
      : fmt(t("calendar.session"), hm(s.startedAt), hm(s.endsAt ?? now));
    return (
      <div className={`cal-block cal-block--session${block.openEnded ? " cal-block--open" : ""}${cut}`} style={style} data-tip={tip} data-testid="cal-session">
        <span className="cal-block__time">{hm(s.startedAt)}</span>
        {block.openEnded && <span className="cal-block__infinity" aria-label={t("calendar.legend.unlimited")}>∞</span>}
      </div>
    );
  }

  const r = block.reservation;
  const tip = bookingTip(r, seats, t);
  return (
    <button
      type="button"
      className={`cal-block cal-block--booking cal-block--${r.source}${r.status === "finished" ? " cal-block--finished" : ""}${cut}`}
      style={style}
      data-tip={tip}
      aria-label={tip}
      data-testid="cal-booking"
      data-booking-id={r.id}
      onClick={(e) => { e.stopPropagation(); onBooking(r.id); }}
    >
      <span className="cal-block__time">{hm(r.start)}–{hm(r.end)}</span>
      {withSeat && <span className="cal-block__seat">{seats.labelsOf(r.place_ids)}</span>}
      <span className="cal-block__who">{r.contact_name ?? r.guest_name ?? ""}</span>
    </button>
  );
});
BlockView.displayName = "BlockView";

/**
 * A 24-hour time grid (2026-11-07): hour lines, a 15-minute grid, blocks
 * placed by their minutes (CSS custom properties, so the layout stays in
 * CSS), the red current-time line on today, an offline seat hatched. Opens
 * scrolled to now on today, to the morning on another day.
 */
const CalendarTimeGrid = ({ columns, now, seats, scrollKey, onSlot, onBooking }: Props) => {
  const { t } = useLang();
  const scrollRef = useRef<HTMLDivElement>(null);
  const nowMin = minuteOfDay(now);
  const showsToday = columns.some((c) => c.today);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const focusMin = showsToday ? minuteOfDay(new Date()) : 8 * 60;
    el.scrollTop = Math.max(0, (focusMin / MINUTES_PER_DAY) * el.scrollHeight - el.clientHeight / 3);
    // Only a new range or view re-scrolls; the 30 s tick must not yank the grid.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollKey]);

  const clickSlot = (column: TimeColumn) => (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.height <= 0) return;
    onSlot(column, slotOf(((e.clientY - rect.top) / rect.height) * MINUTES_PER_DAY));
  };

  const nowStyle: BlockStyle = { "--cal-start": nowMin };

  return (
    <div className="cal-grid" ref={scrollRef} data-testid="cal-time-grid">
      <div className="cal-grid__head">
        <div className="cal-grid__corner" />
        {columns.map((c) => (
          <div key={c.key} className={`cal-grid__colhead${c.today ? " cal-grid__colhead--today" : ""}${c.offline ? " cal-grid__colhead--offline" : ""}`}>
            {c.header}
          </div>
        ))}
      </div>
      <div className="cal-grid__body">
        <div className="cal-grid__gutter" aria-hidden>
          {HOURS.map((h) => <span key={h} className="cal-grid__hour">{String(h).padStart(2, "0")}:00</span>)}
        </div>
        {columns.map((c) => (
          <div
            key={c.key}
            className={`cal-grid__col${c.offline ? " cal-grid__col--offline" : ""}`}
            onClick={clickSlot(c)}
            data-testid="cal-column"
            data-column={c.key}
          >
            {c.blocks.map((b) => (
              <BlockView key={b.key} block={b} now={now} seats={seats} withSeat={c.placeId === null} onBooking={onBooking} />
            ))}
            {c.today && <div className="cal-grid__now" style={nowStyle} role="presentation" aria-label={t("calendar.now")} data-testid="cal-now" />}
          </div>
        ))}
      </div>
    </div>
  );
};

export default CalendarTimeGrid;
