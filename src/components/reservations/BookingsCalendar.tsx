import Button from "@/components/ui/Button";
import { ErrorState, StaleNotice } from "@/components/ui/state";
import type { StaffReservation } from "@/domain/StaffReservation";
import { useLang } from "@/i18n/LanguageContext";
import { useCallback, useEffect, useMemo, useState } from "react";
import BookingsTimeline from "./BookingsTimeline";
import {
  addDays, bookingCounts, clubDayOf, dayBookings, dm, fetchRange, isSameDay, roundUpToStep, startSeatOf,
  STRIP_DAYS, stripDays, timelineWindow, WEEKDAY_KEYS, type CalendarSession,
} from "./calendarModel";
import { seatNames } from "./calendarText";
import DateStrip from "./DateStrip";
import DayBookingsList from "./DayBookingsList";
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
  /** Open filtered to this seat (the card's «Бронь»). */
  focusPlaceId?: number;
  /**
   * «Старт» on a booking that is due (`startSeatOf`): the board closes the
   * calendar and opens its Start dialog with that booking. Left out, the
   * calendar offers no Start.
   */
  onStartBooking?: (placeId: number, bookingId: number) => void;
}

/** "Now" for the current-time line and the Start rule; 30 s is a pixel at most. */
export const NOW_TICK_MS = 30_000;

const useNow = (): Date => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const handle = setInterval(() => setNow(new Date()), NOW_TICK_MS);
    return () => clearInterval(handle);
  }, []);
  return now;
};

const LEGEND = ["booked", "guest", "active", "unlimited", "offline"] as const;

/**
 * The branch's bookings calendar (2026-11-07, simplified on the owner's word
 * the same day): pick a day on the strip, read it as a timeline of seats and
 * as a list of its bookings, act on a booking from the list. Every booking
 * is the server's (`GET /places/reservations`, one read per two-week strip):
 * nothing here decides whether a slot is free or a booking may start; a
 * click on any free time opens the form, and a refusal is the server's.
 */
const BookingsCalendar = ({ branchId, places, sessions, focusPlaceId, onStartBooking }: BookingsCalendarProps) => {
  const { t } = useLang();
  const now = useNow();
  const today = clubDayOf(now);
  const [first, setFirst] = useState(() => clubDayOf(new Date()));
  const [day, setDay] = useState(() => clubDayOf(new Date()));
  const [seat, setSeat] = useState<number | null>(focusPlaceId ?? null);
  const [form, setForm] = useState<ReservationFormMode | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);

  const range = fetchRange(first);
  const { reservations, error, reload } = useStaffReservations(branchId, range.from, range.to);
  const seats = useMemo(() => seatNames(places), [places]);
  const days = useMemo(() => stripDays(first), [first]);
  const shownPlaces = seat === null ? places : places.filter((p) => p.id === seat);
  const rows = useMemo(
    () => (reservations ?? []).filter((r) => seat === null || r.place_ids.includes(seat)),
    [reservations, seat],
  );
  const shownSessions = seat === null ? sessions : sessions.filter((s) => s.placeId === seat);
  const counts = useMemo(() => (reservations ? bookingCounts(days, rows) : null), [reservations, days, rows]);
  const listed = reservations ? dayBookings(day, rows) : null;
  const frame = timelineWindow(day, rows, shownSessions, now);
  const running = useMemo(() => new Set(sessions.map((s) => s.placeId)), [sessions]);
  const startOf = useCallback((r: StaffReservation) => startSeatOf(r, now, running), [now, running]);
  const opened = openId === null ? null : (reservations ?? []).find((r) => r.id === openId) ?? null;
  const defaultSeat = seat ?? places[0]?.id ?? null;
  const dayLabel = `${t(`branch.weekday.${WEEKDAY_KEYS[day.getDay()]}`)}, ${dm(day)}`;

  const pick = (d: Date) => setDay(d);
  const page = (dir: 1 | -1) => {
    const next = addDays(first, dir * STRIP_DAYS);
    setFirst(next);
    setDay(next);
  };
  const goToday = () => { setFirst(today); setDay(today); };

  const create = () => {
    if (defaultSeat === null) return;
    // Today: from now. Another day: the same time of day on it.
    const soon = roundUpToStep(now);
    const start = isSameDay(day, today)
      ? soon
      : new Date(day.getFullYear(), day.getMonth(), day.getDate(), soon.getHours(), soon.getMinutes());
    setForm({ kind: "create", placeId: defaultSeat, start });
  };
  const startBooking = (placeId: number, bookingId: number) => { setOpenId(null); onStartBooking?.(placeId, bookingId); };
  const saved = () => { setForm(null); reload(); };
  const openedSeat = opened && onStartBooking ? startOf(opened) : null;

  return (
    <div className="cal" data-testid="bookings-calendar">
      <header className="cal__head">
        <h2 className="cal__title">{t("calendar.title")}</h2>
        <div className="cal__actions">
          {places.length > 1 && (
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
          )}
          <Button type="button" className="cal__create" onClick={create} disabled={defaultSeat === null} data-testid="cal-create">
            <span aria-hidden>+</span> {t("calendar.create")}
          </Button>
        </div>
      </header>

      <DateStrip days={days} selected={day} today={today} counts={counts} onPick={pick} onPage={page} onToday={goToday} />

      <div className="cal__sub">
        <span className="cal__day" data-testid="cal-title">{dayLabel}.{day.getFullYear()}</span>
        <ul className="cal__legend" aria-label={t("calendar.legend")}>
          {LEGEND.map((k) => (
            <li key={k} className="cal__legend-item"><span className={`cal__swatch cal__swatch--${k}`} aria-hidden />{t(`calendar.legend.${k}`)}</li>
          ))}
        </ul>
      </div>

      {error && reservations && <StaleNotice error={error} onRetry={reload} />}

      {error && !reservations ? (
        <ErrorState error={error} onRetry={reload} size="section" titleKey="calendar.state.errorTitle" />
      ) : places.length === 0 ? (
        <p className="muted">{t("calendar.noSeats")}</p>
      ) : (
        <div className="cal__body">
          <BookingsTimeline
            places={shownPlaces}
            day={day}
            frame={frame}
            reservations={rows}
            sessions={shownSessions}
            now={now}
            seats={seats}
            onSlot={(placeId, start) => setForm({ kind: "create", placeId, start })}
            onBooking={setOpenId}
          />
          <DayBookingsList
            dayLabel={dayLabel}
            bookings={listed}
            seats={seats}
            startSeatOf={startOf}
            onStart={onStartBooking ? startBooking : undefined}
            onEdit={(r) => setForm({ kind: "edit", reservation: r })}
            onCancelled={reload}
            onCreate={create}
            canCreate={defaultSeat !== null}
          />
        </div>
      )}

      {opened && !form && (
        <ReservationDetailsDialog
          reservation={opened}
          seats={seats}
          onClose={() => setOpenId(null)}
          onEdit={(r) => { setOpenId(null); setForm({ kind: "edit", reservation: r }); }}
          onCancelled={() => { setOpenId(null); reload(); }}
          onStart={openedSeat === null ? undefined : () => startBooking(openedSeat, opened.id)}
        />
      )}
      {form && (
        <ReservationFormDialog places={places} mode={form} onClose={() => setForm(null)} onSaved={saved} />
      )}
    </div>
  );
};

export default BookingsCalendar;
