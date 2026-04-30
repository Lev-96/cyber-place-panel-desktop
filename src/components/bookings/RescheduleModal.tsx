import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import { useLang } from "@/i18n/LanguageContext";
import { apiRescheduleBooking } from "@/api/bookings";
import { FormEvent, useState } from "react";

interface Props {
  bookingId: number;
  currentMinutes?: number;
  onClose: () => void;
  onDone: () => void;
}

const RescheduleModal = ({ bookingId, currentMinutes, onClose, onDone }: Props) => {
  const { t } = useLang();
  const [minutes, setMinutes] = useState(String(currentMinutes ?? 0));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const n = Number(minutes);
    if (!Number.isFinite(n)) return setErr(t("booking.reschedEnterNumber"));
    setBusy(true); setErr(null);
    try { await apiRescheduleBooking(bookingId, n); onDone(); }
    catch (e) { setErr(e instanceof Error ? e.message : t("form.errors.failed")); }
    finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose}>
      <form className="card" style={{ width: 380, maxWidth: "90vw", display: "flex", flexDirection: "column", gap: 14 }} onSubmit={submit}>
        <h2 style={{ margin: 0 }}>{t("booking.rescheduleId")} #{bookingId}</h2>
        <Input label={t("booking.rescheduleMinutes")} type="number" value={minutes} onChange={(e) => setMinutes(e.target.value)} required autoFocus />
        <span className="muted" style={{ fontSize: 11 }}>{t("booking.rescheduleHint")}</span>
        {err && <div className="error">{err}</div>}
        <div className="row-between">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>{t("action.cancel")}</Button>
          <Button disabled={busy}>{busy ? "…" : t("booking.reschedule")}</Button>
        </div>
      </form>
    </Modal>
  );
};

export default RescheduleModal;
