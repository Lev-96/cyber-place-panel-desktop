import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Spinner from "@/components/ui/Spinner";
import { useAsync } from "@/hooks/useAsync";
import { useLang } from "@/i18n/LanguageContext";
import { branchRepository } from "@/repositories/BranchRepository";
import { pcRepository } from "@/repositories/PcRepository";
import { IBranchApi } from "@/types/api";
import { IPcApi } from "@/types/sessions";
import { FormEvent, useEffect, useMemo, useState } from "react";

interface Props {
  branchId: number;
  initial?: IPcApi;
  onClose: () => void;
  onSaved: (pc: IPcApi) => void;
}

/**
 * Tier key for the branch's hourly-rate matrix. The form picks a
 * tier; the resolved AMD value lives in `pc.hourly_rate` on save.
 * Single source of truth for prices remains the branch matrix —
 * the form just enforces "no hand-typed rates".
 */
type TierKey =
  | "pc-standard" | "pc-vip"
  | "ps4-standard" | "ps4-vip"
  | "ps5-standard" | "ps5-vip";

interface TierOption {
  key: TierKey;
  /** Localised label, e.g. "Standard" / "PS4 VIP". */
  label: string;
  /** AMD value from the branch matrix; null when the cell is empty. */
  amount: number | null;
}

