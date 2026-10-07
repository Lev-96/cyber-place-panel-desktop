import { RefObject, useCallback, useEffect, useState } from "react";
import { loginChallenge } from "@/auth/loginChallenge";

/**
 * The sign-in mosaic's place in the sign-in, shared by the desktop and the
 * owner web (fixed 2026-10-07).
 *
 * The server asks for it (`captcha_required`); the person solves it; the
 * dialog closes back to the form, which says the check is passed and puts the
 * cursor where the next thing to type is. It NEVER sends the sign-in by
 * itself: the person checks or corrects the email and password and presses
 * Sign in, and that attempt carries the pass once ({@link loginChallenge}).
 *
 * Before, solving it re-sent the same — usually wrong — credentials at once:
 * that failed, spent another attempt towards the lock, and opened the next
 * mosaic straight away, so the form could never be corrected.
 *
 * `passed` only changes what the form says. The server alone decides whether
 * a pass counts; a missing or expired one is answered with `captcha_required`
 * again, and then the mosaic opens again.
 */
export const useLoginCaptcha = (
  email: RefObject<HTMLInputElement | null>,
  password: RefObject<HTMLInputElement | null>,
) => {
  const [open, setOpen] = useState(false);
  const [passed, setPassed] = useState(false);

  // After the dialog is gone: the email if it is empty, otherwise the password.
  useEffect(() => {
    if (!passed) return;
    (email.current?.value ? password.current : email.current)?.focus();
  }, [passed, email, password]);

  return {
    open,
    passed,
    /** The server asked for the mosaic. */
    ask: useCallback(() => { setPassed(false); setOpen(true); }, []),
    /** Solved: keep the pass for the next attempt and go back to the form. */
    solved: useCallback((token: string) => { loginChallenge.set(token); setOpen(false); setPassed(true); }, []),
    close: useCallback(() => setOpen(false), []),
    /** A sign-in attempt is starting; it spends the pass, if there is one. */
    attempting: useCallback(() => setPassed(false), []),
  };
};
