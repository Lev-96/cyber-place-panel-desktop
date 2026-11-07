import type { StaffReservation } from "@/domain/StaffReservation";
import { reservationWho } from "@/domain/StaffReservation";
import { useLang } from "@/i18n/LanguageContext";
import { fmt } from "@/i18n/translations";
import { memo } from "react";
import { hm, isSameDay, WEEKDAY_KEYS, ymd } from "./calendarModel";
import { bookingTip, type SeatNames } from "./calendarText";

/** How many chips a day cell shows before "+N". */
export const MONTH_CHIPS = 3;

interface Props {
  days: Date[];
  /** The month the grid is for: days outside it are dimmed. */
  month: number;
  byDay: Map<string, StaffReservation[]>;
  now: Date;
  seats: SeatNames;
  onPickDay: (day: Date) => void;
}

/** Monday first, as the grid. */
const HEAD = [...WEEKDAY_KEYS.slice(1), WEEKDAY_KEYS[0]];

const DayCell = memo(({ day, inMonth, today, bookings, seats, onPickDay }: {
  day: Date; inMonth: boolean; today: boolean; bookings: StaffReservation[]; seats: SeatNames; onPickDay: (day: Date) => void;
}) => {
  const { t } = useLang();
  const more = bookings.length - MONTH_CHIPS;
  return (
    <button
      type="button"
      className={`cal-month__cell${inMonth ? "" : " cal-month__cell--out"}${today ? " cal-month__cell--today" : ""}`}
      onClick={() => onPickDay(day)}
      data-testid="cal-month-day"
      data-day={ymd(day)}
    >
      <span className="cal-month__date">{day.getDate()}</span>
      {bookings.slice(0, MONTH_CHIPS).map((r) => (
        <span key={r.id} className={`cal-month__chip cal-month__chip--${r.source}`} data-tip={bookingTip(r, seats, t)} data-testid="cal-month-chip">
          {[hm(r.start), seats.labelsOf(r.place_ids), reservationWho(r)].filter(Boolean).join(" ")}
        </span>
      ))}
      {more > 0 && <span className="cal-month__more" aria-label={fmt(t("calendar.more"), more)}>+{more}</span>}
    </button>
  );
});
DayCell.displayName = "DayCell";

/** The month (2026-11-07): whole weeks, up to three bookings per day, a click opens the day. */
const CalendarMonthGrid = ({ days, month, byDay, now, seats, onPickDay }: Props) => {
  const { t } = useLang();
  return (
    <div className="cal-month" data-testid="cal-month">
      {HEAD.map((k) => <span key={k} className="cal-month__weekday">{t(`branch.weekday.${k}`)}</span>)}
      {days.map((d) => (
        <DayCell
          key={ymd(d)}
          day={d}
          inMonth={d.getMonth() === month}
          today={isSameDay(d, now)}
          bookings={byDay.get(ymd(d)) ?? []}
          seats={seats}
          onPickDay={onPickDay}
        />
      ))}
    </div>
  );
};

export default CalendarMonthGrid;
