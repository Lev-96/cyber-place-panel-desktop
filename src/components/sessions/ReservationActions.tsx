import { useConfirm } from "@/components/ui/ConfirmProvider";
import { useLang } from "@/i18n/LanguageContext";
import { fmt } from "@/i18n/translations";
import { bookingRepository } from "@/repositories/BookingRepository";
import { notify } from "@/ui/notify";
import { CardFootAction } from "./SessionCard";

interface Props {
  bookingId: number;
  /** "№4", as the board names the seat. */
  seat: string;
  /** The player came: open the ordinary start, carrying this reservation. */
  onStart: () => void;
  disabled?: boolean;
  /** Start's word, as on a free seat (a locked start says why). */
  startLabel: string;
  /** Why Start cannot run (an offline device), as its tooltip. */
  startHint?: string;
}

/**
 * A reserved seat's two actions (2026-11-07): Start — the player arrived, the
 * ordinary start carrying the reservation, which the server checks and links
 * — and «Отменить бронь», asked first and done by the existing booking
 * cancel, which frees the seat on every client.
 */
const ReservationActions = ({ bookingId, seat, onStart, disabled = false, startLabel, startHint }: Props) => {
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
      <CardFootAction
        icon="start"
        label={startLabel}
        hint={startHint}
        onClick={onStart}
        disabled={disabled}
        className="session-card__start"
        data-action="start"
      />
      <CardFootAction
        icon="cancel-reservation"
        variant="secondary"
        label={t("reserve.cancelShort")}
        fullLabel={t("reserve.cancel")}
        className="is-danger"
        onClick={() => { void cancel(); }}
        data-action="cancel-reservation"
      />
    </div>
  );
};

export default ReservationActions;
