import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { useLang } from "@/i18n/LanguageContext";
import { fmt } from "@/i18n/translations";
import { bookingRepository } from "@/repositories/BookingRepository";
import { notify } from "@/ui/notify";
import { FormEvent, useState } from "react";
import DurationInput from "./DurationInput";
import { draftMinutes, draftOf, type DurationDraft } from "./durationModel";

/** The server's bounds (`PlaceReservationController`). */
const MIN_HOLD = 15;
const MAX_HOLD = 300;

interface Props {
  placeId: number;
  /** "№4", as the board names the seat. */
  seat: string;
  onClose: () => void;
  onReserved: () => void;
}

/**
 * Reserve a free seat for a player who phoned (2026-11-07, owner): who is
 * coming, their phone, and how long to hold the seat — an hour unless said
 * otherwise. The booking is the server's; a refusal (the seat taken
 * meanwhile, outside working hours) is its sentence, shown here.
 */
const ReserveSeatDialog = ({ placeId, seat, onClose, onReserved }: Props) => {
  const { t } = useLang();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [hold, setHold] = useState<DurationDraft>(() => draftOf(60));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const minutes = draftMinutes(hold, MAX_HOLD);
  const holdValid = minutes !== null && minutes >= MIN_HOLD;
  const phoneValid = phone.trim() === "" || /^\+?[0-9 ()-]{5,31}$/.test(phone.trim());
  const ready = name.trim() !== "" && phoneValid && holdValid && !busy;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ready || minutes === null) return;
    setBusy(true);
    setErr(null);
    try {
      await bookingRepository.reserve(placeId, {
        name: name.trim(),
        ...(phone.trim() !== "" ? { phone: phone.trim() } : {}),
        minutes,
      });
      notify.message("success", fmt(t("reserve.done"), seat));
      onReserved();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : String(e2));
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={busy ? () => {} : onClose}>
      <form className="card col reserve-dialog" style={{ gap: 14 }} onSubmit={submit} data-testid="reserve-dialog">
        <h2 style={{ margin: 0 }}>{fmt(t("reserve.title"), seat)}</h2>
        <label className="col" style={{ gap: 4 }}>
          <span className="label">{t("reserve.name")} *</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} aria-label={t("reserve.name")} autoFocus />
        </label>
        <label className="col" style={{ gap: 4 }}>
          <span className="label">{t("reserve.phone")}</span>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" maxLength={32} placeholder="+374 ..." aria-label={t("reserve.phone")} />
          {!phoneValid && <span className="error" style={{ fontSize: 12 }}>{t("reserve.phoneInvalid")}</span>}
        </label>
        <div className="col" style={{ gap: 4 }}>
          <span className="label">{t("reserve.hold")}</span>
          <DurationInput value={hold} onChange={setHold} label={t("reserve.hold")} maxMinutes={MAX_HOLD} invalidText={t("reserve.holdInvalid")} testId="reserve-hold" />
          <span className="muted" style={{ fontSize: 12 }}>{t("reserve.holdHint")}</span>
        </div>
        {err && <div className="error">{err}</div>}
        <div className="row-between">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>{t("action.cancel")}</Button>
          <Button type="submit" disabled={!ready} data-testid="reserve-confirm">{t("reserve.confirm")}</Button>
        </div>
      </form>
    </Modal>
  );
};

export default ReserveSeatDialog;
