import { IAccountSwitchTarget } from "@/api/accountSwitch";
import { ApiError } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import PasswordResetCard from "@/components/auth/PasswordResetCard";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import PasswordInput from "@/components/ui/PasswordInput";
import { useLang } from "@/i18n/LanguageContext";
import { fmt } from "@/i18n/translations";
import { notify } from "@/ui/notify";
import { FormEvent, useState } from "react";

interface Props {
  target: IAccountSwitchTarget;
  /** Dismiss without switching. */
  onClose: () => void;
  /** The switch went through — the session now belongs to the target. */
  onSwitched: () => void;
}

/**
 * Password step of an account switch — owner → manager, manager → owner or a
 * colleague of the same company. One component for every direction; the
 * backend decides who may appear in the picker at all.
 *
 * Switching is a REAL sign-in: the target's own password is verified by the
 * backend (`POST /session/login`) and the session token is replaced, so the
 * new session carries exactly that account's permissions — nobody can "become"
 * a colleague without their credentials, and nothing is impersonated
 * client-side.
 *
 * The account may also have forgotten its password, so the same code-based
 * reset the profile screen offers is available inline (`PasswordResetCard`,
 * one-time code mailed to the target's OWN address).
 */
const AccountSwitchModal = ({ target, onClose, onSwitched }: Props) => {
  const { t } = useLang();
  const { login } = useAuth();
  const email = target.email ?? "";
  const name = target.name || t("switchAccount.unnamed");
  const [password, setPassword] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password || busy) return;
    setBusy(true); setErr(null);
    try {
      await login(email, password);
      notify.message("success", fmt(t("switchAccount.done"), name));
      onSwitched();
    } catch (ex) {
      const status = (ex as ApiError | undefined)?.status;
      setErr(status === 401 || status === 422 ? t("login.invalidCredentials") : t("form.errors.failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose}>
      <form className="card col cp-switch-modal" style={{ width: 460, maxWidth: "92vw", gap: 16 }} onSubmit={submit}>
        <div className="row" style={{ gap: 12, alignItems: "center" }}>
          <span
            className={`cp-switch-avatar cp-switch-avatar-lg${target.role === "company_owner" ? " is-owner" : ""}`}
            aria-hidden
          >
            {name.slice(0, 2).toUpperCase()}
          </span>
          <div className="col" style={{ gap: 2, minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>{name}</h2>
            <span className="muted" style={{ fontSize: 12 }}>{email}</span>
            {target.branch && <span className="muted" style={{ fontSize: 12 }}>{target.branch.address}</span>}
          </div>
          <span className={`cp-switch-role${target.role === "company_owner" ? " is-owner" : ""}`} style={{ marginLeft: "auto" }}>
            {t(`role.${target.role}`)}
          </span>
        </div>

        <span className="muted" style={{ fontSize: 12 }}>{t("switchAccount.passwordHint")}</span>

        <PasswordInput
          label={t("auth.password")}
          value={password}
          onChange={(e) => { setPassword(e.target.value); setErr(null); }}
          autoComplete="off"
          required
        />

        {err && <div className="error">{err}</div>}

        <div className="row-between" style={{ gap: 10 }}>
          <button
            type="button"
            className="cp-link-btn"
            onClick={() => setResetOpen((o) => !o)}
            aria-expanded={resetOpen}
          >
            {resetOpen ? t("action.cancel") : t("switchAccount.forgot")}
          </button>
          <Button disabled={busy || !password}>{busy ? "…" : t("switchAccount.signIn")}</Button>
        </div>

        {/* Reset lives inside the same modal so the operator never loses the
            selected account while recovering its password. */}
        <div className="cp-reveal" data-open={resetOpen ? "true" : "false"}>
          <div className="cp-reveal-inner">
            <div className="card col" style={{ gap: 12, marginTop: 4 }}>
              <h3 style={{ margin: 0, fontSize: 14 }}>{t("settings.changePassword")}</h3>
              {resetOpen && (
                <PasswordResetCard
                  email={email}
                  onDone={(newPassword) => {
                    // Hand the fresh password straight to the sign-in field —
                    // signing in stays an explicit, deliberate action.
                    setPassword(newPassword);
                    setResetOpen(false);
                    setErr(null);
                  }}
                />
              )}
            </div>
          </div>
        </div>

        <div className="row" style={{ justifyContent: "flex-start" }}>
          <Button type="button" variant="secondary" onClick={onClose}>{t("action.close")}</Button>
        </div>
      </form>
    </Modal>
  );
};

export default AccountSwitchModal;
