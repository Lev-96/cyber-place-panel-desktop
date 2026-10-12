import { useAuth } from "@/auth/AuthContext";
import Button from "@/components/ui/Button";
import ScreenWithBg from "@/components/ui/ScreenWithBg";
import { useLang } from "@/i18n/LanguageContext";
import { AMD_UNIT, Currency } from "@/i18n/currency";
import { LANGUAGES, Lang } from "@/i18n/translations";

const Settings = () => {
  const { user, logout } = useAuth();
  const { t, lang, setLang, currency, setCurrencyOverride, money } = useLang();

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
        <div className="kv-row"><span className="k">{t("settings.role")}</span><span className="v">{user?.role ? t(`role.${user.role}`) : ""}</span></div>
        <Button variant="secondary" onClick={() => void logout()}>{t("nav.signOut")}</Button>
      </div></div>
    </ScreenWithBg>
  );
};

export default Settings;
