import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { useLang } from "@/i18n/LanguageContext";

/** One seat that ended owing for extra time — the server's figure. */
export interface UnpaidNotice {
  sessionId: number;
  /** "№4 · Playstation 5", or the seat's own name. */
  seat: string;
  amount: number;
}

interface Props {
  notices: readonly UnpaidNotice[];
  onDismiss: (sessionId: number) => void;
}

/**
 * The warning a seat ending with extra time NOT paid raises (2026-11-07,
 * owner): yellow, animated, readable across the room — which seat, why, and
 * how much. One at a time, oldest first; a second seat waits its turn rather
 * than replace the first. The sound is the caller's (it rings once per seat,
 * as the notice is queued); the amount is always the server's.
 */
const UnpaidAlert = ({ notices, onDismiss }: Props) => {
  const { t, money } = useLang();
  const current = notices[0];
  if (!current) return null;

  return (
    <Modal open onClose={() => onDismiss(current.sessionId)}>
      <div className="card unpaid-alert" role="alertdialog" aria-labelledby="unpaid-alert-title" data-testid="unpaid-alert">
        <div className="unpaid-alert__badge" aria-hidden>!</div>
        <h2 id="unpaid-alert-title" className="unpaid-alert__seat">{current.seat}</h2>
        <p className="unpaid-alert__why">{t("session.unpaid.alertWhy")}</p>
        <div className="unpaid-alert__amount" data-testid="unpaid-alert-amount">{money(current.amount)}</div>
        <p className="unpaid-alert__hint">{t("session.unpaid.alertHint")}</p>
        {notices.length > 1 && (
          <span className="unpaid-alert__more">{t("session.unpaid.alertMore").replace("{0}", String(notices.length - 1))}</span>
        )}
        <Button onClick={() => onDismiss(current.sessionId)} data-testid="unpaid-alert-ok">{t("session.unpaid.alertOk")}</Button>
      </div>
    </Modal>
  );
};

export default UnpaidAlert;
