import Button from "@/components/ui/Button";
import PriceInput from "@/components/ui/PriceInput";
import SubplatformNameModal from "@/components/prices/SubplatformNameModal";
import { useLang } from "@/i18n/LanguageContext";
import { platformPriceNameOf } from "@/i18n/platformPriceName";
import { UpdateSubplatformBody } from "@/api/subplatforms";
import { subplatformRepository } from "@/repositories/SubplatformRepository";
import { notify } from "@/ui/notify";
import { IBranchSubplatform } from "@/types/api";
import { platformLabel } from "@/utils/platform";
import { Fragment, FormEvent, useState } from "react";

interface Props {
  subplatforms: IBranchSubplatform[];
  onSaved: () => void;
}

interface Row {
  id: number;
  standard: string; // AMD strings, like the hourly matrix
  vip: string;
}

/**
 * Inline editor for subplatform rates — deliberately the same shape as the
 * branch matrix and {@link PlatformPricesForm}: a row per entry with a Standard
 * and a VIP cell, all editable in place, saved together by one button, and the
 * name a read-only label that opens a 3-language rename on click.
 *
 * Grouped by platform, because a subplatform only means something under its
 * parent — a flat list of "Default", "Default", "+ VR" would be unreadable.
 *
 * One rule differs from platform prices, and it is the important one: **an
 * empty cell here is a value, not a gap.** Blank means "bill the same as the
 * platform", which is a thing an operator genuinely wants to go back to, so
 * clearing a rate is sent as an explicit null instead of being skipped. Platform
 * prices skip blanks because there a blank tier would leave real places with no
 * rate at all; here the platform's own rate is always underneath.
 */
const SubplatformPricesForm = ({ subplatforms, onSaved }: Props) => {
  const { t, lang } = useLang();
  const [rows, setRows] = useState<Row[]>(() =>
    subplatforms.map((s) => ({
      id: s.id,
      standard: s.price_standard != null ? String(s.price_standard) : "",
      vip: s.price_vip != null ? String(s.price_vip) : "",
    })),
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [renaming, setRenaming] = useState<IBranchSubplatform | null>(null);

  const subOf = (id: number) => subplatforms.find((s) => s.id === id);
  const nameOf = (id: number): string => {
    const s = subOf(id);
    return s ? platformPriceNameOf(s, lang) : "";
  };

  const setRow = (id: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const origVal = (id: number, tier: "standard" | "vip"): string => {
    const s = subOf(id);
    const v = s ? (tier === "vip" ? s.price_vip : s.price_standard) : null;
    return v != null ? String(v) : "";
  };
  // Numeric compare so "500" == a stored "500.00", and "" == inherit.
  const changed = (cur: string, orig: string): boolean => {
    const nc = cur.trim() === "" ? null : Number(cur);
    const no = orig.trim() === "" ? null : Number(orig);
    return nc !== no;
  };
  const dirty = rows.some(
    (r) => changed(r.standard, origVal(r.id, "standard")) || changed(r.vip, origVal(r.id, "vip")),
  );

  // Platforms in the order the server sent them, each with its own rows.
  const platforms = Array.from(new Set(subplatforms.map((s) => s.platform)));

  const remove = async (s: IBranchSubplatform) => {
    if (!confirm(`${t("subplatform.confirmDelete")}`)) return;
    setErr(null);
    try {
      await subplatformRepository.remove(s.id);
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      for (const r of rows) {
        if (!subOf(r.id)) continue;
        const body: UpdateSubplatformBody = {};

        // Null on purpose when cleared: "charge like the platform again".
        if (changed(r.standard, origVal(r.id, "standard"))) {
          body.price_standard = r.standard.trim() === "" ? null : Number(r.standard);
        }
        if (changed(r.vip, origVal(r.id, "vip"))) {
          body.price_vip = r.vip.trim() === "" ? null : Number(r.vip);
        }

        if (Object.keys(body).length > 0) {
          await subplatformRepository.update(r.id, body);
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
        {platforms.map((platform) => (
          <div key={platform} className="col" style={{ gap: 8 }}>
            <span className="muted" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>
              {platformLabel(platform)}
            </span>
            <div style={{ display: "grid", gridTemplateColumns: "150px 1fr 1fr 36px", gap: 10, alignItems: "center" }}>
              <span />
              <span className="muted" style={{ fontSize: 12, textTransform: "uppercase" }}>
                {t("branch.prices.standard")}
              </span>
              <span className="muted" style={{ fontSize: 12, textTransform: "uppercase" }}>
                {t("branch.prices.vip")}
              </span>
              <span />

              {subplatforms
                .filter((s) => s.platform === platform)
                .map((s) => {
                  const row = rows.find((r) => r.id === s.id);
                  if (!row) return null;

                  return (
                    <Fragment key={s.id}>
                      {/* Read-only label like pc/ps4/ps5 — clicking it opens the
                          3-language rename (name only; never a slug or a rate). */}
                      <button
                        type="button"
                        onClick={() => setRenaming(s)}
                        title={t("platformPrice.renameHint")}
                        style={{
                          background: "transparent", border: "none", padding: 0, color: "inherit",
                          fontWeight: 700, textAlign: "left", cursor: "pointer",
                          textDecoration: "underline dotted", textUnderlineOffset: 3,
                        }}
                      >
                        {nameOf(s.id)}
                      </button>
                      <PriceInput
                        value={row.standard}
                        onChange={(v) => setRow(s.id, { standard: v })}
                        placeholder={t("subplatform.inherits")}
                      />
                      <PriceInput
                        value={row.vip}
                        onChange={(v) => setRow(s.id, { vip: v })}
                        placeholder={t("subplatform.inherits")}
                      />
                      {/* Default has no delete: places point at it, and it is
                          the one every platform is guaranteed to have. */}
                      {s.is_default ? (
                        <span />
                      ) : (
                        <button
                          type="button"
                          onClick={() => void remove(s)}
                          title={t("action.delete")}
                          style={{
                            background: "transparent", border: "none", padding: 0,
                            color: "#ef4444", cursor: "pointer", fontSize: 16, lineHeight: 1,
                          }}
                        >
                          ✕
                        </button>
                      )}
                    </Fragment>
                  );
                })}
            </div>
          </div>
        ))}

        <div className="muted" style={{ fontSize: 12 }}>{t("subplatform.managedHint")}</div>
        {err && <div className="error">{err}</div>}
        <div className="row" style={{ gap: 10, alignItems: "center" }}>
          <Button disabled={busy || !dirty}>{busy ? "…" : t("action.save")}</Button>
          {savedAt && !busy && !err && (
            <span className="muted" style={{ fontSize: 12 }}>{t("branch.prices.saved")}</span>
          )}
        </div>
      </form>

      {renaming && (
        <SubplatformNameModal
          subplatform={renaming}
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

export default SubplatformPricesForm;
