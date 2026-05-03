import Button from "@/components/ui/Button";
import { useLang } from "@/i18n/LanguageContext";
import { AMD_UNIT, CURRENCY_LOCALE, LANG_TO_CURRENCY, moneyDisplay } from "@/i18n/currency";
import { branchRepository } from "@/repositories/BranchRepository";
import { IBranchApi } from "@/types/api";
import { Lang } from "@/i18n/translations";
import { FormEvent, useCallback, useState } from "react";

/**
 * Branch hourly-rate matrix editor — the player-facing tariff sheet
 * keyed by `<platform>-<type>` (pc/ps4/ps5 × standard/vip). Single
 * source of truth for session billing: auto-sessions after a QR
 * confirm and the manual `SessionController::store` open mode both
 * resolve their hourly rate from this same row.
 *
 * Inputs are `type="text" inputMode="decimal"` rather than HTML5
 * `type="number"`: spinners + locale separators behave inconsistently
 * across Electron Chromium builds and can swallow keystrokes when the
 * value isn't parseable as a number, producing a "frozen field" feel.
 * Plain text + manual digit/decimal validation gives us total control
 * and works the same on every host.
 *
 * Storage is always AMD — the small suffix on each row shows the
 * equivalent in the UI language's currency at the static rate the
 * money helper uses, so the manager has live FX feedback while
 * filling the matrix.
 */

type PriceKey =
  | "pc-standard"
  | "pc-vip"
  | "ps4-standard"
  | "ps4-vip"
  | "ps5-standard"
  | "ps5-vip";

const KEYS: PriceKey[] = [
  "pc-standard",
  "pc-vip",
  "ps4-standard",
  "ps4-vip",
  "ps5-standard",
  "ps5-vip",
];

const DEVICES = ["pc", "ps4", "ps5"] as const;

interface Props {
  branch: IBranchApi;
  onSaved?: () => void;
}

const HourlyRatesForm = ({ branch, onSaved }: Props) => {
  const { t, lang } = useLang();
  const [prices, setPrices] = useState<Record<PriceKey, string>>(() => {
    const init = {} as Record<PriceKey, string>;
    for (const k of KEYS) init[k] = String(branch.price_for_branch?.[k] ?? "");
    return init;
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const set = useCallback((k: PriceKey, v: string) => {
    // Whitelist the input to digits + a single decimal separator. Any
    // other key (letters, double dots, etc.) silently drops — same UX
    // type="number" tries to give us but consistent across hosts.
    const cleaned = v.replace(",", ".");
    if (cleaned !== "" && !/^\d*\.?\d*$/.test(cleaned)) return;
    setPrices((prev) => ({ ...prev, [k]: cleaned }));
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      type Pricing = NonNullable<IBranchApi["price_for_branch"]>;
      const payload = { id: branch.price_for_branch?.id ?? 0, branch_id: branch.id } as Pricing;
      for (const k of KEYS) {
        const raw = prices[k].trim();
        if (raw === "") {
          payload[k] = null;
          continue;
        }
        const n = Number(raw);
        if (!Number.isFinite(n) || n < 0) {
          throw new Error(`Invalid value for ${k}`);
        }
        payload[k] = n;
      }
      await branchRepository.updatePricing(branch.id, payload);
      setSavedAt(Date.now());
      onSaved?.();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  // Currency code shown next to each input. AMD is the storage unit,
  // but we surface the UI-language equivalent so the manager doesn't
  // have to do mental FX while editing.
  const targetCurrency = LANG_TO_CURRENCY[lang];
  const targetLocale = CURRENCY_LOCALE[targetCurrency];

  return (
    <form onSubmit={submit} className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "100px 1fr 1fr",
          gap: 10,
          alignItems: "center",
        }}
      >
        <span />
        <span className="muted" style={{ fontSize: 12, textTransform: "uppercase" }}>
          {t("branch.prices.standard")}
        </span>
        <span className="muted" style={{ fontSize: 12, textTransform: "uppercase" }}>
          {t("branch.prices.vip")}
        </span>
        {DEVICES.map((dev) => {
          const stdKey = `${dev}-standard` as PriceKey;
          const vipKey = `${dev}-vip` as PriceKey;
          return (
            <PriceRow
              key={dev}
              device={dev}
              stdKey={stdKey}
              vipKey={vipKey}
              prices={prices}
              set={set}
              targetCurrency={targetCurrency}
              targetLocale={targetLocale}
              lang={lang}
            />
          );
        })}
      </div>
      <div className="muted" style={{ fontSize: 12 }}>
        {t("branch.prices.hint")}
      </div>
      {err && <div className="error">{err}</div>}
      <div className="row" style={{ gap: 10, alignItems: "center" }}>
        <Button disabled={busy}>{busy ? "…" : t("action.save")}</Button>
        {savedAt && !busy && !err && (
          <span className="muted" style={{ fontSize: 12 }}>
            {t("branch.prices.saved")}
          </span>
        )}
      </div>
    </form>
  );
};

interface PriceRowProps {
  device: string;
  stdKey: PriceKey;
  vipKey: PriceKey;
  prices: Record<PriceKey, string>;
  set: (k: PriceKey, v: string) => void;
  targetCurrency: "AMD" | "USD" | "RUB";
  targetLocale: string;
  lang: Lang;
}

const PriceRow = ({ device, stdKey, vipKey, prices, set, targetCurrency, targetLocale, lang }: PriceRowProps) => (
  <>
    <span style={{ fontWeight: 700, textTransform: "uppercase" }}>{device}</span>
    <PriceInput
      value={prices[stdKey]}
      onChange={(v) => set(stdKey, v)}
      targetCurrency={targetCurrency}
      targetLocale={targetLocale}
      lang={lang}
    />
    <PriceInput
      value={prices[vipKey]}
      onChange={(v) => set(vipKey, v)}
      targetCurrency={targetCurrency}
      targetLocale={targetLocale}
      lang={lang}
    />
  </>
);

interface PriceInputProps {
  value: string;
  onChange: (v: string) => void;
  targetCurrency: "AMD" | "USD" | "RUB";
  targetLocale: string;
  lang: Lang;
}

/**
 * Number input + currency suffix. The AMD value the manager types
 * lives in the underlying state, the suffix renders the conversion
 * to the UI-language currency live so they have FX feedback while
 * editing. Suffix sits inside a relative wrapper with `padding-right`
 * on the input so it never overlaps the value the user typed.
 */
const PriceInput = ({ value, onChange, targetCurrency, targetLocale, lang }: PriceInputProps) => {
  const numeric = Number(value.replace(",", "."));
  const showConverted =
    targetCurrency !== "AMD" && Number.isFinite(numeric) && numeric > 0;
  const converted = showConverted
    ? new Intl.NumberFormat(targetLocale, {
        style: "currency",
        currency: targetCurrency,
        maximumFractionDigits: 2,
      }).format(moneyDisplay.convert(numeric, targetCurrency))
    : null;
  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 2 }}>
      <div style={{ position: "relative" }}>
        <input
          className="input"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ paddingRight: 56 }}
          placeholder="0"
        />
        <span
          style={{
            position: "absolute",
            right: 12,
            top: "50%",
            transform: "translateY(-50%)",
            color: "#9aa8c7",
            fontSize: 12,
            pointerEvents: "none",
          }}
        >
          {AMD_UNIT[lang]}
        </span>
      </div>
      {converted && (
        <span className="muted" style={{ fontSize: 11, paddingLeft: 4 }}>
          ≈ {converted}
        </span>
      )}
    </div>
  );
};

export default HourlyRatesForm;
