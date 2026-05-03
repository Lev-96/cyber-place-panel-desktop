import { useAuth } from "@/auth/AuthContext";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import ScreenWithBg from "@/components/ui/ScreenWithBg";
import { request } from "@/api/client";
import { apiSubscribe } from "@/api/subscribe";
import { useLang } from "@/i18n/LanguageContext";
import { AMD_UNIT, Currency } from "@/i18n/currency";
import { LANGUAGES, Lang } from "@/i18n/translations";
import { FormEvent, useState } from "react";

const Settings = () => {
  const { user, logout } = useAuth();
  const { t, lang, setLang, currency, setCurrencyOverride, money } = useLang();
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [subEmail, setSubEmail] = useState("");
  const [subBusy, setSubBusy] = useState(false);
  const [subMsg, setSubMsg] = useState<string | null>(null);

  const subscribe = async (e: FormEvent) => {
    e.preventDefault();
    setSubBusy(true); setSubMsg(null);
    try { await apiSubscribe(subEmail); setSubMsg(t("settings.subscribed")); setSubEmail(""); }
    catch (e) { setSubMsg(e instanceof Error ? e.message : "Failed"); }
    finally { setSubBusy(false); }
  };

  const change = async (e: FormEvent) => {
    e.preventDefault();
    if (next !== confirm) { setMsg(t("settings.passwordsMismatch")); return; }
    setBusy(true); setMsg(null);
    try {
      await request<void>("/change-password", {
        method: "PUT",
        body: { current_password: cur, new_password: next, new_password_confirmation: confirm },
      });
      setMsg(t("settings.passwordChanged"));
      setCur(""); setNext(""); setConfirm("");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally { setBusy(false); }
  };

  return (
    <ScreenWithBg bg="./bg/settings.jpg" title={t("nav.settings")}>
      <div className="gradient-card"><div className="gradient-card-inner">
        <h3 style={{ margin: 0 }}>{t("settings.language")} & {t("settings.currency")}</h3>
        <div className="col" style={{ gap: 6 }}>
          <span className="label">{t("settings.language")}</span>
          <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
            {LANGUAGES.map((l) => (
              <Button key={l.code} type="button" variant={lang === l.code ? "primary" : "secondary"} onClick={() => setLang(l.code as Lang)}>{l.name}</Button>
            ))}
          </div>
        </div>
        <div className="col" style={{ gap: 6 }}>
          <span className="label">{t("settings.currency")}</span>
          <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
            {(["AMD", "USD", "RUB"] as Currency[]).map((c) => (
              // AMD button label is the localized unit word so the
              // ISO code never appears in the UI; USD/RUB stay as
              // their codes since those ARE the everyday names.
              <Button
                key={c}
                type="button"
                variant={currency === c ? "primary" : "secondary"}
                onClick={() => setCurrencyOverride(c)}
              >
                {c === "AMD" ? AMD_UNIT[lang] : c}
              </Button>
            ))}
            <Button type="button" variant="secondary" onClick={() => setCurrencyOverride(null)}>{t("settings.autoByLang")}</Button>
          </div>
          <span className="muted" style={{ fontSize: 11 }}>
            {t("settings.ratesNote")} {money(1000)}.
          </span>
        </div>
      </div></div>

      <div className="gradient-card"><div className="gradient-card-inner">
        <h3 style={{ margin: 0 }}>{t("settings.account")}</h3>
        <div className="kv-row"><span className="k">{t("label.name")}</span><span className="v">{user?.name}</span></div>
        <div className="kv-row"><span className="k">{t("auth.email")}</span><span className="v">{user?.email}</span></div>
        <div className="kv-row"><span className="k">{t("settings.role")}</span><span className="v">{user?.role}</span></div>
        <Button variant="secondary" onClick={() => void logout()}>{t("nav.signOut")}</Button>
      </div></div>

      <form className="gradient-card" onSubmit={change}>
        <div className="gradient-card-inner">
          <h3 style={{ margin: 0 }}>{t("settings.changePassword")}</h3>
          <Input label={t("settings.currentPassword")} type="password" value={cur} onChange={(e) => setCur(e.target.value)} required />
          <Input label={t("settings.newPassword")} type="password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={8} />
          <Input label={t("settings.confirmPassword")} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} />
          {msg && <div className={msg === t("settings.passwordChanged") ? "muted" : "error"}>{msg}</div>}
          <Button disabled={busy}>{busy ? "…" : t("settings.updatePassword")}</Button>
        </div>
      </form>

      <form className="gradient-card" onSubmit={subscribe}>
        <div className="gradient-card-inner">
          <h3 style={{ margin: 0 }}>{t("settings.newsletter")}</h3>
          <span className="muted" style={{ fontSize: 12 }}>{t("settings.subscribeHint")}</span>
          <Input label={t("auth.email")} type="email" value={subEmail} onChange={(e) => setSubEmail(e.target.value)} required />
          {subMsg && <div className={subMsg === t("settings.subscribed") ? "muted" : "error"}>{subMsg}</div>}
          <Button disabled={subBusy}>{subBusy ? "…" : t("action.confirm")}</Button>
        </div>
      </form>
    </ScreenWithBg>
  );
};

export default Settings;
