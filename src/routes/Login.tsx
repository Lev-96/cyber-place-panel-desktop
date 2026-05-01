import { ApiError } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useLang } from "@/i18n/LanguageContext";
import { LANGUAGES } from "@/i18n/translations";
import { FormEvent, useState } from "react";

const LANG_LABEL: Record<string, string> = { en: "ENG", ru: "РУС", am: "ՀԱՅ" };

type LoginErr =
  | { kind: "invalid" }
  | { kind: "generic" }
  | { kind: "raw"; message: string };

const Login = () => {
  const { login } = useAuth();
  const { t, lang, setLang } = useLang();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<LoginErr | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try { await login(email, password); }
    catch (ex) {
      const status = (ex as ApiError | undefined)?.status;
      if (status === 401 || status === 422) setErr({ kind: "invalid" });
      else if (ex instanceof Error) setErr({ kind: "raw", message: ex.message });
      else setErr({ kind: "generic" });
    }
    finally { setBusy(false); }
  };

  const errText =
    err === null ? null
    : err.kind === "invalid" ? t("login.invalidCredentials")
    : err.kind === "generic" ? t("login.failed")
    : err.message;

  return (
    <div className="login-shell">
      <div className="login-lang">
        {LANGUAGES.map((l) => (
          <button
            key={l.code}
            type="button"
            className={`login-lang-pill${lang === l.code ? " active" : ""}`}
            onClick={() => setLang(l.code)}
            aria-label={l.name}
          >
            {LANG_LABEL[l.code] ?? l.code.toUpperCase()}
          </button>
        ))}
      </div>
      <h1 className="login-brand">Cyber Place</h1>
      <img className="login-logo" src="./logo.png" alt="Cyber Place" />
      <h2 className="login-title">{t("login.title")}</h2>
      <form className="login-card" onSubmit={onSubmit}>
        <Input label={t("auth.email")} type="email" placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        <Input label={t("auth.password")} type="password" placeholder={t("login.passwordPlaceholder")} value={password} onChange={(e) => setPassword(e.target.value)} required />
        {errText && <div className="error" style={{ textAlign: "center" }}>{errText}</div>}
        <a className="login-forgot" href="#/forgot-password">{t("auth.forgot")}</a>
        <Button disabled={busy}>{busy ? t("login.signingIn") : t("login.title")}</Button>
      </form>
    </div>
  );
};

export default Login;
