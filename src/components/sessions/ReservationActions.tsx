import Button from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { useLang } from "@/i18n/LanguageContext";
import { fmt } from "@/i18n/translations";
import { bookingRepository } from "@/repositories/BookingRepository";
import { notify } from "@/ui/notify";

interface Props {
  bookingId: number;
  /** "№4", as the board names the seat. */
  seat: string;
  /** The player came: open the ordinary start, carrying this reservation. */
  onArrived: () => void;
  disabled?: boolean;
}

/**
 * A reserved seat's two actions (2026-11-07): «Пришёл» — the ordinary start,
 * carrying the reservation — and «Отменить бронь», asked first and done by
 * the existing booking cancel, which frees the seat on every client.
 */
const ReservationActions = ({ bookingId, seat, onArrived, disabled = false }: Props) => {
  const { t } = useLang();
  const ask = useConfirm();

  const cancel = async () => {
    if (!(await ask(fmt(t("reserve.cancelConfirm"), seat), { destructive: true }))) return;
    try {
      await bookingRepository.cancel(bookingId);
      notify.message("success", fmt(t("reserve.cancelled"), seat));
    } catch (e) {
      notify.message("error", e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="session-card__reserve-actions">
      <Button onClick={onArrived} disabled={disabled} className="session-card__start" data-action="arrived">
        {t("reserve.arrived")}
      </Button>
      <Button variant="secondary" className="is-danger" onClick={() => { void cancel(); }} data-action="cancel-reservation">
        {t("reserve.cancel")}
      </Button>
    </div>
  );
};

export default ReservationActions;
