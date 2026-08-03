import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import MultiLangInput, { LangValues, emptyLangValues, hasAnyValue } from "@/components/ui/MultiLangInput";
import PriceInput from "@/components/ui/PriceInput";
import { useLang } from "@/i18n/LanguageContext";
import { platformPriceNameOf } from "@/i18n/platformPriceName";
import { subplatformRepository } from "@/repositories/SubplatformRepository";
import { IBranchSubplatform, PlaceType } from "@/types/api";
import { hiddenSubplatforms, visibleSubplatformTabs } from "@/utils/subplatformTabs";
import { useMemo, useState } from "react";

interface Props {
  branchId: number;
  /** Parent platform slug. A new subplatform is created under it. */
  platform: string;
  /** All subplatforms of that platform, server-ordered (default first). */
  subplatforms: IBranchSubplatform[];
  value: number | null;
  onChange: (id: number | null) => void;
  /** The place's tier — the price shown and set here is that tier's. */
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
 * directly above it looks identical, and a second, different-looking selector
 * stacked under the first would read as two unrelated controls.
 *
 * At most four buttons: Default, the two most-used, and Other. Which four is
 * decided by {@link visibleSubplatformTabs}, including the rule that the
 * current selection always keeps a button so editing a place never opens a form
 * with nothing selected.
 *
 * "Other" opens a panel that does both jobs the operator needs there — find an
 * existing subplatform, or name a new one and price it on the spot. Creating is
 * a plain button, never a nested `<form>`: this widget lives inside the place
 * form, and a form inside a form makes Enter submit the wrong one.
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
  const { t, money, lang } = useLang();

  const [otherOpen, setOtherOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [names, setNames] = useState<LangValues>(emptyLangValues);
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const visible = useMemo(() => visibleSubplatformTabs(subplatforms, value), [subplatforms, value]);
  const hidden = useMemo(() => hiddenSubplatforms(subplatforms, visible), [subplatforms, visible]);

  const nameOf = (s: IBranchSubplatform) => platformPriceNameOf(s, lang);
  const rateOf = (s: IBranchSubplatform) => (type === "vip" ? s.price_vip : s.price_standard);

  // Matched across ALL locales, like the platform autocomplete: an operator
  // typing in any language finds the subplatform whatever it was named in.
  const found = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return hidden;

    return hidden.filter((s) =>
      [s.name_en, s.name_ru, s.name_am].some((n) => (n ?? "").toLowerCase().includes(q)),
    );
  }, [hidden, query]);

  const pick = (id: number | null) => {
    setOtherOpen(false);
    onChange(id);
  };

  const create = async () => {
    const en = (names.en ?? "").trim();
    // English is the identity the server slugs from, so it is the one that
    // cannot be blank — the other two are filled from it server-side.
    if (!en) {
      setErr(t("subplatform.errors.nameRequired"));
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
        // Blank means "same price as the platform" — a real choice, so it is
        // sent as null rather than being treated as a missing field.
        [type === "vip" ? "price_vip" : "price_standard"]: price ? Number(price) : null,
      });

      setNames(emptyLangValues());
      setPrice("");
      setOtherOpen(false);
      onCreated(created);
      onChange(created.id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="col" style={{ gap: 6 }}>
      <span className="label">{t("subplatform.label")}</span>

      <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
        {visible.map((s) => (
          <Button
            key={s.id}
            type="button"
            variant={!otherOpen && value === s.id ? "primary" : "secondary"}
            onClick={() => pick(s.id)}
            disabled={disabled}
            style={{ flex: 1, minWidth: 72 }}
          >
            {nameOf(s)}
          </Button>
        ))}
        <Button
          type="button"
          variant={otherOpen ? "primary" : "secondary"}
          onClick={() => setOtherOpen((v) => !v)}
          disabled={disabled}
          style={{ flex: 1, minWidth: 72 }}
        >
          {t("subplatform.other")}
        </Button>
      </div>

      {otherOpen && (
        <div className="col" style={{ gap: 10, padding: 10, border: "1px solid #1f2a44", borderRadius: 8 }}>
          <Input
            label={t("subplatform.search")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("subplatform.searchPlaceholder")}
            autoComplete="off"
            autoFocus
          />

          {found.length > 0 && (
            <div className="col" style={{ gap: 4, maxHeight: 160, overflowY: "auto" }}>
              {found.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="row-between"
                  onClick={() => pick(s.id)}
                  style={{
                    background: value === s.id ? "#101a35" : "transparent",
                    border: "1px solid #1f2a44",
                    borderRadius: 6,
                    padding: "6px 8px",
                    color: "inherit",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span>{nameOf(s)}</span>
                  <span className="muted" style={{ fontSize: 12 }}>
                    {rateOf(s) != null ? money(Number(rateOf(s))) : t("subplatform.inherits")}
                  </span>
                </button>
              ))}
            </div>
          )}

          {query.trim() !== "" && found.length === 0 && (
            <span className="muted" style={{ fontSize: 11 }}>{t("subplatform.noneFound")}</span>
          )}

          <div className="col" style={{ gap: 8, borderTop: "1px solid #1f2a44", paddingTop: 10 }}>
            <span className="label">{t("subplatform.create")}</span>
            <MultiLangInput
              label={t("subplatform.name")}
              values={names}
              onChange={setNames}
              fieldClass="subplatform_name"
              maxChars={60}
              disabled={disabled || busy}
            />
            <PriceInput label={t("subplatform.price")} value={price} onChange={setPrice} />
            <span className="muted" style={{ fontSize: 11 }}>{t("subplatform.priceHint")}</span>
            {err && <div className="error">{err}</div>}
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <Button
                type="button"
                onClick={() => void create()}
                disabled={disabled || busy || !hasAnyValue(names)}
                style={{ padding: "4px 10px", fontSize: 12 }}
              >
                {busy ? "…" : t("subplatform.add")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubplatformTabs;
