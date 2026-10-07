import { apiForgotPassword } from "@/api/auth";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useLang } from "@/i18n/LanguageContext";
import { LocalizedText, renderText, textKey, textLiteral } from "@/i18n/localizedText";
import { notify } from "@/ui/notify";
import { FormEvent, useState } from "react";

interface Props {
  /** Called when the operator wants to go back to signing in. */
  onBack: () => void;
  /** Focus the field as soon as this face becomes the visible one. */
  autoFocus?: boolean;
}

/**
 * The reverse face of the sign-in card: request a password-reset link.
 *
 * Extracted from the standalone `/forgot-password` screen so the two cannot
 * drift apart — the flow behind it (which endpoint, which messages, which
 * toast) is the same whether it is reached by flipping the card or by opening
 * the URL directly.
 */
const ForgotPasswordForm = ({ onBack, autoFocus }: Props) => {
  const { t } = useLang();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  // By meaning, not as a sentence: the language can be switched on this card.
  const [msg, setMsg] = useState<LocalizedText | null>(null);
  const [success, setSuccess] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      await apiForgotPassword(email);
      setMsg(textKey("forgot.successPrefix")); setSuccess(true);
      notify.message("success", t("forgot.toastSent"));
    } catch (ex) {
      // The reset throttle's refusal has a code, so it is said in our words;
      // anything else is the server's sentence (or ours when there is none).
      const code = (ex as { body?: { code?: unknown } } | undefined)?.body?.code;
      const m = code === "too_many_attempts" ? textKey("login.hold.throttled")
        : ex instanceof Error ? textLiteral(ex.message)
        : textKey("form.errors.failed");
      setMsg(m); setSuccess(false);
      notify.message("error", renderText(m, t));
    } finally { setBusy(false); }
  };

  return (
    <form className="login-card" onSubmit={submit}>
      <Input
        label={t("label.email")}
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoFocus={autoFocus}
      />
      {msg && <div className={success ? "muted" : "error"}>{renderText(msg, t)}</div>}
      <Button disabled={busy}>{busy ? t("auth.sending") : t("auth.sendResetLink")}</Button>
      {/* A button, not a link: flipping back is a state change on this screen,
          and a link would tear the card down and rebuild it. */}
      <button type="button" className="login-forgot login-flip-back" onClick={onBack}>
        {t("auth.backToLogin")}
      </button>
    </form>
  );
};

export default ForgotPasswordForm;
