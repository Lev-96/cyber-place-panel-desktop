import { apiChangePassword, apiConfirmPasswordChange, apiSendPasswordCode, apiVerifyPassword, apiVerifyPasswordCode } from "@/api/auth";
import { localizedApiError } from "@/api/errorMessage";
import Button from "@/components/ui/Button";
import CheckRow from "@/components/ui/CheckRow";
import CooldownRing from "@/components/ui/CooldownRing";
import Input from "@/components/ui/Input";
import PasswordInput from "@/components/ui/PasswordInput";
import { useCountdown } from "@/hooks/useCountdown";
import { useLang } from "@/i18n/LanguageContext";
import { notify } from "@/ui/notify";
import { useState } from "react";

const RESEND_COOLDOWN = 60;

type Mode = "remember" | "forgot";

interface Props {
  /** The account email — where the one-time code is sent in the "forgot" flow. */
  email: string;
}

/**
 * Password change with two paths, progressively disclosed:
 *   - "remember" — type the current password, confirm it server-side, then the
 *     new-password fields reveal; submit hits /change-password.
 *   - "forgot" — send a one-time code to the account email, enter it, verify it
 *     server-side, and only THEN do the new-password fields reveal; submit hits
 *     /password/change/confirm. A 60s cooldown throttles resends.
 * Additive endpoints only — the shared login forgot/reset flow is untouched.
 */
const PasswordChangeCard = ({ email }: Props) => {
  const { t } = useLang();
  const [mode, setMode] = useState<Mode>("remember");
  const [oldPw, setOldPw] = useState("");
  const [oldConfirmed, setOldConfirmed] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [codeVerified, setCodeVerified] = useState(false);
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const cooldown = useCountdown(RESEND_COOLDOWN);

  const longEnough = newPw.length >= 8;
  const matches = confirmPw.length > 0 && newPw === confirmPw;
  const newInputsOpen = mode === "remember" ? oldConfirmed : codeVerified;
  const canSubmit = newInputsOpen && longEnough && matches && !busy;

  const errText = (e: unknown) => localizedApiError(e, t);

  const resetAll = () => {
    setOldPw(""); setOldConfirmed(false);
    setCodeSent(false); setCode(""); setCodeVerified(false);
    setNewPw(""); setConfirmPw("");
  };

  const switchMode = (m: Mode) => {
    if (m === mode) return;
    setMode(m); resetAll(); setMsg(null);
  };

  // Verify the current password server-side BEFORE revealing the new-password
  // fields — a wrong password must not open the next step.
  const confirmOld = async () => {
    if (!oldPw) return;
    setBusy(true); setMsg(null);
    try {
      const { valid } = await apiVerifyPassword(oldPw);
      if (valid) setOldConfirmed(true);
      else setMsg({ ok: false, text: t("profile.wrongCurrentPassword") });
    } catch (e) {
      setMsg({ ok: false, text: errText(e) });
    } finally {
      setBusy(false);
    }
  };

  const sendCode = async () => {
    setBusy(true); setMsg(null);
    try {
      await apiSendPasswordCode();
      setCodeSent(true);
      cooldown.start();
      setMsg({ ok: true, text: t("profile.codeSent") });
    } catch (e) {
      setMsg({ ok: false, text: errText(e) });
    } finally {
      setBusy(false);
    }
  };

  // Confirm the code server-side; only a valid code unlocks the new-password step.
  const verifyCode = async () => {
    if (!code.trim()) return;
    setBusy(true); setMsg(null);
    try {
      const { valid } = await apiVerifyPasswordCode(code.trim());
      if (valid) setCodeVerified(true);
      else setMsg({ ok: false, text: t("profile.errInvalidCode") });
    } catch (e) {
      setMsg({ ok: false, text: errText(e) });
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true); setMsg(null);
    try {
      if (mode === "remember") {
        await apiChangePassword({ current_password: oldPw, new_password: newPw, new_password_confirmation: confirmPw });
      } else {
        await apiConfirmPasswordChange({ code: code.trim(), new_password: newPw, new_password_confirmation: confirmPw });
      }
      resetAll();
      setMsg({ ok: true, text: t("profile.passwordUpdated") });
      notify.message("success", t("profile.passwordChangedToast"));
    } catch (e) {
      setMsg({ ok: false, text: errText(e) });
    } finally {
      setBusy(false);
    }
  };

  const tab = (m: Mode, label: string) => (
    <button
      type="button"
      onClick={() => switchMode(m)}
      style={{
        flex: 1,
        minWidth: 0,
        padding: "8px 10px",
        borderRadius: 8,
        cursor: "pointer",
        fontWeight: 600,
        fontSize: 13,
        whiteSpace: "normal",
        lineHeight: 1.2,
        border: `1px solid ${mode === m ? "#07ddf1" : "#1f2a44"}`,
        background: mode === m ? "#101a35" : "transparent",
        color: mode === m ? "#07ddf1" : "#9aa8c7",
        transition: "border-color 160ms ease, background 160ms ease, color 160ms ease",
      }}
    >
      {label}
    </button>
  );

  const resendButton = (
    <Button type="button" variant="secondary" onClick={sendCode} disabled={busy || cooldown.active} style={{ whiteSpace: "nowrap", minWidth: 130 }}>
      {cooldown.active
        ? <CooldownRing remaining={cooldown.remaining} total={RESEND_COOLDOWN} />
        : t("profile.resendCode")}
    </Button>
  );

  return (
    <div className="card col" style={{ gap: 14 }}>
      <h3 style={{ margin: 0 }}>{t("settings.changePassword")}</h3>

      <div className="row" style={{ gap: 8 }}>
        {tab("remember", t("profile.pwKnow"))}
        {tab("forgot", t("profile.pwForgot"))}
      </div>

      {mode === "remember" ? (
        <div className="col" style={{ gap: 10 }}>
          <PasswordInput
            label={t("settings.currentPassword")}
            value={oldPw}
            onChange={(e) => { setOldPw(e.target.value); setOldConfirmed(false); }}
            autoComplete="current-password"
          />
          {!oldConfirmed && (
            <Button type="button" variant="secondary" onClick={confirmOld} disabled={!oldPw || busy}>
              {busy ? "…" : t("action.continue")}
            </Button>
          )}
        </div>
      ) : (
        <div className="col" style={{ gap: 10 }}>
          <span className="muted" style={{ fontSize: 12 }}>{t("profile.forgotHint")}</span>

          {!codeSent ? (
            // Step 1 — only the "send code" button until a code has been sent.
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <Button type="button" onClick={sendCode} disabled={busy || cooldown.active} style={{ minWidth: 130 }}>
                {cooldown.active
                  ? <CooldownRing remaining={cooldown.remaining} total={RESEND_COOLDOWN} />
                  : busy ? "…" : t("profile.sendCode")}
              </Button>
            </div>
          ) : (
            // Step 2 — enter + confirm the code. New-password fields stay hidden
            // until the code is confirmed valid.
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
                {resendButton}
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
        </div>
      )}

      {/* New-password fields — revealed only after the prerequisite step. */}
      <div className="cp-reveal" data-open={newInputsOpen ? "true" : "false"}>
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

      {newInputsOpen && (
        <div className="row-between">
          <span />
          <Button onClick={submit} disabled={!canSubmit}>
            {busy ? "…" : t("settings.updatePassword")}
          </Button>
        </div>
      )}
    </div>
  );
};

export default PasswordChangeCard;
