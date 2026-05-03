import { AppConfig } from "@/infrastructure/AppConfig";
import { keyValueStore } from "@/infrastructure/KeyValueStore";
import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Currency, LANG_TO_CURRENCY, moneyDisplay } from "./currency";
import { Lang, t as translate } from "./translations";

interface LangState {
  lang: Lang;
  currency: Currency;
  setLang: (l: Lang) => void;
  setCurrencyOverride: (c: Currency | null) => void;
  t: (key: string) => string;
  money: (amountInBaseAmd: number) => string;
}

const Ctx = createContext<LangState | null>(null);

const KEY_LANG = "cp.lang";
const KEY_CURRENCY = "cp.currencyOverride";

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLangState] = useState<Lang>("en");
  const [override, setOverride] = useState<Currency | null>(null);

  useEffect(() => {
    void (async () => {
      const stored = await keyValueStore.get<Lang>(KEY_LANG);
      if (stored === "en" || stored === "ru" || stored === "am") setLangState(stored);
      const ovr = await keyValueStore.get<Currency>(KEY_CURRENCY);
      if (ovr === "AMD" || ovr === "USD" || ovr === "RUB") setOverride(ovr);
    })();
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    void keyValueStore.set(KEY_LANG, l);
  }, []);

  const setCurrencyOverride = useCallback((c: Currency | null) => {
    setOverride(c);
    if (c) void keyValueStore.set(KEY_CURRENCY, c);
    else void keyValueStore.remove(KEY_CURRENCY);
  }, []);

  const value = useMemo<LangState>(() => {
    const currency = override ?? LANG_TO_CURRENCY[lang];
    return {
      lang,
      currency,
      setLang,
      setCurrencyOverride,
      t: (key: string) => translate(key, lang),
      // Pass `lang` so AMD renders as the localized unit word
      // ("dram" / "драм" / "դрамm"), never the "AMD" ISO code.
      money: (amount: number) => moneyDisplay.format(amount, currency, lang),
    };
    // AppConfig touched to silence unused import; remove if never referenced
    void AppConfig;
  }, [lang, override, setLang, setCurrencyOverride]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export const useLang = (): LangState => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useLang must be used within LanguageProvider");
  return ctx;
};
