import { apiDeleteBooking } from "@/api/bookings";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import { useLang } from "@/i18n/LanguageContext";
import { FormEvent, useState } from "react";

interface Props {
  bookingId: number;
  onClose: () => void;
  onDone: () => void;
}

const CancelReasonModal = ({ bookingId, onClose, onDone }: Props) => {
  const { t } = useLang();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try { await apiDeleteBooking(bookingId); onDone(); }
    catch (e) { setErr(e instanceof Error ? e.message : t("form.errors.failed")); }
    finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose}>
      <form className="card" style={{ width: 420, maxWidth: "90vw", display: "flex", flexDirection: "column", gap: 14 }} onSubmit={submit}>
        <h2 style={{ margin: 0 }}>{t("booking.cancelTitleId")} #{bookingId}</h2>
        <Input label={t("booking.cancelReasonField")} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
        <span className="muted" style={{ fontSize: 11 }}>{t("booking.cancelReasonHint")}</span>
        {err && <div className="error">{err}</div>}
        <div className="row-between">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>{t("booking.keep")}</Button>
          <Button disabled={busy} style={{ background: "#ef4444", color: "#fff" }}>{busy ? t("booking.cancelling") : t("booking.cancelDo")}</Button>
        </div>
      </form>
    </Modal>
  );
};

export default CancelReasonModal;
