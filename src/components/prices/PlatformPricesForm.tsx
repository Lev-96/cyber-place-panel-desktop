import Button from "@/components/ui/Button";
import PriceInput from "@/components/ui/PriceInput";
import PlatformNameModal from "@/components/prices/PlatformNameModal";
import { useLang } from "@/i18n/LanguageContext";
import { platformPriceNameOf } from "@/i18n/platformPriceName";
import { UpdatePlatformPriceBody } from "@/api/platformPrices";
import { platformPriceRepository } from "@/repositories/PlatformPriceRepository";
import { notify } from "@/ui/notify";
import { IBranchPlatformPrice } from "@/types/api";
import { Fragment, FormEvent, useState } from "react";

interface Props {
  prices: IBranchPlatformPrice[];
  onSaved: () => void;
}

interface Row {
  id: number;
  standard: string; // AMD strings, like the hourly matrix
  vip: string;
}

/**
 * Inline editor for custom-platform hourly rates — the exact same shape as the
 * branch matrix (HourlyRatesForm): a row per platform with a Standard and a VIP
 * cell, all editable in place, saved together by one button. The platform name
 * is a READ-ONLY label exactly like pc/ps4/ps5 — only the rates are editable.
 *
 * Prices are created implicitly from Places (a row only appears once its
 * platform has a place), so this form never ADDS/removes rows and never renames
 * — it only edits the rates. An empty cell is left as-is on save so a tier that
 * bills real places can't be blanked by accident.
 */
const PlatformPricesForm = ({ prices, onSaved }: Props) => {
  const { t, lang } = useLang();
  const [rows, setRows] = useState<Row[]>(() =>
    prices.map((p) => ({
      id: p.id,
      standard: p.price_standard != null ? String(p.price_standard) : "",
      vip: p.price_vip != null ? String(p.price_vip) : "",
    })),
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  // The platform whose name is being edited in the rename modal.
  const [renaming, setRenaming] = useState<IBranchPlatformPrice | null>(null);

  const priceOf = (id: number) => prices.find((x) => x.id === id);
  const nameOf = (id: number): string => {
    const p = priceOf(id);
    return p ? platformPriceNameOf(p, lang) : "";
  };

  const setRow = (id: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  // Stored value for a tier, as a comparable string ("" when unset).
  const origVal = (id: number, tier: "standard" | "vip"): string => {
    const p = prices.find((x) => x.id === id);
    const v = p ? (tier === "vip" ? p.price_vip : p.price_standard) : null;
    return v != null ? String(v) : "";
  };
  // Numeric compare so "500" == a stored "500.00", and "" == unset.
  const changed = (cur: string, orig: string): boolean => {
    const nc = cur.trim() === "" ? null : Number(cur);
    const no = orig.trim() === "" ? null : Number(orig);
    return nc !== no;
  };
  // Save stays disabled until at least one tier differs from what's stored.
  const dirty = rows.some((r) => changed(r.standard, origVal(r.id, "standard")) || changed(r.vip, origVal(r.id, "vip")));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      for (const r of rows) {
        if (!prices.find((p) => p.id === r.id)) continue;
        const body: UpdatePlatformPriceBody = {};

        // Only send a tier that actually changed AND is non-empty — never blank
        // a tier that bills places.
        if (r.standard && changed(r.standard, origVal(r.id, "standard"))) body.price_standard = Number(r.standard);
        if (r.vip && changed(r.vip, origVal(r.id, "vip"))) body.price_vip = Number(r.vip);

        if (Object.keys(body).length > 0) {
          await platformPriceRepository.update(r.id, body);
        }
      }
      notify.success("prices", "saved");
      setSavedAt(Date.now());
      onSaved();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
    <form onSubmit={submit} className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "100px 1fr 1fr", gap: 10, alignItems: "center" }}>
        <span />
        <span className="muted" style={{ fontSize: 12, textTransform: "uppercase" }}>{t("branch.prices.standard")}</span>
        <span className="muted" style={{ fontSize: 12, textTransform: "uppercase" }}>{t("branch.prices.vip")}</span>
        {rows.map((r) => (
          <Fragment key={r.id}>
            {/* Read-only label like pc/ps4/ps5 — clicking it opens the rename
                modal (name only; never touches the slug or any rate). */}
            <button
              type="button"
              onClick={() => setRenaming(priceOf(r.id) ?? null)}
              title={t("platformPrice.renameHint")}
              style={{
                background: "transparent", border: "none", padding: 0, color: "inherit",
                fontWeight: 700, textAlign: "left", cursor: "pointer", textDecoration: "underline dotted",
                textUnderlineOffset: 3,
              }}
            >
              {nameOf(r.id)}
            </button>
            <PriceInput value={r.standard} onChange={(v) => setRow(r.id, { standard: v })} />
            <PriceInput value={r.vip} onChange={(v) => setRow(r.id, { vip: v })} />
          </Fragment>
        ))}
      </div>
      <div className="muted" style={{ fontSize: 12 }}>{t("platformPrice.managedInPlaces")}</div>
      {err && <div className="error">{err}</div>}
      <div className="row" style={{ gap: 10, alignItems: "center" }}>
        <Button disabled={busy || !dirty}>{busy ? "…" : t("action.save")}</Button>
        {savedAt && !busy && !err && <span className="muted" style={{ fontSize: 12 }}>{t("branch.prices.saved")}</span>}
      </div>
    </form>

    {renaming && (
      <PlatformNameModal
        price={renaming}
        onClose={() => setRenaming(null)}
        onSaved={() => {
          setRenaming(null);
          onSaved();
        }}
      />
    )}
    </>
  );
};

export default PlatformPricesForm;