const PcForm = ({ branchId, initial, onClose, onSaved }: Props) => {
  const { t, money } = useLang();
  const [label, setLabel] = useState(initial?.label ?? "");
  const [mac, setMac] = useState(initial?.mac_address ?? "");
  const [placeId, setPlaceId] = useState<string>(initial?.place_id ? String(initial.place_id) : "");
  const [kind, setKind] = useState<"pc" | "ps">(initial?.kind ?? "pc");

  // Branch matrix — drives the tier select. Cached for the lifetime
  // of this modal so switching kind doesn't refetch.
  const branch = useAsync(() => branchRepository.byId(branchId), [branchId]);
  const matrix = branch.data?.price_for_branch ?? null;

  // Tier options visible for the current kind. PCs see two rows, PS
  // consoles see four because PS4 and PS5 are billed separately.
  const tierOptions = useMemo<TierOption[]>(
    () => buildTierOptions(kind, matrix, t),
    [kind, matrix, t],
  );

  // Selected tier. On edit we try to match the existing rate to a
  // tier; on create we pick the first non-empty tier so the form
  // always has a sensible default.
  const [selectedTier, setSelectedTier] = useState<TierKey | "">("");
  useEffect(() => {
    if (selectedTier !== "") return; // user has already picked
    if (tierOptions.length === 0) return;
    if (initial?.hourly_rate != null) {
      const match = tierOptions.find((o) => o.amount === Number(initial.hourly_rate));
      if (match) { setSelectedTier(match.key); return; }
    }
    const firstPriced = tierOptions.find((o) => o.amount != null);
    if (firstPriced) setSelectedTier(firstPriced.key);
  }, [tierOptions, initial, selectedTier]);

  // When kind flips (pc ↔ ps) the previously selected tier no longer
  // exists — reset so the next render's effect picks a valid default.
  useEffect(() => { setSelectedTier(""); }, [kind]);

  const selectedAmount = useMemo(
    () => tierOptions.find((o) => o.key === selectedTier)?.amount ?? null,
    [selectedTier, tierOptions],
  );

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const place_id = placeId ? Number(placeId) : null;
      const body = {
        label,
        kind,
        hourly_rate: selectedAmount,
        mac_address: mac || null,
        place_id,
      };
      const pc = initial
        ? await pcRepository.update(initial.id, body)
        : await pcRepository.create({ branch_id: branchId, ...body });
      onSaved(pc);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to save");
    } finally { setBusy(false); }
  };

  const noPricesYet = !branch.loading && tierOptions.every((o) => o.amount == null);
  const mismatchWarning =
    !!initial?.hourly_rate &&
    selectedTier !== "" &&
    selectedAmount !== Number(initial.hourly_rate);

  return (
    <Modal open onClose={onClose}>
      <form className="card" style={{ width: 460, maxWidth: "90vw", display: "flex", flexDirection: "column", gap: 14 }} onSubmit={submit}>
        <h2 style={{ margin: 0 }}>{initial ? t("pcs.editDevice") : t("pcs.newDevice")}</h2>

        <div className="col" style={{ gap: 6 }}>
          <span className="label">{t("pcs.kind")}</span>
          <div className="row" style={{ gap: 8 }}>
            <button type="button" onClick={() => setKind("pc")} style={tabStyle(kind === "pc")}>{t("pcs.kindPc")}</button>
            <button type="button" onClick={() => setKind("ps")} style={tabStyle(kind === "ps")}>{t("pcs.kindPs")}</button>
          </div>
        </div>

        <Input label={t("pcs.label")} value={label} onChange={(e) => setLabel(e.target.value)} required autoFocus />

        <div className="col" style={{ gap: 6 }}>
          <span className="label">{t("pcs.tierLabel")}</span>
          {branch.loading ? (
            <Spinner />
          ) : noPricesYet ? (
            <p className="muted" style={{ margin: 0, color: "#f59e0b" }}>
              {t("pcs.tierNoPrices")}
            </p>
          ) : (
            <select
              value={selectedTier}
              onChange={(e) => setSelectedTier(e.target.value as TierKey)}
              style={selectStyle}
              required
            >
              <option value="" disabled>{t("pcs.tierPlaceholder")}</option>
              {tierOptions.map((o) => (
                <option key={o.key} value={o.key} disabled={o.amount == null}>
                  {o.label}{o.amount != null ? ` — ${money(o.amount)}/${t("time.hourShort")}` : ` — ${t("pcs.tierEmpty")}`}
                </option>
              ))}
            </select>
          )}
          {mismatchWarning && (
            <span className="muted" style={{ fontSize: 11, color: "#f59e0b" }}>
              {t("pcs.tierOverwrite")}
            </span>
          )}
        </div>

        {kind === "pc" && (
          <>
            <Input
              label="MAC address"
              placeholder="AA:BB:CC:DD:EE:FF"
              value={mac ?? ""}
              onChange={(e) => setMac(e.target.value)}
            />
            <span className="muted" style={{ fontSize: 11, marginTop: -8 }}>
              {t("pcs.macHint")}
            </span>
          </>
        )}
        {kind === "ps" && (
          <span className="muted" style={{ fontSize: 12 }}>
            {t("pcs.psHint")}
          </span>
        )}
        <Input label={t("pcs.placeId")} type="number" value={placeId} onChange={(e) => setPlaceId(e.target.value)} />
        {err && <div className="error">{err}</div>}
        <div className="row-between">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>{t("action.cancel")}</Button>
          <Button disabled={busy || !label || noPricesYet || selectedTier === ""}>
            {busy ? "…" : t("action.save")}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

const buildTierOptions = (
  kind: "pc" | "ps",
  matrix: IBranchApi["price_for_branch"] | null,
  t: (key: string) => string,
): TierOption[] => {
  // PC kind sees only the two PC tiers — exposing PS4/PS5 rows here
  // would just be noise on a PC device card.
  if (kind === "pc") {
    return [
      { key: "pc-standard", label: t("pcs.tier.pcStandard"), amount: numOrNull(matrix?.["pc-standard"]) },
      { key: "pc-vip",      label: t("pcs.tier.pcVip"),      amount: numOrNull(matrix?.["pc-vip"]) },
    ];
  }
  // PS kind covers both generations. Operators frequently price PS4
  // and PS5 differently, so we surface all four cells.
  return [
    { key: "ps4-standard", label: t("pcs.tier.ps4Standard"), amount: numOrNull(matrix?.["ps4-standard"]) },
    { key: "ps4-vip",      label: t("pcs.tier.ps4Vip"),      amount: numOrNull(matrix?.["ps4-vip"]) },
    { key: "ps5-standard", label: t("pcs.tier.ps5Standard"), amount: numOrNull(matrix?.["ps5-standard"]) },
    { key: "ps5-vip",      label: t("pcs.tier.ps5Vip"),      amount: numOrNull(matrix?.["ps5-vip"]) },
  ];
};

const numOrNull = (v: number | null | undefined): number | null => {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const tabStyle = (active: boolean): React.CSSProperties => ({
  flex: 1,
  padding: "8px 10px",
  border: `1px solid ${active ? "#07ddf1" : "#1f2a44"}`,
  background: active ? "#101a35" : "transparent",
  color: active ? "#07ddf1" : "#9aa8c7",
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 600,
});

const selectStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  background: "transparent",
  color: "#e5e7eb",
  border: "1px solid #1f2a44",
  borderRadius: 8,
  fontSize: 14,
};

export default PcForm;
