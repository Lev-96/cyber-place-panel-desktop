import { apiCache } from "@/api/client";
import { AppConfig } from "@/infrastructure/AppConfig";
import { keyValueStore } from "@/infrastructure/KeyValueStore";
import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Currency, moneyDisplay, type MoneyFormatOptions } from "./currency";
import { Lang, setActiveLang, t as translate } from "./translations";
import { hasChosenLang, readStoredLang, rememberLang } from "@/i18n/languagePreference";

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
  /**
   * Load the signed-in account's own currency, or drop back to the default
   * when nobody is signed in (2026-10-27). Called by `AccountLanguageGate`.
   */
  applyAccountCurrency: (userId: number | null) => void;
  t: (key: string) => string;
  money: (amountInBaseAmd: number, options?: MoneyFormatOptions) => string;
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

/**
 * The display currency is the PERSON's choice, kept against the account
 * (2026-10-27): it used to be one key per machine, so the currency an owner
 * picked was what the next manager on that front-desk PC saw. The old device
 * key is removed, never adopted — adopting it would hand it to whoever signs
 * in first.
 */
const LEGACY_KEY_CURRENCY = "cp.currencyOverride";
export const accountCurrencyKey = (userId: number): string => `u${userId}:cp.currencyOverride`;
const isCurrency = (c: unknown): c is Currency => c === "AMD" || c === "USD" || c === "RUB";

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLangState] = useState<Lang>("en");
  const [override, setOverride] = useState<Currency | null>(null);
  const [ready, setReady] = useState(false);
  const [chosen, setChosen] = useState(false);
  // Whose currency is on screen: writes go to that account only.
  const currencyAccount = useRef<number | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const stored = await readStoredLang();
        if (stored) {
          setLangState(stored);
          setActiveLang(stored);
        }
        setChosen(await hasChosenLang());

        void keyValueStore.remove(LEGACY_KEY_CURRENCY);
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
    // Server-written sentences (messages, validation errors, block refusals)
    // are cached with the response that carried them, in the language it was
    // fetched in. Keeping them across a language change would leave the old
    // language on screen until each entry happened to expire.
    apiCache.clear();
  }, []);

  const setCurrencyOverride = useCallback((c: Currency | null) => {
    setOverride(c);
    const userId = currencyAccount.current;
    if (userId === null) return;
    if (c) void keyValueStore.set(accountCurrencyKey(userId), c);
    else void keyValueStore.remove(accountCurrencyKey(userId));
  }, []);

  const applyAccountCurrency = useCallback((userId: number | null) => {
    currencyAccount.current = userId;
    setOverride(null);
    if (userId === null) return;
    void keyValueStore.get<Currency>(accountCurrencyKey(userId)).then((c) => {
      // The account may have changed while the read was in flight.
      if (currencyAccount.current === userId && isCurrency(c)) setOverride(c);
    }).catch(() => { /* unreadable store: the default currency stands */ });
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
      applyAccountCurrency,
      ready,
      chosen,
      t: (key: string) => translate(key, lang),
      // Pass `lang` so AMD renders as the localized unit word
      // ("dram" / "драм" / "դрам"), never the "AMD" ISO code.
      // The options are a passthrough with no default of their own, so every
      // existing caller — receipts, revenue, tariffs — formats exactly as it
      // did before.
      money: (amount: number, options?: MoneyFormatOptions) =>
        moneyDisplay.format(amount, currency, lang, options),
    };
    // AppConfig touched to silence unused import; remove if never referenced
    void AppConfig;
  }, [lang, override, ready, chosen, setLang, setCurrencyOverride, applyAccountCurrency]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export const useLang = (): LangState => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useLang must be used within LanguageProvider");
  return ctx;
};
