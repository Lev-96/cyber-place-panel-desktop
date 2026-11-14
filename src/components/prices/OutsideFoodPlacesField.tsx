import Checkbox from "@/components/ui/Checkbox";
import PriceInput from "@/components/ui/PriceInput";
import SectionTabs from "@/components/ui/SectionTabs";
import { ErrorState } from "@/components/ui/state";
import { useLang } from "@/i18n/LanguageContext";
import { fmt } from "@/i18n/translations";
import { memo, useState } from "react";
import {
  PLACES_TABS,
  PlaceDrafts,
  PlacesTab,
  FeePlace,
  currentFeeOf,
  defaultPlacesTab,
  draftOf,
  feeStateOf,
  groupByPlatform,
  inTab,
  matchesSearch,
  placesSummary,
  tabCounts,
} from "./outsideFoodPlaces";

/** More places than this and the list gets a search box. */
export const PLACES_SEARCH_FROM = 13;

interface Props {
  /** The branch's places; null while they load or when they failed. */
  places: readonly FeePlace[] | null;
  placesError: unknown;
  onRetryPlaces: () => void;
  drafts: PlaceDrafts;
  onChange: (placeId: number, box: string) => void;
  /** The branch's figure for a tier as the tier box reads right now; null = not charged there. */
  branchFeeFor: (type: string) => number | null;
  platformName: (slug: string) => string;
  disabled: boolean;
}

interface RowProps {
  place: FeePlace;
  box: string;
  placeholder: string;
  changed: boolean;
  disabled: boolean;
  onChange: (placeId: number, box: string) => void;
}

/**
 * One place: «№N · name», VIP / inactive chips, the box, «not charged here»
 * (= 0) and what the place does now. Memoised: a keystroke in one row
 * re-renders that row only.
 */
const PlaceFeeRow = memo(({ place, box, placeholder, changed, disabled, onChange }: RowProps) => {
  const { t } = useLang();
  const fee = currentFeeOf(place, { [place.id]: box });
  const state = feeStateOf(fee);
  const notHere = fee === 0;
  const number = place.number ?? place.id;
  const name = place.name?.trim();
  const saved = place.outside_food_fee ?? null;
  return (
    <li
      className="outside-food-place"
      data-testid={`outside-food-place-${place.id}`}
      data-state={state}
      data-changed={changed ? "1" : undefined}
    >
      <div className="outside-food-place__who">
        <span className="outside-food-place__label">{name ? `№${number} · ${name}` : `№${number}`}</span>
        {place.type === "vip" && <span className="price-badge price-badge--platform outside-food-place__chip">VIP</span>}
        {place.status === "inactive" && (
          <span className="price-badge price-badge--muted outside-food-place__chip">{t("outsideFood.places.inactive")}</span>
        )}
      </div>
      <div className="outside-food-place__controls">
        <div className="outside-food-place__box">
          <PriceInput
            value={box}
            onChange={(v) => onChange(place.id, v)}
            placeholder={placeholder}
            ariaLabel={fmt(t("outsideFood.places.inputLabel"), name ? `${number} · ${name}` : String(number))}
            disabled={disabled || notHere}
          />
        </div>
        <Checkbox
          checked={notHere}
          disabled={disabled}
          // Unticked: back to the place's own stored figure, or like the branch.
          onChange={(on) => onChange(place.id, on ? "0" : (saved !== null && saved > 0 ? draftOf(saved) : ""))}
          label={t("outsideFood.places.notHere")}
        />
        {/* A fixed slot, so the boxes line up down the list whatever the chip says. */}
        <span className="outside-food-place__state-slot">
          <span className={`outside-food-place__state outside-food-place__state--${state}`}>
            {t(`outsideFood.places.state.${state}`)}
          </span>
        </span>
      </div>
    </li>
  );
});
PlaceFeeRow.displayName = "PlaceFeeRow";

/**
 * «Своя сумма для отдельных мест» (2026-11-14, owner) — the per-place own-food
 * figures, edited in place on the Prices page and saved by the form's one
 * Save. The tabs and search only choose what is SHOWN; the summary and the
 * pending counter always count every place.
 */
