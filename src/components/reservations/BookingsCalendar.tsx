import Button from "@/components/ui/Button";
import SectionTabs from "@/components/ui/SectionTabs";
import { ErrorState, StaleNotice } from "@/components/ui/state";
import { useLang } from "@/i18n/LanguageContext";
import { useCallback, useEffect, useMemo, useState } from "react";
import CalendarMonthGrid from "./CalendarMonthGrid";
import CalendarTimeGrid, { type TimeColumn } from "./CalendarTimeGrid";
import {
  bookingsByDay, dayBlocks, fetchRange, isSameDay, rangeTitle, shiftAnchor, startOfDay,
  visibleDays, WEEKDAY_KEYS, ymd, type CalendarSession, type CalendarView,
} from "./calendarModel";
import { seatNames } from "./calendarText";
import ReservationDetailsDialog from "./ReservationDetailsDialog";
import ReservationFormDialog, { type ReservationFormMode } from "./ReservationFormDialog";
import { useStaffReservations } from "./useStaffReservations";

/** A seat as the board hands it to the calendar. */
export interface CalendarPlace {
  id: number;
  number: number;
  /** How the board names it: "№4". */
  label: string;
  platform?: string;
  offline: boolean;
}

export interface BookingsCalendarProps {
  branchId: number;
  places: readonly CalendarPlace[];
  /** The seats running now, as the board knows them. */
  sessions: readonly CalendarSession[];
  /** Open filtered to this seat (the card's «Забронировать»). */
  focusPlaceId?: number;
}

/** "Now" for the current-time line and open-ended sessions; 30 s is a pixel at most. */
export const NOW_TICK_MS = 30_000;

const useNow = (): Date => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const handle = setInterval(() => setNow(new Date()), NOW_TICK_MS);
    return () => clearInterval(handle);
  }, []);
  return now;
};

const VIEWS: readonly CalendarView[] = ["day", "week", "month"];

/**
 * The branch's bookings calendar (2026-11-07, owner): Day (a column per seat),
 * Week (a column per day) and Month (a cell per day), with the running
 * sessions on today. Every booking on it is the server's
 * (`GET /places/reservations`): nothing here decides whether a slot is free —
 * a click on any time opens the form, and a refusal is the server's sentence.
 */
