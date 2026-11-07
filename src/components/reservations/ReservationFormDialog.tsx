import Button from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import Input from "@/components/ui/Input";
import MaskedDateInput from "@/components/ui/MaskedDateInput";
import Modal from "@/components/ui/Modal";
import ClockInput from "@/components/sessions/ClockInput";
import DurationInput from "@/components/sessions/DurationInput";
import { clockOfDraft, draftMinutes, draftOf, type ClockDraft, type DurationDraft } from "@/components/sessions/durationModel";
import type { Booking } from "@/domain/Booking";
import type { StaffReservation } from "@/domain/StaffReservation";
import { formatDate } from "@/i18n/dates";
import { useLang } from "@/i18n/LanguageContext";
import { renderText, textLiteral, type LocalizedText } from "@/i18n/localizedText";
import { fmt } from "@/i18n/translations";
import { bookingRepository } from "@/repositories/BookingRepository";
import { notify } from "@/ui/notify";
import { formatArmenianPhone, maskArmenianPhone } from "@/utils/armenianPhone";
import { FormEvent, useMemo, useState } from "react";
import { hm, parseYmd, roundUpToStep, ymd } from "./calendarModel";
import {
  DEFAULT_MINUTES, MAX_MINUTES, MIN_MINUTES, createBody, editPatch, isNameValid, isPhoneValid, type ReservationDraft,
} from "./reservationForm";

/** A seat as the form offers it: its id and how the board names it ("№4"). */
export interface ReservationSeat {
  id: number;
  label: string;
}

export type ReservationFormMode =
  /** A new reservation on `placeId`, from `start` (default: now, rounded up to the next 5 minutes). */
  | { kind: "create"; placeId: number; start?: Date }
  /** An existing staff reservation the server says is `editable`. */
  | { kind: "edit"; reservation: StaffReservation };

interface Props {
  /** The seats it may be put on; the mode's seat is preselected. */
  places: readonly ReservationSeat[];
  mode: ReservationFormMode;
  onClose: () => void;
  /** After the server accepted it (the toast is already shown). */
  onSaved: (booking: Booking) => void;
}

const clockDraftOf = (hhmm: string): ClockDraft => ({ hours: hhmm.slice(0, 2), minutes: hhmm.slice(3, 5) });

const initialOf = (mode: ReservationFormMode) => {
  if (mode.kind === "edit") {
    const r = mode.reservation;
    return {
      placeId: r.place_ids[0] ?? 0,
      date: r.booking_date,
      start: clockDraftOf(r.start_time),
      hold: draftOf(r.duration_minutes),
      name: r.contact_name ?? "",
      phone: formatArmenianPhone(r.contact_phone),
    };
  }
  const start = mode.start ?? roundUpToStep(new Date());
  return { placeId: mode.placeId, date: ymd(start), start: clockDraftOf(hm(start)), hold: draftOf(DEFAULT_MINUTES), name: "", phone: "" };
};

/**
 * Reserve a seat for a player who phoned, or change such a reservation
 * (2026-11-07, owner): which seat, which day, from when, for how long, and,
 * if given, who and their phone.
 *
 * The client only says a typo at once (`reservationForm`); every other answer
 * (the seat taken meanwhile, outside working hours, in the past, not editable
 * any more) is the server's sentence, shown here with the form kept. A move
 * (seat, day, start or length) is confirmed first; a name or phone alone is
 * not. The «Забронировано» / «Бронь изменена» toast is the ONLY one for a
 * reservation staff make: the realtime event for it is silent.
 */
