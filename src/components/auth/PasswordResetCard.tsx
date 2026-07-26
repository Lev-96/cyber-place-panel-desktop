import { apiConfirmPasswordResetCode, apiSendPasswordResetCode, apiVerifyPasswordResetCode } from "@/api/auth";
import { localizedApiError } from "@/api/errorMessage";
import Button from "@/components/ui/Button";
import CheckRow from "@/components/ui/CheckRow";
import CooldownRing from "@/components/ui/CooldownRing";
import Input from "@/components/ui/Input";
import PasswordInput from "@/components/ui/PasswordInput";
import { useCountdown } from "@/hooks/useCountdown";
import { useLang } from "@/i18n/LanguageContext";
import { fmt } from "@/i18n/translations";
import { notify } from "@/ui/notify";
import { useState } from "react";

/** Same throttle the profile's own code flow uses. */
const RESEND_COOLDOWN = 60;
const MIN_LENGTH = 8;

interface Props {
  /** Account whose password is being reset — where the code is mailed. */
  email: string;
  /** Fired with the new password once the reset succeeded (e.g. to sign in). */
  onDone?: (newPassword: string) => void;
}

/**
 * Reset the password of an account you are NOT signed in as, gated by the same
 * one-time CODE email the profile's own password change sends
 * (`/password/reset-code/*`) — never the link-based `/forgot-password` flow
 * the login screen uses.
 *
 * Mirrors `profile/PasswordChangeCard` step for step — send → verify the code
 * server-side → only then reveal the new-password fields — so both read
 * identically to the operator, and is reusable anywhere an email is known:
 * the manager-account switch today, other recovery entry points tomorrow.
 */
const PasswordResetCard = ({ email, onDone }: Props) => {
  const { t } = useLang();
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [codeVerified, setCodeVerified] = useState(false);
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const cooldown = useCountdown(RESEND_COOLDOWN);

  const longEnough = newPw.length >= MIN_LENGTH;
  const matches = confirmPw.length > 0 && newPw === confirmPw;
  const canSubmit = codeVerified && longEnough && matches && !busy;

  const sendCode = async () => {
    setBusy(true); setMsg(null);
    try {
      await apiSendPasswordResetCode(email);
      setCodeSent(true);
      cooldown.start();
      setMsg({ ok: true, text: fmt(t("reset.codeSentTo"), email) });
    } catch (e) {
      setMsg({ ok: false, text: localizedApiError(e, t) });
    } finally {
      setBusy(false);
    }
  };

  // Confirm the code server-side; only a valid code unlocks the new-password
  // step — a wrong one must never open it.
  const verifyCode = async () => {
    if (!code.trim()) return;
    setBusy(true); setMsg(null);
    try {
      const { valid } = await apiVerifyPasswordResetCode(email, code.trim());
      if (valid) setCodeVerified(true);
      else setMsg({ ok: false, text: t("profile.errInvalidCode") });
    } catch (e) {
      setMsg({ ok: false, text: localizedApiError(e, t) });
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true); setMsg(null);
    try {
      await apiConfirmPasswordResetCode({
        email,
        code: code.trim(),
        new_password: newPw,
        new_password_confirmation: confirmPw,
      });
      notify.message("success", t("profile.passwordChangedToast"));
      setMsg({ ok: true, text: t("reset.successDone") });
      const applied = newPw;
      setCode(""); setCodeSent(false); setCodeVerified(false); setNewPw(""); setConfirmPw("");
      onDone?.(applied);
    } catch (e) {
      setMsg({ ok: false, text: localizedApiError(e, t) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="col" style={{ gap: 12 }}>
      <span className="muted" style={{ fontSize: 12 }}>{fmt(t("reset.cardHint"), email)}</span>

      {!codeSent ? (
        // Step 1 — nothing but "send the code" until one has been sent.
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <Button type="button" onClick={sendCode} disabled={busy || cooldown.active} style={{ minWidth: 130 }}>
            {cooldown.active
              ? <CooldownRing remaining={cooldown.remaining} total={RESEND_COOLDOWN} />
              : busy ? "…" : t("profile.sendCode")}
          </Button>
        </div>
      ) : (
        // Step 2 — enter + confirm the code.
        <div className="col" style={{ gap: 8 }}>
          <span className="muted" style={{ fontSize: 12 }}>{t("profile.enterCodeHint")}</span>
          <div className="row" style={{ gap: 8, alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
              <Input
                label={t("reset.token")}
                value={code}
                onChange={(e) => { setCode(e.target.value); setCodeVerified(false); }}
                placeholder={t("profile.codePlaceholder")}
                disabled={codeVerified}
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={sendCode}
              disabled={busy || cooldown.active}
              style={{ whiteSpace: "nowrap", minWidth: 130 }}
            >
              {cooldown.active
                ? <CooldownRing remaining={cooldown.remaining} total={RESEND_COOLDOWN} />
                : t("profile.resendCode")}
            </Button>
          </div>
          {!codeVerified && (
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <Button type="button" onClick={verifyCode} disabled={!code.trim() || busy}>
                {busy ? "…" : t("profile.confirmCode")}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* New-password fields — revealed only after the code is confirmed. */}
      <div className="cp-reveal" data-open={codeVerified ? "true" : "false"}>
        <div className="cp-reveal-inner">
          <div className="col" style={{ gap: 10, paddingTop: 2 }}>
            <PasswordInput
              label={t("settings.newPassword")}
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              autoComplete="new-password"
            />
            <PasswordInput
              label={t("settings.confirmPassword")}
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              autoComplete="new-password"
              style={{ borderColor: confirmPw.length > 0 && !matches ? "#ef4444" : undefined }}
            />
            {confirmPw.length > 0 && !matches && (
              <span className="error" style={{ fontSize: 12 }}>{t("settings.passwordsMismatch")}</span>
            )}
            <div className="col" style={{ gap: 6 }}>
              <CheckRow ok={longEnough} label={t("profile.pwRuleLength")} />
              <CheckRow ok={matches} label={t("profile.pwRuleMatch")} />
            </div>
          </div>
        </div>
      </div>

      {msg && <div className={msg.ok ? "muted" : "error"}>{msg.text}</div>}

      {codeVerified && (
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <Button type="button" onClick={submit} disabled={!canSubmit}>
            {busy ? "…" : t("settings.updatePassword")}
          </Button>
        </div>
      )}
    </div>
  );
};

export default PasswordResetCard;
