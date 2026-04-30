import { apiResetPassword } from "@/api/auth";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useLang } from "@/i18n/LanguageContext";
import { FormEvent, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

const ResetPassword = () => {
  const { t } = useLang();
  const [params] = useSearchParams();
  const [token, setToken] = useState(params.get("token") ?? "");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (pw !== pw2) { setMsg(t("settings.passwordsMismatch")); setSuccess(false); return; }
    setBusy(true); setMsg(null);
    try {
      await apiResetPassword({ token, new_password: pw, new_password_confirmation: pw2 });
      setMsg(t("reset.successDone"));
      setSuccess(true);
    } catch (ex) {
      setMsg(ex instanceof Error ? ex.message : t("form.errors.failed"));
      setSuccess(false);
    } finally { setBusy(false); }
  };

  return (
    <div className="login-shell">
      <h1 className="login-brand">Cyber Place</h1>
      <h2 className="login-title">{t("auth.resetTitle")}</h2>
      <form className="login-card" onSubmit={submit}>
        <Input label={t("reset.token")} value={token} onChange={(e) => setToken(e.target.value)} required />
        <Input label={t("settings.newPassword")} type="password" value={pw} onChange={(e) => setPw(e.target.value)} required minLength={8} />
        <Input label={t("settings.confirmPassword")} type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} required minLength={8} />
        {msg && <div className={success ? "muted" : "error"}>{msg}</div>}
        <Button disabled={busy}>{busy ? "…" : t("settings.updatePassword")}</Button>
        <Link to="/login" className="login-forgot">{t("auth.backToLogin")}</Link>
      </form>
    </div>
  );
};

export default ResetPassword;
