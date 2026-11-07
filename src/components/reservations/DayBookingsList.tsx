import Button from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import StatusChip from "@/components/ui/StatusChip";
import type { StatusTone } from "@/domain/statusTone";
import { isCancellable, reservationWho, type StaffReservation } from "@/domain/StaffReservation";
import { useLang } from "@/i18n/LanguageContext";
import { renderText } from "@/i18n/localizedText";
import { fmt } from "@/i18n/translations";
import { formatArmenianPhone } from "@/utils/armenianPhone";
import { telHref, windowOf, type SeatNames } from "./calendarText";
import { useCancelReservation } from "./useCancelReservation";

interface Props {
  /** "Сб, 07.11": the day the list is for. */
  dayLabel: string;
  /** The day's bookings in start order; null while the first read is in flight. */
  bookings: readonly StaffReservation[] | null;
  seats: SeatNames;
  /** The seat «Старт» would start a booking on, or null when it is not offered. */
  startSeatOf: (r: StaffReservation) => number | null;
  onStart?: (placeId: number, bookingId: number) => void;
  onEdit: (r: StaffReservation) => void;
  onCancelled: () => void;
  onCreate: () => void;
  canCreate: boolean;
}

/** A booking's state as the list says it: waiting (yellow), playing (green, a player is seated), finished (grey). */
const stateOf = (r: StaffReservation): { tone: StatusTone; key: string } => {
  if (r.session_id !== null && r.status !== "finished") return { tone: "playing", key: "calendar.legend.active" };
  if (r.status === "finished") return { tone: "offline", key: "bookingDetails.status.finished" };
  return { tone: "booked", key: `bookingDetails.status.${r.status}` };
};

/**
 * «Брони на <день>» (2026-11-07): the day's bookings as rows a cashier reads
 * top to bottom: the time, the seat, who and their phone, the state, where it
 * was made, and what can be done with it. «Изменить» only where the server
 * says `editable` and the desk made it; «Отменить» only while it still
 * awaits its player; «Старт» only when the calendar offers it.
 */
const DayBookingsList = ({ dayLabel, bookings, seats, startSeatOf, onStart, onEdit, onCancelled, onCreate, canCreate }: Props) => {
  const { t } = useLang();
  const { cancel, busyId, error } = useCancelReservation(seats, onCancelled);

  return (
    <section className="cal-list" aria-label={fmt(t("calendar.list.title"), dayLabel)} data-testid="cal-list">
      <header className="cal-list__head">
        <h3 className="cal-list__title">{fmt(t("calendar.list.title"), dayLabel)}</h3>
        {bookings && bookings.length > 0 && <span className="cal-list__total" aria-hidden>{bookings.length}</span>}
      </header>

      {bookings === null ? (
        <div className="cal-list__items" aria-busy="true" aria-label={t("a11y.loading")}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="cal-item">
              <Skeleton width="40%" height={14} />
              <Skeleton width="70%" height={12} />
              <Skeleton width={120} height={32} radius={8} />
            </div>
          ))}
        </div>
      ) : bookings.length === 0 ? (
        <div className="cal-list__empty" data-testid="cal-list-empty">
          <p className="cal-list__empty-title">{t("calendar.list.empty")}</p>
          <p className="muted">{t("calendar.slotHint")}</p>
          <Button type="button" onClick={onCreate} disabled={!canCreate}>{t("calendar.create")}</Button>
        </div>
      ) : (
        <ol className="cal-list__items">
          {bookings.map((r) => {
            const state = stateOf(r);
            const startSeat = onStart ? startSeatOf(r) : null;
            const busy = busyId === r.id;
            const phone = formatArmenianPhone(r.contact_phone);
            const who = reservationWho(r);
            return (
              <li key={r.id} className={`cal-item cal-item--${r.source}${r.status === "finished" ? " is-finished" : ""}`} data-testid="cal-item" data-booking-id={r.id}>
                <div className="cal-item__top">
                  <span className="cal-item__time">{windowOf(r)}</span>
                  <span className="cal-item__seat">{seats.labelsOf(r.place_ids)}</span>
                  <StatusChip tone={state.tone} label={t(state.key)} className="cal-item__state" />
                </div>
                <div className="cal-item__who">
                  <span className={who ? "cal-item__name" : "cal-item__name muted"}>{who ?? t("reserve.noName")}</span>
                  {r.contact_phone && <a className="cal-item__phone" href={telHref(r.contact_phone)}>{phone}</a>}
                  <span className="cal-item__source muted">
                    {t(r.source === "guest" ? "calendar.sourceShort.guest" : "calendar.sourceShort.staff")}
                  </span>
                </div>
                {(startSeat !== null || (r.editable && r.source === "staff") || isCancellable(r)) && (
                  <div className="cal-item__actions">
                    {startSeat !== null && onStart && (
                      <Button type="button" onClick={() => onStart(startSeat, r.id)} disabled={busy} data-testid="cal-item-start">{t("action.start")}</Button>
                    )}
                    {r.editable && r.source === "staff" && (
                      <Button type="button" variant="secondary" onClick={() => onEdit(r)} disabled={busy} data-testid="cal-item-edit">{t("action.edit")}</Button>
                    )}
                    {isCancellable(r) && (
                      <Button
                        type="button"
                        variant="secondary"
                        className="is-danger"
                        onClick={() => cancel(r)}
                        disabled={busy}
                        title={t("reserve.cancel")}
                        data-testid="cal-item-cancel"
                      >
                        {t("reserve.cancelShort")}
                      </Button>
                    )}
                  </div>
                )}
                {error?.id === r.id && <div className="error" role="alert">{renderText(error.text, t)}</div>}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
};

export default DayBookingsList;
