import Button from "@/components/ui/Button";
import { useLang } from "@/i18n/LanguageContext";
import { fmt } from "@/i18n/translations";
import { isSameDay, WEEKDAY_KEYS, ymd } from "./calendarModel";

interface Props {
  days: readonly Date[];
  selected: Date;
  today: Date;
  /** Bookings per day (`ymd`); null while the first read is in flight. */
  counts: ReadonlyMap<string, number> | null;
  onPick: (day: Date) => void;
  onPage: (dir: 1 | -1) => void;
  onToday: () => void;
}

/**
 * Which day the calendar shows (2026-11-07): «Сегодня», then two weeks of
 * days as chips (weekday, day number, how many bookings), paged by ‹ ›. The
 * count tells the busy days at a glance, so no month view is needed for it.
 */
const DateStrip = ({ days, selected, today, counts, onPick, onPage, onToday }: Props) => {
  const { t } = useLang();
  return (
    <nav className="cal-strip" aria-label={t("calendar.days")}>
      <Button type="button" variant="secondary" className="cal-strip__today" onClick={onToday} data-testid="cal-today">
        {t("calendar.today")}
      </Button>
      <Button type="button" variant="secondary" className="cal-strip__step" onClick={() => onPage(-1)} aria-label={t("calendar.prev")} title={t("calendar.prev")}>‹</Button>
      <div className="cal-strip__days">
        {days.map((d) => {
          const key = ymd(d);
          const count = counts?.get(key) ?? 0;
          const isToday = isSameDay(d, today);
          const isSelected = isSameDay(d, selected);
          const weekday = t(`branch.weekday.${WEEKDAY_KEYS[d.getDay()]}`);
          return (
            <button
              key={key}
              type="button"
              className={`cal-day${isSelected ? " is-selected" : ""}${isToday ? " is-today" : ""}${d.getDay() % 6 === 0 ? " is-weekend" : ""}`}
              aria-pressed={isSelected}
              aria-current={isToday ? "date" : undefined}
              aria-label={`${isToday ? `${t("calendar.today")}, ` : ""}${weekday} ${d.getDate()}${count > 0 ? `, ${fmt(t("calendar.count"), count)}` : ""}`}
              onClick={() => onPick(d)}
              data-testid="cal-day"
              data-day={key}
            >
              <span className="cal-day__weekday">{weekday}</span>
              <span className="cal-day__num">{d.getDate()}</span>
              <span className={`cal-day__count${count > 0 ? "" : " is-empty"}`} data-testid="cal-day-count" aria-hidden>
                {count > 0 ? count : ""}
              </span>
            </button>
          );
        })}
      </div>
      <Button type="button" variant="secondary" className="cal-strip__step" onClick={() => onPage(1)} aria-label={t("calendar.next")} title={t("calendar.next")}>›</Button>
    </nav>
  );
};

export default DateStrip;