const ReservationFormDialog = ({ places, mode, onClose, onSaved }: Props) => {
  const { t } = useLang();
  const confirm = useConfirm();
  const initial = useMemo(() => initialOf(mode), [mode]);
  const [placeId, setPlaceId] = useState(initial.placeId);
  const [date, setDate] = useState(initial.date);
  const [start, setStart] = useState<ClockDraft>(initial.start);
  const [hold, setHold] = useState<DurationDraft>(initial.hold);
  const [name, setName] = useState(initial.name);
  const [phone, setPhone] = useState(initial.phone);
  const [phoneLeft, setPhoneLeft] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<LocalizedText | null>(null);

  const minutes = draftMinutes(hold, MAX_MINUTES);
  const startTime = clockOfDraft(start);
  const nameValid = isNameValid(name);
  const phoneValid = isPhoneValid(phone);
  const seatLabel = (id: number) => places.find((p) => p.id === id)?.label ?? `#${id}`;

  const draft: ReservationDraft | null =
    minutes !== null && minutes >= MIN_MINUTES && startTime !== null && parseYmd(date) !== null && nameValid && phoneValid
      ? { placeId, date, startTime, minutes, name, phone }
      : null;
  const edit = mode.kind === "edit" && draft ? editPatch(mode.reservation, draft) : null;
  const ready = draft !== null && !busy && (edit === null || Object.keys(edit.patch).length > 0);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ready || draft === null) return;
    if (edit?.moves) {
      const question = fmt(t("reserve.moveConfirm"), seatLabel(draft.placeId), formatDate(parseYmd(draft.date)), draft.startTime);
      if (!(await confirm(question, { confirmLabel: t("reserve.move") }))) return;
    }
    setBusy(true);
    setErr(null);
    try {
      const booking = mode.kind === "edit" && edit
        ? await bookingRepository.updateReservation(mode.reservation.id, edit.patch)
        : await bookingRepository.reserve(draft.placeId, createBody(draft));
      notify.message("success", fmt(t(mode.kind === "edit" ? "reserve.updated" : "reserve.done"), seatLabel(draft.placeId)));
      onSaved(booking);
    } catch (e2) {
      setErr(textLiteral(e2 instanceof Error ? e2.message : String(e2)));
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={busy ? () => {} : onClose}>
      <form className="card reservation-form" onSubmit={submit} data-testid="reserve-dialog">
        <h2 className="reservation-form__title">{t(mode.kind === "edit" ? "reserve.titleEdit" : "reserve.titleNew")}</h2>

        <div className="reservation-form__row">
          <label className="reservation-form__field">
            <span className="label">{t("reserve.seat")}</span>
            <select className="input" value={placeId} onChange={(e) => setPlaceId(Number(e.target.value))} aria-label={t("reserve.seat")} disabled={busy}>
              {places.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </label>
          <div className="reservation-form__field">
            <span className="label">{t("reserve.date")}</span>
            <MaskedDateInput valueIso={date} onChangeIso={setDate} ariaLabel={t("reserve.date")} />
            {parseYmd(date) === null && <span className="error reservation-form__note">{t("reserve.dateInvalid")}</span>}
          </div>
        </div>

        <div className="reservation-form__row">
          <div className="reservation-form__field">
            <span className="label">{t("reserve.start")}</span>
            <ClockInput value={start} onChange={setStart} label={t("reserve.start")} invalidText={t("reserve.startInvalid")} disabled={busy} testId="reserve-start" />
          </div>
          <div className="reservation-form__field">
            <span className="label">{t("reserve.hold")}</span>
            <DurationInput value={hold} onChange={setHold} label={t("reserve.hold")} maxMinutes={MAX_MINUTES} invalidText={t("reserve.holdInvalid")} disabled={busy} testId="reserve-hold" />
          </div>
        </div>
        <span className="muted reservation-form__note">{t("reserve.holdHint")}</span>

        <label className="reservation-form__field">
          <span className="label">{t("reserve.name")} <span className="muted">({t("reserve.optional")})</span></span>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} aria-label={t("reserve.name")} autoFocus disabled={busy} />
          {!nameValid && <span className="error reservation-form__note">{t("reserve.nameInvalid")}</span>}
        </label>
        <label className="reservation-form__field">
          <span className="label">{t("reserve.phone")} <span className="muted">({t("reserve.optional")})</span></span>
          <Input
            value={phone}
            onChange={(e) => setPhone(maskArmenianPhone(e.target.value))}
            onBlur={() => setPhoneLeft(true)}
            inputMode="tel"
            maxLength={16}
            placeholder="077 777 777"
            aria-label={t("reserve.phone")}
            disabled={busy}
          />
          {!phoneValid && phoneLeft && <span className="error reservation-form__note">{t("reserve.phoneInvalid")}</span>}
        </label>

        {err && <div className="error" role="alert">{renderText(err, t)}</div>}
        <div className="row-between">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>{t("action.cancel")}</Button>
          <Button type="submit" disabled={!ready} data-testid="reserve-confirm">{t(mode.kind === "edit" ? "action.save" : "reserve.confirm")}</Button>
        </div>
      </form>
    </Modal>
  );
};

export default ReservationFormDialog;
