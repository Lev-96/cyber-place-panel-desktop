import { apiForgotPassword } from "@/api/auth";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useLang } from "@/i18n/LanguageContext";
import { notify } from "@/ui/notify";
import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";

const ForgotPassword = () => {
  const { t } = useLang();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      await apiForgotPassword(email);
      setMsg(t("forgot.successPrefix")); setSuccess(true);
      notify.message("success", t("forgot.toastSent"));
    } catch (ex) {
      const m = ex instanceof Error ? ex.message : t("form.errors.failed");
      setMsg(m); setSuccess(false);
      notify.message("error", m);
    } finally { setBusy(false); }
  };

  return (
    <div className="login-shell">
      <h1 className="login-brand">Cyber Place</h1>
      <h2 className="login-title">{t("auth.forgotTitle")}</h2>
      <form className="login-card" onSubmit={submit}>
        <Input label={t("label.email")} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        {msg && <div className={success ? "muted" : "error"}>{msg}</div>}
        <Button disabled={busy}>{busy ? t("auth.sending") : t("auth.sendResetLink")}</Button>
        <Link to="/login" className="login-forgot">{t("auth.backToLogin")}</Link>
      </form>
    </div>
  );
};

export default ForgotPassword;