const OutsideFoodPlacesField = ({
  places, placesError, onRetryPlaces, drafts, onChange, branchFeeFor, platformName, disabled,
}: Props) => {
  const { t, money } = useLang();
  const [tab, setTab] = useState<PlacesTab>(() => defaultPlacesTab(places ?? []));
  const [query, setQuery] = useState("");

  const head = (
    <div className="col outside-food-places__head">
      <span className="label">{t("outsideFood.places.title")}</span>
      <span className="muted outside-food-form__hint">{t("outsideFood.places.hint")}</span>
    </div>
  );

  if (places === null) {
    return (
      <div className="col outside-food-places" data-testid="outside-food-places">
        {head}
        {placesError
          ? <ErrorState error={placesError} onRetry={onRetryPlaces} size="compact" titleKey="outsideFood.places.loadError" descriptionKey={null} />
          : <span className="muted outside-food-form__hint">{t("outsideFood.places.loading")}</span>}
      </div>
    );
  }

  if (places.length === 0) {
    return (
      <div className="col outside-food-places" data-testid="outside-food-places">
        {head}
        <span className="muted outside-food-form__hint">{t("outsideFood.places.none")}</span>
      </div>
    );
  }

  const counts = tabCounts(places, drafts);
  const shown = places.filter((p) => inTab(p, tab, drafts) && matchesSearch(p, query));
  const groups = groupByPlatform(shown);
  const summary = placesSummary(places, drafts);
  const placeholderFor = (type: string) => {
    const fee = branchFeeFor(type);
    return fee === null
      ? t("outsideFood.places.placeholderNone")
      : fmt(t("outsideFood.places.placeholder"), money(fee));
  };
  const placeholders = { vip: placeholderFor("vip"), standard: placeholderFor("standard") };

  return (
    <div className="col outside-food-places" data-testid="outside-food-places">
      {head}
      <div className="outside-food-places__filters">
        <SectionTabs
          label={t("outsideFood.places.title")}
          value={tab}
          disabled={disabled}
          tabs={PLACES_TABS.map((key) => ({ key, label: t(`outsideFood.places.tab.${key}`), count: counts[key] }))}
          onChange={setTab}
        />
        {places.length >= PLACES_SEARCH_FROM && (
          <input
            className="input outside-food-places__search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("outsideFood.places.search")}
            aria-label={t("outsideFood.places.search")}
            autoComplete="off"
            spellCheck={false}
            maxLength={64}
          />
        )}
      </div>

      <div className="outside-food-places__list" data-testid="outside-food-places-list">
        {groups.length === 0 ? (
          <span className="muted outside-food-form__hint outside-food-places__empty">
            {t(query.trim() ? "outsideFood.places.noMatches" : "outsideFood.places.emptyTab")}
          </span>
        ) : groups.map((g) => (
          <section key={g.platform} className="outside-food-places__group" data-testid="outside-food-group" data-platform={g.platform}>
            <h4 className="outside-food-places__platform">{platformName(g.platform)}</h4>
            <ul className="outside-food-places__rows">
              {g.places.map((p) => {
                const box = drafts[p.id] ?? draftOf(p.outside_food_fee ?? null);
                const fee = currentFeeOf(p, drafts);
                return (
                  <PlaceFeeRow
                    key={p.id}
                    place={p}
                    box={box}
                    placeholder={p.type === "vip" ? placeholders.vip : placeholders.standard}
                    changed={!Number.isNaN(fee) && fee !== (p.outside_food_fee ?? null)}
                    disabled={disabled}
                    onChange={onChange}
                  />
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      <div className="outside-food-places__summary" role="status">
        <span data-testid="outside-food-summary">
          {fmt(t("outsideFood.places.summary"), summary.own, summary.notCharged, summary.branch)}
        </span>
        {summary.pending > 0 && (
          <span className="outside-food-places__pending">{fmt(t("outsideFood.places.pending"), summary.pending)}</span>
        )}
      </div>
    </div>
  );
};

export default OutsideFoodPlacesField;
