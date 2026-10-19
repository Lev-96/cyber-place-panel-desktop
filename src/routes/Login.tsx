import { blockingKeyOf } from "@/api/blockingErrors";
import { ApiError } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { recentEmails } from "@/auth/recentEmails";
import { useLoginCaptcha } from "@/auth/useLoginCaptcha";
import CaptchaDialog from "@/components/login/CaptchaDialog";
import ForgotPasswordForm from "@/components/login/ForgotPasswordForm";
import HudBackdrop from "@/components/login/HudBackdrop";
import LoginHold, { HoldKind } from "@/components/login/LoginHold";
import Button from "@/components/ui/Button";
import PasswordInput from "@/components/ui/PasswordInput";
import SuggestInput from "@/components/ui/SuggestInput";
import { useLang } from "@/i18n/LanguageContext";
import { LocalizedText, renderText, textKey, textLiteral } from "@/i18n/localizedText";
import { LANGUAGES } from "@/i18n/translations";
import { FormEvent, lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

// three.js is heavy and only this screen needs it — keep it out of the initial
// chunk so the panel still starts fast. Until it arrives the CSS backdrop
// alone carries the screen, which already looks finished.
const LoginScene = lazy(() => import("@/components/login/LoginScene"));

const LANG_LABEL: Record<string, string> = { en: "ENG", ru: "РУС", am: "ՀԱՅ" };

/**
 * The server holding sign-in back for a while (2026-10-07): a lock after too
 * many wrong passwords (423) or the per-minute limit (429). Counted down from
 * its own "seconds left"; the server still decides on the next attempt.
 */
interface Hold { kind: HoldKind; seconds: number; startedAt: number }

const codeOf = (ex: unknown): string | undefined => (ex as { body?: { code?: string } } | undefined)?.body?.code;
const retryAfterOf = (ex: unknown): number | null => {
  const value = Number((ex as { body?: { retry_after?: unknown } } | undefined)?.body?.retry_after);
  return Number.isFinite(value) && value > 0 ? Math.ceil(value) : null;
};

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
  // Held by meaning, not as a sentence: the language picker sits on this card,
  // and a message on screen must follow a switch made after it appeared.
  const [err, setErr] = useState<LocalizedText | null>(null);
  const [busy, setBusy] = useState(false);
  const [hold, setHold] = useState<Hold | null>(null);
  const [holdOver, setHoldOver] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const captcha = useLoginCaptcha(emailRef, passwordRef);
  // Addresses that already signed in on this machine — offered while typing
  // so a returning operator types one letter instead of the whole address.
  const [known, setKnown] = useState<string[]>([]);

  useEffect(() => {
    void recentEmails.list().then(setKnown);
  }, []);

  const forgetEmail = (value: string) => {
    void recentEmails.forget(value).then(() => recentEmails.list().then(setKnown));
  };

  const attempt = async () => {
    setBusy(true); setErr(null); setHoldOver(false); captcha.attempting();
    try { await login(email, password); }
    catch (ex) {
      const status = (ex as ApiError | undefined)?.status;
      const code = codeOf(ex);
      const retryAfter = retryAfterOf(ex);
      // Asked before the status branches: a block is a 403 carrying a code,
      // and it is the one refusal the operator can act on ("call the
      // administrator") rather than retype their way out of.
      const blockedKey = blockingKeyOf(ex);
      if (blockedKey) setErr(textKey(blockedKey));
      else if ((status === 423 || status === 429) && retryAfter !== null) {
        setHold({ kind: status === 423 ? "locked" : "throttled", seconds: retryAfter, startedAt: performance.now() });
      } else if (code === "captcha_required") {
        // A wrong password that now needs the mosaic (422), or an attempt held
        // back for it (428): the mosaic, then back to the form — never a
        // sign-in sent by the mosaic itself.
        if (status === 422) setErr(textKey("login.invalidCredentials"));
        captcha.ask();
      } else if (status === 401 || status === 422) setErr(textKey("login.invalidCredentials"));
      else if (ex instanceof Error) setErr(textLiteral(ex.message));
      else setErr(textKey("login.failed"));
    }
    finally { setBusy(false); }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || hold) return;
    await attempt();
  };

  // The time is up: the form is open again (the server decides on the next try).
  const holdOverNow = useCallback(() => { setHold(null); setHoldOver(true); }, []);

  const errText = err === null ? null : renderText(err, t);

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
            ref={emailRef}
            label={t("auth.email")}
            type="email"
            placeholder="your@email.com"
            value={email}
            onValueChange={(value) => { setEmail(value); setHold(null); setHoldOver(false); }}
            options={known}
            onRemoveOption={forgetEmail}
            removeHint={t("login.forgetEmail")}
            required
            autoFocus
          />
          <PasswordInput ref={passwordRef} label={t("auth.password")} placeholder={t("login.passwordPlaceholder")} value={password} onChange={(e) => setPassword(e.target.value)} required />
          {hold ? (
            <LoginHold kind={hold.kind} seconds={hold.seconds} startedAt={hold.startedAt} onOver={holdOverNow} />
          ) : holdOver ? (
            <div className="login-hold is-over" role="status">{t("login.hold.ready")}</div>
          ) : captcha.passed ? (
            <div className="login-hold is-over" role="status">{t("login.captchaPassed")}</div>
          ) : errText && <div className="error" role="alert" style={{ textAlign: "center" }}>{errText}</div>}
          <button
            type="button"
            className="login-forgot login-flip-back"
            onClick={() => flipTo("forgot")}
          >
            {t("auth.forgot")}
          </button>
              <Button disabled={busy || hold !== null}>{busy ? t("login.signingIn") : t("login.title")}</Button>
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

      <CaptchaDialog open={captcha.open} client="desktop" onSolved={captcha.solved} onClose={captcha.close} />
    </div>
  );
};

export default Login;
