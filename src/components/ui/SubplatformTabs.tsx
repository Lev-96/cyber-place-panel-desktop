import Button from "@/components/ui/Button";
import PriceInput from "@/components/ui/PriceInput";
import SubplatformNameInput, { matchSubplatforms } from "@/components/ui/SubplatformNameInput";
import { LangNames } from "@/components/ui/PlatformNameInput";
import { useLang } from "@/i18n/LanguageContext";
import { platformPriceNameOf } from "@/i18n/platformPriceName";
import { subplatformRepository } from "@/repositories/SubplatformRepository";
import { IBranchSubplatform, PlaceType } from "@/types/api";
import { visibleSubplatformTabs } from "@/utils/subplatformTabs";
import { useMemo, useState } from "react";

const EMPTY_NAMES: LangNames = { en: "", ru: "", am: "" };

interface Props {
  branchId: number;
  /** Parent platform slug. A new subcategory is created under it. */
  platform: string;
  /** All subcategories of that platform, server-ordered (default first). */
  subplatforms: IBranchSubplatform[];
  value: number | null;
  onChange: (id: number | null) => void;
  /** The place's tier — the price set here is that tier's. */
  type: PlaceType;
  /** Refresh the list after a create so the new tab can appear. */
  onCreated: (created: IBranchSubplatform) => void;
  disabled?: boolean;
}

/**
 * The second level of the platform selector: which sub-category of the chosen
 * platform this place is ("PS5", "PS5 + big screen", "PS5 + VR").
 *
 * Built as the same quick-button row as {@link PlatformPicker} rather than a
 * new tab widget, because that IS the project's tab pattern — the platform row
 * directly above looks identical, and a second, different-looking selector
 * stacked under the first would read as two unrelated controls.
 *
 * At most four buttons: Default, the two most-used, and Other. Which four is
 * decided by {@link visibleSubplatformTabs}, including the rule that the
 * current selection always keeps a button so editing a place never opens a form
 * with nothing selected. Every button is the same height whatever its label —
 * a long name is cut with an ellipsis rather than allowed to wrap and shove the
 * row taller than its neighbours (`.cp-subtab`).
 *
 * "Other" is a single field that does both jobs: type and either pick an
 * existing subcategory from the suggestions, or — when nothing matches — name a
 * new one in all three languages and price it. Creating is a plain button,
 * never a nested `<form>`: this widget lives inside the place form, and a form
 * inside a form makes Enter submit the wrong one.
 */
const SubplatformTabs = ({
  branchId,
  platform,
  subplatforms,
  value,
  onChange,
  type,
  onCreated,
  disabled,
}: Props) => {
  const { t, lang } = useLang();

  const [otherOpen, setOtherOpen] = useState(false);
  const [names, setNames] = useState<LangNames>(EMPTY_NAMES);
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const visible = useMemo(() => visibleSubplatformTabs(subplatforms, value), [subplatforms, value]);

  const nameOf = (s: IBranchSubplatform) => platformPriceNameOf(s, lang);

  const pick = (id: number | null) => {
    setOtherOpen(false);
    setNames(EMPTY_NAMES);
    setPrice("");
    setErr(null);
    onChange(id);
  };

  // Nothing matches what they typed → the fields below are creating something.
  const typed = (names[lang] ?? "").trim();
  const isCreating = typed.length > 0 && matchSubplatforms(subplatforms, typed).length === 0;

  const create = async () => {
    const en = (names.en ?? "").trim();
    // English is the identity the server slugs from, so it is the one that
    // cannot be blank — the other two are filled from it server-side.
    if (!en) {
      setErr(t("subplatform.errors.nameRequired"));
      return;
    }
    // Every tier a place uses must be priced, and this place is about to use
    // this one — so the rate is entered here rather than left for later.
    if (!price) {
      setErr(t("subplatform.errors.priceRequired"));
      return;
    }

    setBusy(true);
    setErr(null);
    try {
      const created = await subplatformRepository.create({
        branch_id: branchId,
        platform,
        name_en: en,
        name_ru: (names.ru ?? "").trim() || undefined,
        name_am: (names.am ?? "").trim() || undefined,
        [type === "vip" ? "price_vip" : "price_standard"]: Number(price),
      });

      onCreated(created);
      pick(created.id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="col" style={{ gap: 6 }}>
      <span className="label">{t("subplatform.label")}</span>

      <div className="row cp-subtabs" style={{ gap: 6 }}>
        {visible.map((s) => (
          <Button
            key={s.id}
            type="button"
            className="cp-subtab"
            variant={!otherOpen && value === s.id ? "primary" : "secondary"}
            onClick={() => pick(s.id)}
            disabled={disabled}
            title={nameOf(s)}
          >
            {nameOf(s)}
          </Button>
        ))}
        <Button
          type="button"
          className="cp-subtab"
          variant={otherOpen ? "primary" : "secondary"}
          onClick={() => setOtherOpen((v) => !v)}
          disabled={disabled}
        >
          {t("subplatform.other")}
        </Button>
      </div>

      {otherOpen && (
        <div className="col" style={{ gap: 10, padding: 10, border: "1px solid #1f2a44", borderRadius: 8 }}>
          <SubplatformNameInput
            value={names}
            onChange={setNames}
            suggestions={subplatforms}
            onPickExisting={(s) => pick(s.id)}
            disabled={disabled || busy}
          />

          {/* The price and the Add button only make sense once it is clear
              nothing existing matches — until then the operator is choosing,
              not creating, and showing a rate field would suggest otherwise. */}
          {isCreating && (
            <>
              <PriceInput label={t("subplatform.price")} value={price} onChange={setPrice} />
              <span className="muted" style={{ fontSize: 11 }}>{t("subplatform.priceRequiredHint")}</span>
              {err && <div className="error">{err}</div>}
              <div className="row" style={{ justifyContent: "flex-end" }}>
                <Button
                  type="button"
                  onClick={() => void create()}
                  disabled={disabled || busy}
                  style={{ padding: "4px 10px", fontSize: 12 }}
                >
                  {busy ? "…" : t("subplatform.add")}
                </Button>
              </div>
            </>
          )}

          {!isCreating && err && <div className="error">{err}</div>}
        </div>
      )}
    </div>
  );
};

export default SubplatformTabs;
