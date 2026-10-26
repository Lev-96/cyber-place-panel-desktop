import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { formatApiError } from "@/api/errors";
import { useAuth } from "@/auth/AuthContext";
import { useLang } from "@/i18n/LanguageContext";
import { fmt } from "@/i18n/translations";
import { shiftRepository } from "@/repositories/ShiftRepository";
import { centsOf, kindOf, parseCents, shiftAmount, toAmount } from "@/shifts/cash";
import ShiftReportView from "@/components/shifts/ShiftReportView";
import type { IShift, IShiftReport, IShiftWithReport } from "@/types/shifts";
import { useRef, useState } from "react";

/**
 * Closing the shift (2026-10-19): everything that will be recorded, shown
 * before it is.
 *
 * The report on top is the live one the screen already holds; the counted
 * cash is typed; the difference against the expected cash is shown as it is
 * typed — in exact cents, and only as a preview. The server computes the
 * figure that is recorded, from the same two amounts, and refuses a
 * non-zero difference with no reason; the reason box turns required here for
 * the same rule, so the refusal is never a surprise.
 *
 * One press, one request: the button is disabled while it is on the wire. The
 * server is the real guard — a second close returns the first's result.
 */
interface Props {
  shift: IShift;
  report: IShiftReport;
  onClose: () => void;
  onClosed: (result: IShiftWithReport & { already_closed: boolean }) => void;
}

const CloseShiftDialog = ({ shift, report, onClose, onClosed }: Props) => {
  const { t, money } = useLang();
  const { user } = useAuth();
  const [counted, setCounted] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  /**
   * Set synchronously on the first press. `busy` disables the button only
   * after a re-render, and three clicks in a row arrive before one: measured,
   * they sent three closes.
   */
  const sending = useRef(false);

  const countedCents = parseCents(counted);
  const differenceCents = countedCents === null ? null : countedCents - centsOf(report.cash.expected);
  const kind = differenceCents === null ? null : kindOf(differenceCents);
  const needsReason = kind !== null && kind !== "none";
  const canConfirm = !busy && countedCents !== null && (!needsReason || notes.trim() !== "");

  const confirm = async () => {
    if (!canConfirm || countedCents === null || sending.current) return;
    sending.current = true;
    setBusy(true);
    setErr(null);
    try {
      onClosed(await shiftRepository.close(shift.id, toAmount(countedCents), notes.trim()));
    } catch (e) {
      setErr(formatApiError(e));
      sending.current = false;
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={busy ? undefined : onClose}>
      <div className="card" style={{ width: 640, maxWidth: "94vw", maxHeight: "88vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
        <h2 style={{ margin: 0 }}>{t("shift.closeTitle")}</h2>

        <ShiftReportView shift={shift} report={report} viewerId={user?.id ?? null} />

        <div className="card col" style={{ gap: 10 }}>
          <Input
            label={t("shift.countedCash")}
            requiredMark
            inputMode="decimal"
            autoFocus
            value={counted}
            onChange={(e) => { setCounted(e.target.value); setErr(null); }}
            disabled={busy}
            data-testid="shift-counted"
          />
          {counted !== "" && countedCents === null && <span className="error" style={{ fontSize: 12 }}>{t("shift.countedInvalid")}</span>}

          {differenceCents !== null && kind !== null && (
            <div
              className="row-between"
              data-testid="shift-difference-preview"
              style={{ color: kind === "shortage" ? "var(--color-danger)" : undefined }}
            >
              <strong>{t("shift.difference")}: {t(`shift.kind.${kind}`)}</strong>
              <strong>{shiftAmount(money, toAmount(differenceCents))}</strong>
            </div>
          )}

          <Input
            label={needsReason ? t("shift.reason") : t("shift.notes")}
            requiredMark={needsReason}
            value={notes}
            maxLength={2000}
            onChange={(e) => { setNotes(e.target.value); setErr(null); }}
            disabled={busy}
            data-testid="shift-notes"
          />
          {needsReason && notes.trim() === "" && <span className="muted" style={{ fontSize: 12 }}>{t("shift.reasonRequired")}</span>}

          {user?.name && <span className="muted" style={{ fontSize: 13 }}>{fmt(t("shift.closingAs"), user.name)}</span>}
          <span className="muted" style={{ fontSize: 12 }}>{t("shift.finalNote")}</span>
        </div>

        {err && <div className="error" style={{ whiteSpace: "pre-line" }}>{err}</div>}

        <div className="row-between">
          <Button variant="secondary" onClick={onClose} disabled={busy}>{t("action.cancel")}</Button>
          <Button onClick={() => void confirm()} disabled={!canConfirm} data-testid="shift-confirm-close">
            {busy ? t("shift.closing") : t("shift.confirm")}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default CloseShiftDialog;
