import { useConfirm } from "@/components/ui/ConfirmProvider";
import type { StaffReservation } from "@/domain/StaffReservation";
import { useLang } from "@/i18n/LanguageContext";
import { textLiteral, type LocalizedText } from "@/i18n/localizedText";
import { fmt } from "@/i18n/translations";
import { bookingRepository } from "@/repositories/BookingRepository";
import { notify } from "@/ui/notify";
import { useState } from "react";
import type { SeatNames } from "./calendarText";

/**
 * «Отменить бронь» from the calendar, for the day's list and the details
 * dialog alike: asked first (destructive), then `bookingRepository.cancel`;
 * the toast on success, the server's reason on a refusal. `busyId` is the
 * booking being cancelled, so only its buttons wait.
 */
export const useCancelReservation = (seats: SeatNames, onCancelled: (r: StaffReservation) => void) => {
  const { t } = useLang();
  const confirm = useConfirm();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<{ id: number; text: LocalizedText } | null>(null);

  const cancel = async (r: StaffReservation) => {
    const seat = seats.labelsOf(r.place_ids);
    const ok = await confirm(fmt(t("reserve.cancelConfirm"), seat), { destructive: true, confirmLabel: t("reserve.cancel"), cancelLabel: t("action.no") });
    if (!ok) return;
    setBusyId(r.id);
    setError(null);
    try {
      await bookingRepository.cancel(r.id);
      notify.message("success", fmt(t("reserve.cancelled"), seat));
      onCancelled(r);
    } catch (e) {
      setError({ id: r.id, text: textLiteral(e instanceof Error ? e.message : String(e)) });
    } finally {
      setBusyId(null);
    }
  };

  return { cancel, busyId, error };
};
