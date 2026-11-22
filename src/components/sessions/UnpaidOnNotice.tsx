import { useAuth } from "@/auth/AuthContext";
import { useLang } from "@/i18n/LanguageContext";
import { keyValueStore } from "@/infrastructure/KeyValueStore";
import { useEffect, useRef, useState } from "react";

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
  /**
   * Which notice this is («start», «goods»): each is shown to a person ONCE —
   * the first time — and never again (2026-11-22, owner), remembered per
   * person (`u{id}:cp.unpaidOnNotice.{kind}`), like their language.
   */
  kind: "start" | "goods";
}

/** The per-person key that says this notice was already seen. */
export const unpaidNoticeSeenKey = (userId: number, kind: "start" | "goods"): string => `u${userId}:cp.unpaidOnNotice.${kind}`;

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
const UnpaidOnNotice = ({ active, hint, testId = "unpaid-on-notice", kind }: Props) => {
  const { t } = useLang();
  const { user } = useAuth();
  const [phase, setPhase] = useState<"waiting" | "checking" | "shown" | "done">("waiting");

  // Asked once per dialog: the store's answer decides, and a later render
  // (the phase moving on) never asks again or drops that answer.
  const asked = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    if (!active || asked.current) return;
    asked.current = true;
    const userId = user?.id;
    // Nobody to remember it for: say it, as before.
    if (userId === undefined || userId === null) {
      setPhase("shown");
      return;
    }
    setPhase("checking");
    const key = unpaidNoticeSeenKey(userId, kind);
    keyValueStore.get<boolean>(key)
      .then((seen) => {
        if (!mounted.current) return;
        if (seen === true) {
          setPhase("done");
          return;
        }
        setPhase("shown");
        // Remembered as soon as it is shown: never again for this person.
        void keyValueStore.set(key, true).catch(() => undefined);
      })
      // The store unreadable: say it rather than stay silent.
      .catch(() => { if (mounted.current) setPhase("shown"); });
  }, [active, user?.id, kind]);

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
