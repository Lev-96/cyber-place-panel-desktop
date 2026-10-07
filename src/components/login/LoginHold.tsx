import { useDeadline } from "@/hooks/useDeadline";
import { formatRemaining } from "@/i18n/duration";
import { useLang } from "@/i18n/LanguageContext";
import { useEffect, useRef } from "react";

export type HoldKind = "locked" | "throttled";

interface Props {
  kind: HoldKind;
  /** Seconds from the server's answer (`retry_after`). */
  seconds: number;
  /** `performance.now()` when that answer arrived. */
  startedAt: number;
  /** Once the time is up: the form may try again; the server decides. */
  onOver: () => void;
}

/**
 * "Sign-in is temporarily closed — try again in 49 min 32 s", counting down,
 * then "You can try to sign in again" (2026-10-07). Shared by the desktop and
 * the owner web. Counts from the server's "seconds left", against this
 * machine's monotonic clock, so a wrong system clock changes nothing. It
 * never says why, how many tries there were, or anything about the address.
 *
 * The live time is hidden from screen readers (it would be read every
 * second); they hear the state when it starts and when it is over.
 */
const LoginHold = ({ kind, seconds, startedAt, onOver }: Props) => {
  const { t } = useLang();
  const left = useDeadline(seconds, startedAt);
  const over = left === 0;
  const told = useRef(false);

  useEffect(() => {
    if (over && !told.current) {
      told.current = true;
      onOver();
    }
  }, [over, onOver]);

  if (over) {
    return (
      <div className="login-hold is-over" role="status">
        {t("login.hold.ready")}
      </div>
    );
  }

  return (
    <div className="login-hold" role="status">
      <div className="login-hold__title">{t(kind === "locked" ? "login.hold.locked" : "login.hold.throttled")}</div>
      <div className="login-hold__label">
        {t("login.hold.retryIn")}{" "}
        <span className="login-hold__time" aria-hidden="true">{formatRemaining(left ?? seconds, t)}</span>
      </div>
    </div>
  );
};

export default LoginHold;
