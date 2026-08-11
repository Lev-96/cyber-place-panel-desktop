import { ApiError } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { recentEmails } from "@/auth/recentEmails";
import ForgotPasswordForm from "@/components/login/ForgotPasswordForm";
import HudBackdrop from "@/components/login/HudBackdrop";
import Button from "@/components/ui/Button";
import PasswordInput from "@/components/ui/PasswordInput";
import SuggestInput from "@/components/ui/SuggestInput";
import { useLang } from "@/i18n/LanguageContext";
import { LANGUAGES } from "@/i18n/translations";
import { FormEvent, lazy, Suspense, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

// three.js is heavy and only this screen needs it — keep it out of the initial
// chunk so the panel still starts fast. Until it arrives the CSS backdrop
// alone carries the screen, which already looks finished.
const LoginScene = lazy(() => import("@/components/login/LoginScene"));

const LANG_LABEL: Record<string, string> = { en: "ENG", ru: "РУС", am: "ՀԱՅ" };

type LoginErr =
  | { kind: "invalid" }
  | { kind: "generic" }
  | { kind: "raw"; message: string };

/** Which face of the card is showing. */
type Face = "login" | "forgot";

const Login = () => {
  const { login } = useAuth();
  const { t, lang, setLang } = useLang();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // The URL is the source of truth for which face is up, so a deep link to
  // /forgot-password opens the same screen already turned — rather than a
  // second, plainer page that loses the backdrop entirely.
  const face: Face = pathname === "/forgot-password" ? "forgot" : "login";
  const flipTo = (next: Face) =>
    navigate(next === "forgot" ? "/forgot-password" : "/login", { replace: true });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<LoginErr | null>(null);
  const [busy, setBusy] = useState(false);
  // Addresses that already signed in on this machine — offered while typing
  // so a returning operator types one letter instead of the whole address.
  const [known, setKnown] = useState<string[]>([]);

  useEffect(() => {
    void recentEmails.list().then(setKnown);
  }, []);

  const forgetEmail = (value: string) => {
    void recentEmails.forget(value).then(() => recentEmails.list().then(setKnown));
  };

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
      {/* Two decorative layers, both inert: the WebGL depth behind, the HUD
          instrument dressing over it. Neither takes a pointer event, so the
          form in front stays ordinary, fully keyboard-operable DOM. */}
      <Suspense fallback={null}>
        <LoginScene />
      </Suspense>

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

      <div className="login-stage">
        {/* The ring lives INSIDE this wrapper so it is centred on the wordmark
            itself, not on the page. Anchoring it to the element it should
            frame is what keeps the two aligned at every window size — a fixed
            offset would only ever be right at one height. */}
        <div className="login-brand-wrap">
          <HudBackdrop />
          <h1 className="login-brand">Cyber Place</h1>
        </div>
        <img className="login-logo" src="./logo.png" alt="Cyber Place" />
        <h2 className="login-title">
          {face === "forgot" ? t("auth.forgotTitle") : t("login.title")}
        </h2>
        <div className="login-flip-wrap">
          <div className={`login-flip${face === "forgot" ? " is-back" : ""}`}>
            <form className="login-card" onSubmit={onSubmit} inert={face === "forgot" || undefined}>
          <SuggestInput
            label={t("auth.email")}
            type="email"
            placeholder="your@email.com"
            value={email}
            onValueChange={setEmail}
            options={known}
            onRemoveOption={forgetEmail}
            removeHint={t("login.forgetEmail")}
            required
            autoFocus
          />
          <PasswordInput label={t("auth.password")} placeholder={t("login.passwordPlaceholder")} value={password} onChange={(e) => setPassword(e.target.value)} required />
          {errText && <div className="error" style={{ textAlign: "center" }}>{errText}</div>}
          <button
            type="button"
            className="login-forgot login-flip-back"
            onClick={() => flipTo("forgot")}
          >
            {t("auth.forgot")}
          </button>
              <Button disabled={busy}>{busy ? t("login.signingIn") : t("login.title")}</Button>
            </form>

            {/* The reverse face. `inert` keeps the hidden side out of the tab
                order — `backface-visibility` only hides it from the eye, and a
                form you cannot see but can still Tab into is a trap. */}
            <div className="login-flip-face-back" inert={face === "login" || undefined}>
              <ForgotPasswordForm onBack={() => flipTo("login")} autoFocus={face === "forgot"} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
