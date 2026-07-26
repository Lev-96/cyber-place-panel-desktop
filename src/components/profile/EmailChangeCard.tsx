import { apiConfirmEmailChange, apiSendEmailChangeCode } from "@/api/auth";
import { localizedApiError } from "@/api/errorMessage";
import { useAuth } from "@/auth/AuthContext";
import Button from "@/components/ui/Button";
import CooldownRing from "@/components/ui/CooldownRing";
import Input from "@/components/ui/Input";
import { useCountdown } from "@/hooks/useCountdown";
import { useLang } from "@/i18n/LanguageContext";
import { notify } from "@/ui/notify";
import { useState } from "react";

const RESEND_COOLDOWN = 60;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Change the account email, gated by a one-time code sent to the CURRENT
 * address. Flow: type the new email → send code (to the old inbox) → enter the
 * code → confirm. Only the current mailbox owner can authorise the switch.
 */
const EmailChangeCard = ({ currentEmail }: { currentEmail: string }) => {
  const { t } = useLang();
  const { refreshUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const cooldown = useCountdown(RESEND_COOLDOWN);

  const emailValid = EMAIL_RE.test(newEmail.trim()) && newEmail.trim().toLowerCase() !== currentEmail.toLowerCase();
  const errText = (e: unknown) => localizedApiError(e, t);

  const cancel = () => {
    setEditing(false); setNewEmail(""); setCodeSent(false); setCode(""); setMsg(null);
  };

  const sendCode = async () => {
    if (!emailValid) return;
    setBusy(true); setMsg(null);
    try {
      await apiSendEmailChangeCode(newEmail.trim());
      setCodeSent(true);
      cooldown.start();
      setMsg({ ok: true, text: t("profile.codeSentCurrent") });
    } catch (e) {
      setMsg({ ok: false, text: errText(e) });
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!code.trim()) return;
    setBusy(true); setMsg(null);
    try {
      await apiConfirmEmailChange(code.trim());
      await refreshUser();
      setEditing(false); setNewEmail(""); setCodeSent(false); setCode("");
      setMsg({ ok: true, text: t("profile.emailUpdated") });
      notify.message("success", t("profile.emailChangedToast"));
    } catch (e) {
      setMsg({ ok: false, text: errText(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card col" style={{ gap: 12 }}>
      <h3 style={{ margin: 0 }}>{t("auth.email")}</h3>

      <div className="col" style={{ gap: 4 }}>
        <Input value={currentEmail} readOnly disabled />
        {!editing && (
          <div className="row-between">
            {msg ? <span className={msg.ok ? "muted" : "error"} style={{ fontSize: 12 }}>{msg.text}</span> : <span />}
            <Button type="button" variant="secondary" onClick={() => { setMsg(null); setEditing(true); }}>
              {t("profile.changeEmail")}
            </Button>
          </div>
        )}
      </div>

      {editing && (
        <div className="col" style={{ gap: 10 }}>
          <Input
            label={t("profile.newEmail")}
            type="email"
            value={newEmail}
            onChange={(e) => { setNewEmail(e.target.value); setCodeSent(false); }}
            autoComplete="off"
          />
          <div className="row" style={{ gap: 8, alignItems: "flex-end", justifyContent: "flex-end" }}>
            <Button type="button" variant="secondary" onClick={sendCode} disabled={!emailValid || busy || cooldown.active} style={{ minWidth: 130 }}>
              {cooldown.active
                ? <CooldownRing remaining={cooldown.remaining} total={RESEND_COOLDOWN} />
                : busy && !codeSent ? "…" : codeSent ? t("profile.resendCode") : t("profile.sendCode")}
            </Button>
          </div>

          {/* Code step — revealed only after a code has been sent. */}
          <div className="cp-reveal" data-open={codeSent ? "true" : "false"}>
            <div className="cp-reveal-inner">
              <div className="col" style={{ gap: 10, paddingTop: 2 }}>
                <span className="muted" style={{ fontSize: 12 }}>{t("profile.emailCodeHint")}</span>
                <Input
                  label={t("reset.token")}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder={t("profile.codePlaceholder")}
                />
              </div>
            </div>
          </div>

          {msg && <div className={msg.ok ? "muted" : "error"}>{msg.text}</div>}

          <div className="row-between">
            <Button type="button" variant="secondary" onClick={cancel} disabled={busy}>{t("action.cancel")}</Button>
            <Button type="button" onClick={confirm} disabled={!codeSent || !code.trim() || busy}>
              {busy && codeSent ? "…" : t("profile.confirmEmail")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmailChangeCard;
