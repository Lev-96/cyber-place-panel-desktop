import { useLang } from "@/i18n/LanguageContext";
import { useEffect, useState } from "react";

interface Props {
  /**
   * «Не оплачено» is on and its switch is on screen. The notice shows the
   * FIRST time this is true and never again for this dialog (its own state:
   * one per dialog open, since the dialog unmounts on close).
   */
  active: boolean;
  /** What «on» means here, one short sentence. */
  hint: string;
  testId?: string;
}

/**
 * «Не оплачено» is ON by default (2026-11-22, owner) — so it is SAID, large,
 * the moment the dialog opens with it on: an overlay inside the dialog's card
 * that blurs the form under it. Any click or any key takes it away and the
 * cashier carries on; the key itself is never swallowed, so Escape still
 * closes the dialog and Tab still moves focus (the Modal's own rules stand).
 * A click on it lands on it, not on the control beneath.
 *
 * Not a Modal: it is part of the dialog, sits in the card (`position:
 * relative` from `.dialog-tone`), and is announced (`role="alert"`).
 */
const UnpaidOnNotice = ({ active, hint, testId = "unpaid-on-notice" }: Props) => {
  const { t } = useLang();
  const [phase, setPhase] = useState<"waiting" | "shown" | "done">("waiting");

  useEffect(() => {
    if (active && phase === "waiting") setPhase("shown");
  }, [active, phase]);

  useEffect(() => {
    if (phase !== "shown") return undefined;
    // Capture, and never preventDefault/stopPropagation: the key still does
    // what it does (Escape closes the dialog, Tab moves on).
    const dismiss = () => setPhase("done");
    window.addEventListener("keydown", dismiss, true);
    return () => window.removeEventListener("keydown", dismiss, true);
  }, [phase]);

  if (phase !== "shown") return null;

  return (
    <div
      className="unpaid-on-notice"
      role="alert"
      aria-live="assertive"
      data-testid={testId}
      onClick={(e) => { e.stopPropagation(); setPhase("done"); }}
    >
      <div className="unpaid-on-notice__box">
        <span className="unpaid-on-notice__badge" aria-hidden>!</span>
        <strong className="unpaid-on-notice__title">{t("unpaidOn.title")}</strong>
        <p className="unpaid-on-notice__hint">{hint}</p>
        <span className="unpaid-on-notice__dismiss">{t("unpaidOn.dismiss")}</span>
      </div>
    </div>
  );
};

export default UnpaidOnNotice;