const BookingsCalendar = ({ branchId, places, sessions, focusPlaceId }: BookingsCalendarProps) => {
  const { t } = useLang();
  const now = useNow();
  const [view, setView] = useState<CalendarView>("day");
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [seat, setSeat] = useState<number | null>(focusPlaceId ?? null);
  const [form, setForm] = useState<ReservationFormMode | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);

  const range = fetchRange(view, anchor);
  const { reservations, error, reload } = useStaffReservations(branchId, range.from, range.to);
  const rows = useMemo(() => reservations ?? [], [reservations]);
  const seats = useMemo(() => seatNames(places), [places]);
  const days = useMemo(() => visibleDays(view, anchor), [view, anchor]);
  const shownPlaces = seat === null ? places : places.filter((p) => p.id === seat);
  const opened = openId === null ? null : rows.find((r) => r.id === openId) ?? null;
  const defaultSeat = seat ?? places[0]?.id ?? null;

  const onSlot = useCallback((column: TimeColumn, minute: number) => {
    const placeId = column.placeId ?? defaultSeat;
    if (placeId === null) return;
    setForm({ kind: "create", placeId, start: new Date(column.day.getTime() + minute * 60_000) });
  }, [defaultSeat]);

  const columns: TimeColumn[] = view === "day"
    ? shownPlaces.map((p) => ({
        key: `p${p.id}`,
        header: <span className="cal-grid__seat">{p.label}</span>,
        day: days[0],
        placeId: p.id,
        offline: p.offline,
        today: isSameDay(days[0], now),
        blocks: dayBlocks(days[0], rows, sessions, now, p.id),
      }))
    : view === "week"
      ? days.map((d) => ({
          key: ymd(d),
          header: <span>{t(`branch.weekday.${WEEKDAY_KEYS[d.getDay()]}`)} {String(d.getDate()).padStart(2, "0")}.{String(d.getMonth() + 1).padStart(2, "0")}</span>,
          day: d,
          placeId: seat,
          today: isSameDay(d, now),
          // One seat: its bookings and its session. All seats: the bookings, each naming its seat.
          blocks: dayBlocks(d, rows, seat === null ? [] : sessions, now, seat),
        }))
      : [];

  const saved = () => { setForm(null); reload(); };

  return (
    <div className="cal" data-testid="bookings-calendar">
      <div className="cal__toolbar">
        <SectionTabs
          tabs={VIEWS.map((v) => ({ key: v, label: t(`calendar.view.${v}`) }))}
          value={view}
          onChange={setView}
          label={t("calendar.view")}
        />
        <div className="cal__nav">
          <Button type="button" variant="secondary" onClick={() => setAnchor(startOfDay(new Date()))}>{t("calendar.today")}</Button>
          <Button type="button" variant="secondary" className="cal__step" onClick={() => setAnchor((a) => shiftAnchor(view, a, -1))} aria-label={t("calendar.prev")} title={t("calendar.prev")}>‹</Button>
          <Button type="button" variant="secondary" className="cal__step" onClick={() => setAnchor((a) => shiftAnchor(view, a, 1))} aria-label={t("calendar.next")} title={t("calendar.next")}>›</Button>
          <h2 className="cal__title" data-testid="cal-title">{rangeTitle(view, anchor, t)}</h2>
        </div>
        <div className="cal__actions">
          <select
            className="input cal__seat"
            value={seat ?? ""}
            onChange={(e) => setSeat(e.target.value === "" ? null : Number(e.target.value))}
            aria-label={t("reserve.seat")}
            data-testid="cal-seat-filter"
          >
            <option value="">{t("calendar.allSeats")}</option>
            {places.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          <Button
            type="button"
            onClick={() => defaultSeat !== null && setForm({ kind: "create", placeId: defaultSeat })}
            disabled={defaultSeat === null}
            data-testid="cal-create"
          >
            {t("calendar.create")}
          </Button>
        </div>
      </div>

      <ul className="cal__legend" aria-label={t("calendar.legend")}>
        {(["free", "booked", "active", "unlimited", "offline"] as const).map((k) => (
          <li key={k} className="cal__legend-item"><span className={`cal__swatch cal__swatch--${k}`} aria-hidden />{t(`calendar.legend.${k}`)}</li>
        ))}
        {view !== "month" && <li className="cal__legend-item muted">{t("calendar.slotHint")}</li>}
      </ul>

      {error && reservations && <StaleNotice error={error} onRetry={reload} />}

      {error && !reservations ? (
        <ErrorState error={error} onRetry={reload} size="section" titleKey="calendar.state.errorTitle" />
      ) : places.length === 0 ? (
        <p className="muted">{t("calendar.noSeats")}</p>
      ) : view === "month" ? (
        <CalendarMonthGrid
          days={days}
          month={anchor.getMonth()}
          byDay={bookingsByDay(days, seat === null ? rows : rows.filter((r) => r.place_ids.includes(seat)))}
          now={now}
          seats={seats}
          onPickDay={(d) => { setAnchor(d); setView("day"); }}
        />
      ) : (
        <CalendarTimeGrid
          columns={columns}
          now={now}
          seats={seats}
          scrollKey={`${view}:${ymd(anchor)}`}
          onSlot={onSlot}
          onBooking={setOpenId}
        />
      )}

      {opened && !form && (
        <ReservationDetailsDialog
          reservation={opened}
          seats={seats}
          onClose={() => setOpenId(null)}
          onEdit={(r) => { setOpenId(null); setForm({ kind: "edit", reservation: r }); }}
          onCancelled={() => { setOpenId(null); reload(); }}
        />
      )}
      {form && (
        <ReservationFormDialog places={places} mode={form} onClose={() => setForm(null)} onSaved={saved} />
      )}
    </div>
  );
};

export default BookingsCalendar;
