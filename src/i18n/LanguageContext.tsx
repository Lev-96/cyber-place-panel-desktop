import { AppConfig } from "@/infrastructure/AppConfig";
import { keyValueStore } from "@/infrastructure/KeyValueStore";
import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Currency, moneyDisplay } from "./currency";
import { Lang, setActiveLang, t as translate } from "./translations";
import { hasChosenLang, readStoredLang, rememberLang } from "./languagePreference";

/** Display currency when the user hasn't picked one in Settings. The
 *  Cyber Place network base currency is AMD (dram), so the panel shows
 *  drams by default and stays on drams when the UI language changes —
 *  currency only moves when the user changes it in Settings. */
const DEFAULT_CURRENCY: Currency = "AMD";

interface LangState {
  lang: Lang;
  currency: Currency;
  setLang: (l: Lang) => void;
  setCurrencyOverride: (c: Currency | null) => void;
  t: (key: string) => string;
  money: (amountInBaseAmd: number) => string;
  /**
   * Has the stored preference finished loading?
   *
   * The key-value store is async (an IPC round-trip under Electron), so for the
   * first frames `lang` is the "en" default rather than the user's choice.
   * Gates must wait for this before deciding whether to prompt — otherwise a
   * user who picked Armenian months ago gets the first-run screen again on
   * every launch, and everyone sees a flash of English first.
   */
  ready: boolean;
  /** Whether a human has ever explicitly chosen a language on this machine. */
  chosen: boolean;
}

const Ctx = createContext<LangState | null>(null);

const KEY_CURRENCY = "cp.currencyOverride";

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLangState] = useState<Lang>("en");
  const [override, setOverride] = useState<Currency | null>(null);
  const [ready, setReady] = useState(false);
  const [chosen, setChosen] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const stored = await readStoredLang();
        if (stored) {
          setLangState(stored);
          setActiveLang(stored);
        }
        setChosen(await hasChosenLang());

        const ovr = await keyValueStore.get<Currency>(KEY_CURRENCY);
        if (ovr === "AMD" || ovr === "USD" || ovr === "RUB") setOverride(ovr);
      } finally {
        // Always flip `ready`, even if storage threw: a broken store must leave
        // the app usable on defaults, not stuck on a spinner forever.
        setReady(true);
      }
    })();
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    setActiveLang(l);
    setChosen(true);
    void rememberLang(l);
  }, []);

  const setCurrencyOverride = useCallback((c: Currency | null) => {
    setOverride(c);
    if (c) void keyValueStore.set(KEY_CURRENCY, c);
    else void keyValueStore.remove(KEY_CURRENCY);
  }, []);

  const value = useMemo<LangState>(() => {
    // Currency is decoupled from language: default to AMD, only the
    // Settings override moves it. Rates are static (no live FX fetch).
    const currency = override ?? DEFAULT_CURRENCY;
    return {
      lang,
      currency,
      setLang,
      setCurrencyOverride,
      ready,
      chosen,
      t: (key: string) => translate(key, lang),
      // Pass `lang` so AMD renders as the localized unit word
      // ("dram" / "драм" / "դрам"), never the "AMD" ISO code.
      money: (amount: number) => moneyDisplay.format(amount, currency, lang),
    };
    // AppConfig touched to silence unused import; remove if never referenced
    void AppConfig;
  }, [lang, override, ready, chosen, setLang, setCurrencyOverride]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export const useLang = (): LangState => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useLang must be used within LanguageProvider");
  return ctx;
};
