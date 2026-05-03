import Button from "@/components/ui/Button";
import { useLang } from "@/i18n/LanguageContext";
import { branchRepository } from "@/repositories/BranchRepository";
import { IBranchApi } from "@/types/api";
import { FormEvent, useState } from "react";

/**
 * Branch hourly-rate matrix editor — the player-facing tariff sheet
 * keyed by `<platform>-<type>` (pc/ps4/ps5 × standard/vip). This is
 * the SINGLE source of truth for session billing now: auto-sessions
 * after a QR confirm and the manual `SessionController::store` open
 * mode both resolve their hourly rate from this same row.
 *
 * Embedded inline (not modal) so it slots into the dedicated
 * /branches/:id/tariffs page and the manager — who couldn't reach
 * the modal version buried in branch settings — can edit it.
 *
 * Returned numbers are already validated/coerced on submit; on the
 * wire we always send the full row (KEYS) including nulls so a
 * cleared cell properly drops the price.
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
  const { t } = useLang();
  const [prices, setPrices] = useState<Record<PriceKey, string>>(() => {
    const init = {} as Record<PriceKey, string>;
    for (const k of KEYS) init[k] = String(branch.price_for_branch?.[k] ?? "");
    return init;
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const set = (k: PriceKey, v: string) => setPrices((prev) => ({ ...prev, [k]: v }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      // Build the full payload; backend expects each key, with nulls
      // for "not set". `id: 0` tells the API to create the row when
      // the branch doesn't have one yet — same convention the modal
      // form used.
      type Pricing = NonNullable<IBranchApi["price_for_branch"]>;
      const payload = { id: branch.price_for_branch?.id ?? 0, branch_id: branch.id } as Pricing;
      for (const k of KEYS) {
        const raw = prices[k].trim().replace(",", ".");
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
}

const PriceRow = ({ device, stdKey, vipKey, prices, set }: PriceRowProps) => (
  <>
    <span style={{ fontWeight: 700, textTransform: "uppercase" }}>{device}</span>
    <input
      className="input"
      type="number"
      min={0}
      step="0.01"
      value={prices[stdKey]}
      onChange={(e) => set(stdKey, e.target.value)}
    />
    <input
      className="input"
      type="number"
      min={0}
      step="0.01"
      value={prices[vipKey]}
      onChange={(e) => set(vipKey, e.target.value)}
    />
  </>
);

export default HourlyRatesForm;
