import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { useLang } from "@/i18n/LanguageContext";
import { fmt } from "@/i18n/translations";
import { sessionRepository } from "@/repositories/SessionRepository";
import type { ISessionApi } from "@/types/sessions";
import { useEffect, useState } from "react";
import { sessionItemsTotalAt, sessionJoysticksTotalAt, sessionTimeCostAt } from "./sessionAmount";

/**
 * "Reset the counter" on a running seat (2026-11-05, owner): the player sat
 * down and said after a few minutes that he has to go.
 *
 * Says what is about to happen before it does: the time's figure, live (the
 * same mirror the card ticks with), that the seat keeps running from 0, that
 * goods and pads stay on the bill, and that it goes into the history. What is
 * actually waived is the SERVER's figure at its own instant
 * (`SessionOptionsService::resetTime`) and is what the history records; the
 * capability, the branch and the lock are the server's too. Nothing here
 * prices anything.
 */
interface Props {
  session: ISessionApi;
  /** The seat's number, for the title. */
  seat: string;
  onClose: () => void;
  /** The server's answer: the session as it now is, and what THIS reset waived. */
  onDone: (updated: ISessionApi, waived: number) => void;
}

const ResetTimeDialog = ({ session, seat, onClose, onDone }: Props) => {
  const { t, money } = useLang();
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const time = sessionTimeCostAt(session, now);
  const keeps = sessionItemsTotalAt(session, now) + sessionJoysticksTotalAt(session, now) > 0;

  const reset = async () => {
    setBusy(true);
    setError(null);
    const waivedBefore = Number(session.time_waived_total ?? 0);
    try {
      const r = await sessionRepository.resetTime(session.id);
      // The server's own figure; a backend without it: the totals' difference.
      onDone(r.session, r.waived ?? Number(r.session.time_waived_total ?? 0) - waivedBefore);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={busy ? undefined : onClose}>
      <div className="card reset-dialog" data-testid="reset-dialog">
        <h2 className="reset-dialog__title">{fmt(t("session.reset.title"), seat)}</h2>
        <div className="reset-dialog__amount">
          <span className="muted">{t("session.reset.now")}</span>
          <strong data-testid="reset-amount">{money(time)}</strong>
          <span className="reset-dialog__arrow" aria-hidden="true">→</span>
          <strong className="reset-dialog__zero">{money(0)}</strong>
        </div>
        <p className="reset-dialog__text">{t("session.reset.explain")}</p>
        {keeps && <p className="reset-dialog__text reset-dialog__keeps">{t("session.reset.keepsGoods")}</p>}
        <p className="muted reset-dialog__note">{t("session.reset.inHistory")}</p>
        {error && <div className="error" role="alert">{error}</div>}
        <div className="row-between">
          <Button variant="secondary" onClick={onClose} disabled={busy}>{t("action.cancel")}</Button>
          <Button variant="secondary" className="is-danger" onClick={() => { void reset(); }} disabled={busy || time <= 0} data-testid="reset-confirm">
            {busy ? "…" : t("session.reset.confirm")}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ResetTimeDialog;
