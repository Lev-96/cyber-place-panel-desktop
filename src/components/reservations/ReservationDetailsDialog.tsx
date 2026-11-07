import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { isCancellable, reservationWho, type StaffReservation } from "@/domain/StaffReservation";
import { formatDate } from "@/i18n/dates";
import { useLang } from "@/i18n/LanguageContext";
import { renderText } from "@/i18n/localizedText";
import { formatArmenianPhone } from "@/utils/armenianPhone";
import { telHref, windowOf, type SeatNames } from "./calendarText";
import { useCancelReservation } from "./useCancelReservation";

interface Props {
  reservation: StaffReservation;
  seats: SeatNames;
  onClose: () => void;
  /** «Изменить»: offered only when the server says the row is `editable` (a staff reservation not yet begun). */
  onEdit: (reservation: StaffReservation) => void;
  /** After a cancel the server accepted. */
  onCancelled: () => void;
  /** «Старт»: given only when the calendar offers it for this booking (`startSeatOf`). */
  onStart?: () => void;
}

/**
 * One reservation, opened from its block on the timeline (2026-11-07): seat,
 * window, who, phone (a `tel:` link), status, where it was made. A staff
 * reservation the server marks `editable` can be changed; any reservation
 * still awaiting its player can be cancelled (asked first); one due soon can
 * be started. An app guest's booking is never edited here: rescheduling it
 * is the player's, from the app.
 */
const ReservationDetailsDialog = ({ reservation: r, seats, onClose, onEdit, onCancelled, onStart }: Props) => {
  const { t } = useLang();
  const { cancel, busyId, error } = useCancelReservation(seats, onCancelled);
  const busy = busyId === r.id;
  const phone = formatArmenianPhone(r.contact_phone);

  const rows: [string, React.ReactNode][] = [
    [t("reserve.seat"), seats.labelsOf(r.place_ids)],
    [t("calendar.details.time"), `${formatDate(r.start)} ${windowOf(r)}`],
    [t("reserve.name"), reservationWho(r) ?? t("reserve.noName")],
    [t("reserve.phone"), r.contact_phone ? <a href={telHref(r.contact_phone)}>{phone}</a> : "-"],
    [t("calendar.details.status"), t(`bookingDetails.status.${r.status}`)],
    [t("calendar.details.source"), t(r.source === "staff" ? "calendar.source.staff" : "calendar.source.guest")],
  ];

  return (
    <Modal open onClose={busy ? () => {} : onClose}>
      <div className="card reservation-details" data-testid="reservation-details">
        <h2 className="reservation-form__title">{t("calendar.details.title")}</h2>
        <dl className="reservation-details__list">
          {rows.map(([k, v]) => (
            <div key={k} className="reservation-details__row">
              <dt className="muted">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        {error && <div className="error" role="alert">{renderText(error.text, t)}</div>}
        <div className="reservation-details__actions">
          {onStart && (
            <Button type="button" onClick={onStart} disabled={busy} data-testid="reservation-start">{t("action.start")}</Button>
          )}
          {r.editable && r.source === "staff" && (
            <Button type="button" variant="secondary" onClick={() => onEdit(r)} disabled={busy} data-testid="reservation-edit">{t("action.edit")}</Button>
          )}
          {isCancellable(r) && (
            <Button type="button" variant="secondary" className="is-danger" onClick={() => cancel(r)} disabled={busy} data-testid="reservation-cancel">{t("reserve.cancel")}</Button>
          )}
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>{t("action.close")}</Button>
        </div>
      </div>
    </Modal>
  );
};

export default ReservationDetailsDialog;
