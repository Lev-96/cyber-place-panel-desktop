import Button from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import Modal from "@/components/ui/Modal";
import { isCancellable, reservationWho, type StaffReservation } from "@/domain/StaffReservation";
import { formatDate } from "@/i18n/dates";
import { useLang } from "@/i18n/LanguageContext";
import { renderText, textLiteral, type LocalizedText } from "@/i18n/localizedText";
import { fmt } from "@/i18n/translations";
import { bookingRepository } from "@/repositories/BookingRepository";
import { notify } from "@/ui/notify";
import { formatArmenianPhone } from "@/utils/armenianPhone";
import { useState } from "react";
import { windowOf, type SeatNames } from "./calendarText";

interface Props {
  reservation: StaffReservation;
  seats: SeatNames;
  onClose: () => void;
  /** «Изменить»: offered only when the server says the row is `editable` (a staff reservation not yet begun). */
  onEdit: (reservation: StaffReservation) => void;
  /** After a cancel the server accepted. */
  onCancelled: () => void;
}

/**
 * One reservation, read from the calendar (2026-11-07): seat, window, who,
 * phone (a `tel:` link), status, where it was made. A staff reservation the
 * server marks `editable` can be changed; any reservation still awaiting its
 * player can be cancelled (asked first). An app guest's booking is view and
 * cancel only: rescheduling it is the player's, from the app.
 */
const ReservationDetailsDialog = ({ reservation: r, seats, onClose, onEdit, onCancelled }: Props) => {
  const { t } = useLang();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<LocalizedText | null>(null);
  const seat = seats.labelsOf(r.place_ids);
  const phone = formatArmenianPhone(r.contact_phone);

  const cancel = async () => {
    const ok = await confirm(fmt(t("reserve.cancelConfirm"), seat), { destructive: true, confirmLabel: t("reserve.cancel"), cancelLabel: t("action.no") });
    if (!ok) return;
    setBusy(true);
    setErr(null);
    try {
      await bookingRepository.cancel(r.id);
      notify.message("success", fmt(t("reserve.cancelled"), seat));
      onCancelled();
    } catch (e) {
      setErr(textLiteral(e instanceof Error ? e.message : String(e)));
      setBusy(false);
    }
  };

  const rows: [string, React.ReactNode][] = [
    [t("reserve.seat"), seat],
    [t("calendar.details.time"), `${formatDate(r.start)} ${windowOf(r)}`],
    [t("reserve.name"), reservationWho(r) ?? t("reserve.noName")],
    [t("reserve.phone"), r.contact_phone ? <a href={`tel:${r.contact_phone.replace(/[^+0-9]/g, "")}`}>{phone}</a> : "-"],
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
        {err && <div className="error" role="alert">{renderText(err, t)}</div>}
        <div className="reservation-details__actions">
          {r.editable && r.source === "staff" && (
            <Button type="button" onClick={() => onEdit(r)} disabled={busy} data-testid="reservation-edit">{t("action.edit")}</Button>
          )}
          {isCancellable(r) && (
            <Button type="button" variant="secondary" className="is-danger" onClick={cancel} disabled={busy} data-testid="reservation-cancel">{t("reserve.cancel")}</Button>
          )}
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>{t("action.close")}</Button>
        </div>
      </div>
    </Modal>
  );
};

export default ReservationDetailsDialog;
