import Button from "@/components/ui/Button";
import { apiSaveEntityTranslations } from "@/api/translations";
import MultiLangInput, { LangValues, langValuesFromField, primaryValue } from "@/components/ui/MultiLangInput";
import { formatApiError } from "@/api/errors";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import PriceInput from "@/components/ui/PriceInput";
import Checkbox from "@/components/ui/Checkbox";
import PlatformPicker from "@/components/ui/PlatformPicker";
import PlatformNameInput, { LangNames } from "@/components/ui/PlatformNameInput";
import SubplatformTabs from "@/components/ui/SubplatformTabs";
import Spinner from "@/components/ui/Spinner";
import GameForm from "@/components/games/GameForm";
import { useAuth } from "@/auth/AuthContext";
import { can } from "@/auth/permissions";
import { useAsync } from "@/hooks/useAsync";
import { useLang } from "@/i18n/LanguageContext";
import { platformPriceNameOf } from "@/i18n/platformPriceName";
import { gameRepository } from "@/repositories/GameRepository";
import { placeRepository } from "@/repositories/PlaceRepository";
import { subplatformRepository } from "@/repositories/SubplatformRepository";
import { IBranchPlace, IBranchPlatformPrice, PlaceType } from "@/types/api";
import { isKnownPlatform, platformLabel, slugifyPlatform } from "@/utils/platform";
import { FormEvent, useEffect, useState } from "react";

const EMPTY_NAMES: LangNames = { en: "", ru: "", am: "" };

interface Props {
  branchId: number;
  initial?: IBranchPlace;
  /** Existing custom-platform slugs to autocomplete in the platform picker. */
  platformSuggestions?: string[];
  /**
   * Existing custom-platform prices for this branch. When the chosen custom
   * platform already has one, the operator can't set a new rate — the existing
   * price is applied ("pick", not re-price). A brand-new platform lets them
   * enter a name + rate, which creates the branch price on save.
   */
  platformPrices?: IBranchPlatformPrice[];
  onClose: () => void;
  onSaved: () => void;
}

const TYPES: PlaceType[] = ["standard", "vip"];

const PlaceForm = ({ branchId, initial, platformSuggestions, platformPrices, onClose, onSaved }: Props) => {
  const { t, money, lang } = useLang();
  const { user } = useAuth();
  // Branch-scoped game creation: admin, owner AND the manager who actually
  // registers the place. Mirrored server-side by GameBranchAuthorizer.
  const canCreateGames = can(user?.role, "game.crud.branch");
  // Global catalogue (NOT branch-scoped): a place bills against the shared
  // games list filtered by platform. Scoping to the branch here would hide
  // admin-created pc/ps4/ps5 games that aren't pinned to any branch.
  const games = useAsync(() => gameRepository.list(), []);
  const [number, setNumber] = useState(initial ? String(initial.number ?? "") : "");
  const [name, setName] = useState<LangValues>(
    () => langValuesFromField(initial?.i18n, "name", initial?.name, lang),
  );
  const [type, setType] = useState<PlaceType>(initial?.type ?? "standard");
  const [platform, setPlatform] = useState<string>(initial?.platform ?? "pc");
  // Which sub-category of that platform. Null = none chosen yet; the effect
  // below settles it to Default once this platform's list has loaded.
  const [subplatformId, setSubplatformId] = useState<number | null>(initial?.subplatform_id ?? null);
  const [hourlyRate, setHourlyRate] = useState(initial?.hourly_rate != null ? String(initial.hourly_rate) : "");
  const [gameIds, setGameIds] = useState<Set<number>>(new Set((initial?.games ?? []).map((g) => g.id)));
  // A custom platform may legitimately have NO games (table tennis, a poker
  // table…). Instead of dumping an empty "no games" list on the operator, we
  // gate the games UI behind an explicit "does this platform have games?"
  // toggle — pre-checked on edit when the place already carries games.
  const [hasGames, setHasGames] = useState<boolean>((initial?.games?.length ?? 0) > 0);
  const [gameCreating, setGameCreating] = useState(false);

  // A custom (non-pc/ps4/ps5) platform has no cell in the branch tariff
  // matrix, so it carries its own per-hour price entered right here.
  const isCustomPlatform = !isKnownPlatform(platform);
  // The branch price already defined for this custom platform, if any. Its
  // presence flips the price UI from "set a rate" to "this price applies" —
  // the operator picks the existing rate instead of inventing a new one.
  const existingPrice = isCustomPlatform
    ? (platformPrices ?? []).find((pp) => pp.platform === platform)
    : undefined;
  // A brand-new custom platform = custom AND no price row at all. Only then does
  // the operator NAME it (a named platform is only named once).
  const customNew = isCustomPlatform && !existingPrice;
  /**
   * A platform that actually exists, so it is safe to ask for its subplatforms.
   *
   * Deliberately NOT just `platform !== ""`. While the operator types the name
   * of a brand-new custom platform the slug changes on every keystroke, and
   * listing a platform CREATES its Default subplatform server-side — so the
   * naive version would leave a trail of default rows for "t", "te", "ten"…
   * before the real "tennis" ever existed. Known platforms are always real;
   * a custom one is real once it has a price row.
   */
  const platformSettled = platform !== "" && (!isCustomPlatform || !!existingPrice);
  // Reloads whenever the platform changes — subplatforms belong to a platform,
  // so switching pc → ps5 must not leave the previous platform's tabs on screen.
  const subplatforms = useAsync(
    () => (platformSettled ? subplatformRepository.listByPlatform(branchId, platform) : Promise.resolve([])),
    [branchId, platform, platformSettled],
  );
  // Pricing is per tier (standard/vip). The rate for THIS place's type may
  // already be set even when the platform exists — then it locks. A platform
  // can exist with only one tier priced, so the other tier still needs a rate.
  const tierPrice = existingPrice
    ? (type === "vip" ? existingPrice.price_vip : existingPrice.price_standard)
    : null;
  const tierLocked = tierPrice != null; // this platform+type already priced
  const typeLabel = type === "vip" ? t("branch.prices.vip") : t("branch.prices.standard");
  // Multilingual наименование for that new platform's price row. The English
  // value is the identity: the platform slug is derived from it, so the same
  // platform resolves the same way regardless of the panel's language.
  const [names, setNames] = useState<LangNames>(EMPTY_NAMES);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Platform selection from the picker: a known slug (pc/ps4/ps5) or "" when
  // the operator hits "Other". Switching to Other starts a fresh custom name.
  const handlePlatformPick = (v: string) => {
    setPlatform(v);
    if (!isKnownPlatform(v)) setNames(EMPTY_NAMES);
  };

  // Typing the наименование drives the slug (from English) — that is the
  // platform identity persisted on the place + used to match an existing price.
  // Trim before slugifying so a stray trailing space ("tennis " → "tennis-")
  // can't fork a duplicate platform past the case-insensitive match.
  const handleNamesChange = (v: LangNames) => {
    setNames(v);
    setPlatform(slugifyPlatform(v.en.trim()));
  };

  // Adopting an existing platform from the suggestions: fill every locale and
  // snap to its exact slug so its already-defined price locks in.
  const handlePickExisting = (p: IBranchPlatformPrice) => {
    setNames({ en: p.name_en ?? "", ru: p.name_ru ?? "", am: p.name_am ?? "" });
    setPlatform(p.platform);
  };

  /**
   * Keep the chosen subplatform valid for the platform actually selected.
   *
   * Two cases, and getting either wrong bills the place wrong:
   *  - the selection belongs to the previous platform (pc → ps5) — it must go,
   *    otherwise the place would carry a PC subplatform's price;
   *  - nothing is selected — settle on Default, so a place always lands in a
   *    real sub-category instead of silently having none.
   */
  useEffect(() => {
    const list = subplatforms.data;
    if (!list) return;

    setSubplatformId((prev) => {
      if (prev != null && list.some((s) => s.id === prev)) return prev;

      return list.find((s) => s.is_default)?.id ?? null;
    });
  }, [subplatforms.data]);

  // The sub-category this place will bill from, if the list has loaded.
  const subplatform = (subplatforms.data ?? []).find((s) => s.id === subplatformId);
  // A NON-default subcategory owns the rate for the place entirely. Default is
  // the platform itself and inherits, so pc/ps4/ps5 keep billing from the
  // tariff matrix and a custom platform from its own price.
  const ownsRate = !!subplatform && !subplatform.is_default;
  const subplatformRate = ownsRate
    ? (type === "vip" ? subplatform!.price_vip : subplatform!.price_standard)
    : null;
  /**
   * This subcategory has no rate for the tier the place is on, so one must be
   * entered here — creating the place is what sets it.
   *
   * This is what makes switching Standard → VIP ask for a price: the same
   * subcategory can be priced for one tier and not the other, and reusing the
   * Standard rate for VIP would silently erase the VIP premium.
   */
  const needsSubplatformRate = ownsRate && subplatformRate == null;

  // Auto-suggest next available number on create
  useEffect(() => {
    if (initial || number) return;
    void placeRepository.nextNumber(branchId).then((n) => setNumber(String(n))).catch(() => {});
  }, [branchId, initial, number]);

  const toggleGame = (id: number) => {
    const next = new Set(gameIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setGameIds(next);
  };

  const filteredGames = (games.data ?? []).filter((g) => g.platform === platform);

  // Existing custom platforms to autocomplete in the picker: the branch's
  // places (passed in) plus any platform that already has games in the catalogue.
  const platformOptions = Array.from(
    new Set([
      ...(platformSuggestions ?? []),
      // Platforms that already have a branch price — offer them even if no
      // place uses them yet, so the operator re-picks the priced platform.
      ...(platformPrices ?? []).map((pp) => pp.platform),
      ...(games.data ?? []).map((g) => g.platform).filter((p) => !isKnownPlatform(p)),
    ]),
  );

  // A place targets ONE platform, so its games must all belong to that
  // platform. When the operator switches platform (e.g. pc → ps4), drop any
  // games that were picked for the previous platform — otherwise a place
  // could be saved carrying games from a platform it no longer is. We wait
  // for the catalogue to load before pruning so an edit's initial games
  // (which already match the saved platform) are never cleared prematurely.
  useEffect(() => {
    if (!games.data) return;
    const validForPlatform = new Set(
      games.data.filter((g) => g.platform === platform).map((g) => g.id),
    );
    setGameIds((prev) => {
      const next = new Set([...prev].filter((gid) => validForPlatform.has(gid)));
      return next.size === prev.size ? prev : next;
    });
  }, [platform, games.data]);

  // Turning the games toggle OFF means "this platform has no games" — clear
  // any selection so a games-free place is never saved carrying stale ids.
  const toggleHasGames = (next: boolean) => {
    setHasGames(next);
    if (!next) setGameIds(new Set());
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const num = Number(number);
    if (!Number.isFinite(num) || num <= 0) return setErr(t("place.errors.number"));
    // For a brand-new custom platform the English наименование is mandatory
    // (its slug is the platform identity). A rate is mandatory whenever THIS
    // tier isn't priced yet. A locked tier needs neither.
    const finalPlatform = customNew ? slugifyPlatform(names.en.trim()) : platform;
    if (customNew && !finalPlatform) return setErr(t("place.errors.nameRequired"));
    // The subcategory owns the rate: priced → nothing to ask, unpriced → the
    // rate is mandatory. Only when no subcategory owns it does the platform's
    // own "price this tier" rule apply.
    if (needsSubplatformRate && !hourlyRate) {
      return setErr(t("subplatform.errors.priceRequired"));
    }
    if (!ownsRate && isCustomPlatform && !tierLocked && !hourlyRate) {
      return setErr(t("place.errors.priceRequired"));
    }
    setBusy(true); setErr(null);
    try {
      const body = {
        branch_id: branchId,
        number: num,
        name: primaryValue(name, lang) || null,
        type,
        platform: finalPlatform,
        // The sub-category this place bills from. Null is normal — it simply
        // means the place bills from its platform, as every place did before.
        subplatform_id: subplatformId,
        // Known platforms bill from the matrix (null). An already-priced tier
        // reuses that rate (server ignores any override). An unpriced tier
        // sends its rate — the server seeds that tier's price; a brand-new
        // platform additionally carries the per-locale platform_name below.
        hourly_rate: isCustomPlatform
          ? (tierLocked ? Number(tierPrice) : (hourlyRate ? Number(hourlyRate) : null))
          : null,
        platform_name_en: customNew ? (names.en.trim() || undefined) : undefined,
        platform_name_ru: customNew ? (names.ru.trim() || undefined) : undefined,
        platform_name_am: customNew ? (names.am.trim() || undefined) : undefined,
        game_ids: Array.from(gameIds),
        source_locale: lang,
      };
      // The place keeps a single `name` — the interface-language value — so
      // every existing consumer keeps working; the per-language values follow.
      const placeId = initial
        ? (await placeRepository.update(initial.id, body), initial.id)
        : (await placeRepository.create(body))?.id ?? null;

      if (placeId != null) {
        await apiSaveEntityTranslations("place", placeId, {
          primary_locale: lang,
          fields: { name },
        });
      }

      onSaved();
    } catch (e) { setErr(formatApiError(e)); }
    finally { setBusy(false); }
  };

  // Shared game-selection grid — identical for known platforms and for a
  // custom platform once its "has games" toggle is on.
  const gamesGrid = games.loading ? <Spinner /> : (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, maxHeight: 220, overflowY: "auto", padding: 6, border: "1px solid #1f2a44", borderRadius: 8 }}>
      {filteredGames.map((g) => (
        <Checkbox
          key={g.id}
          checked={gameIds.has(g.id)}
          onChange={() => toggleGame(g.id)}
          label={g.name}
          style={{ padding: "4px 6px", borderRadius: 4, background: gameIds.has(g.id) ? "#101a35" : "transparent" }}
        />
      ))}
      {!filteredGames.length && <span className="muted">{t("place.noGamesPlatform")} {platformLabel(platform)}.</span>}
    </div>
  );

  // Inline "add a game for this platform", shared by both branches below.
  // Shown whenever the operator may create games — NOT only when the list is
  // empty: a platform that already has one game must still be extendable, and
  // for a brand-new custom platform this is the only way to get the first one.
  const createGameButton = canCreateGames && !games.loading ? (
    <div className="row" style={{ justifyContent: "flex-end" }}>
      <Button type="button" variant="secondary" onClick={() => setGameCreating(true)} style={{ padding: "4px 10px", fontSize: 12 }}>
        {t("place.createGame")}
      </Button>
    </div>
  ) : null;

  return (
    <Modal open onClose={onClose}>
      <form className="card" style={{ width: 540, maxWidth: "90vw", display: "flex", flexDirection: "column", gap: 12 }} onSubmit={submit}>
        <h2 style={{ margin: 0 }}>{initial ? `${t("place.titleEdit")} №${initial.number ?? initial.id}` : t("place.titleNew")}</h2>

        <div className="row" style={{ gap: 10 }}>
          <Input label={t("label.number")} type="number" min={1} value={number} onChange={(e) => setNumber(e.target.value)} required />
          <div className="col" style={{ gap: 6, flex: 1 }}>
            <span className="label">{t("label.type")}</span>
            <div className="row" style={{ gap: 6 }}>
              {TYPES.map((tp) => (
                <Button key={tp} type="button" variant={type === tp ? "primary" : "secondary"} onClick={() => setType(tp)} style={{ flex: 1 }}>{tp.toUpperCase()}</Button>
              ))}
            </div>
          </div>
        </div>

        <MultiLangInput
          label={t("place.name")}
          values={name}
          onChange={setName}
          fieldClass="place_name"
          maxChars={40}
          disabled={busy}
        />

        <div className="col" style={{ gap: 6 }}>
          <span className="label">{t("label.platform")}</span>
          {/* The picker owns known buttons + the Other toggle; the custom slug
              comes from the наименование below, so its own text input is hidden. */}
          <PlatformPicker value={platform} onChange={handlePlatformPick} suggestions={platformOptions} hideOtherInput />
        </div>

        {/* Second level: which sub-category of that platform. Only once the
            platform is settled — a subplatform belongs to a platform, and
            offering the tabs while the operator is still typing a custom name
            would show them tabs for a platform that does not exist yet. */}
        {platform !== "" && (subplatforms.data?.length ?? 0) > 0 && (
          <SubplatformTabs
            branchId={branchId}
            platform={platform}
            subplatforms={subplatforms.data ?? []}
            value={subplatformId}
            onChange={setSubplatformId}
            type={type}
            onCreated={() => void subplatforms.reload()}
            disabled={busy}
          />
        )}

        {/* A subplatform that prices this tier IS the price — for pc/ps4/ps5 as
            much as for a custom platform, which is the whole point of the
            feature. Shown as applied rather than editable: the rate belongs to
            the sub-category (and every place on it), so it is changed in Branch
            Prices, not per place. */}
        {subplatformRate != null ? (
          <div className="col" style={{ gap: 6 }}>
            <span className="label">{t("place.hourlyRate")} · {typeLabel}</span>
            <div
              className="card"
              style={{ padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}
            >
              <span>{subplatform ? platformPriceNameOf(subplatform, lang) : ""}</span>
              <strong style={{ color: "#07ddf1" }}>{money(Number(subplatformRate))}</strong>
            </div>
            <span className="muted" style={{ fontSize: 11 }}>{t("subplatform.priceAppliedNote")}</span>
          </div>
        ) : needsSubplatformRate ? (
          // Unpriced tier on this subcategory — the operator sets it here, and
          // the rate becomes the subcategory's for every place that follows.
          <div className="col" style={{ gap: 6 }}>
            <span className="label">{subplatform ? platformPriceNameOf(subplatform, lang) : ""}</span>
            <PriceInput
              label={`${t("place.hourlyRate")} · ${typeLabel}`}
              value={hourlyRate}
              onChange={setHourlyRate}
            />
            <span className="muted" style={{ fontSize: 11 }}>{t("subplatform.tierUnpricedNote")}</span>
          </div>
        ) : isCustomPlatform && (tierLocked ? (
          // This platform + tier is already priced — applied, not re-entered.
          <div className="col" style={{ gap: 6 }}>
            <span className="label">{t("place.hourlyRate")} · {typeLabel}</span>
            <div
              className="card"
              style={{ padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}
            >
              <span>{existingPrice ? platformPriceNameOf(existingPrice, lang) : ""}</span>
              <strong style={{ color: "#07ddf1" }}>{money(Number(tierPrice))}</strong>
            </div>
            <span className="muted" style={{ fontSize: 11 }}>{t("place.priceLockedNote")}</span>
          </div>
        ) : existingPrice ? (
          // The platform exists but THIS tier has no price yet — the name is
          // fixed, the operator just sets this tier's rate.
          <div className="col" style={{ gap: 6 }}>
            <span className="label">{platformPriceNameOf(existingPrice, lang)}</span>
            <PriceInput
              label={`${t("place.hourlyRate")} · ${typeLabel}`}
              value={hourlyRate}
              onChange={setHourlyRate}
            />
            <span className="muted" style={{ fontSize: 11 }}>{t("place.tierUnpricedNote")}</span>
          </div>
        ) : (
          // Brand-new custom platform — name it (3 languages) and price this tier.
          <div className="col" style={{ gap: 8 }}>
            <PlatformNameInput
              value={names}
              onChange={handleNamesChange}
              suggestions={platformPrices}
              onPickExisting={handlePickExisting}
            />
            <PriceInput
              label={`${t("place.hourlyRate")} · ${typeLabel}`}
              value={hourlyRate}
              onChange={setHourlyRate}
            />
            <span className="muted" style={{ fontSize: 11 }}>{t("place.customPlatformNote")}</span>
          </div>
        ))}

        {isCustomPlatform ? (
          <div className="col" style={{ gap: 6 }}>
            <Checkbox checked={hasGames} onChange={toggleHasGames} label={t("place.hasGames")} />
            <span className="muted" style={{ fontSize: 11 }}>{t("place.hasGamesHint")}</span>
            {hasGames && (
              <div className="col" style={{ gap: 6 }}>
                {gamesGrid}
                {createGameButton}
                <span className="muted" style={{ fontSize: 11 }}>{gameIds.size} {t("place.selected")}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="col" style={{ gap: 6 }}>
            <span className="label">{t("place.gamesAvailable")} ({platformLabel(platform)})</span>
            {gamesGrid}
            {createGameButton}
            <span className="muted" style={{ fontSize: 11 }}>{gameIds.size} {t("place.selected")}</span>
          </div>
        )}

        {err && <div className="error" style={{ whiteSpace: "pre-line" }}>{err}</div>}
        <div className="row-between">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>{t("action.cancel")}</Button>
          <Button disabled={busy}>{busy ? "…" : t("action.save")}</Button>
        </div>
      </form>

      {/* Inline game creation for the current custom platform. The platform is
          locked to this place's slug and the game is attached to the branch so
          it also lands in the branch games library. On save we refresh the
          catalogue so the new game appears in the grid to be picked. */}
      {gameCreating && (
        <GameForm
          branchId={branchId}
          lockedPlatform={platform}
          onClose={() => setGameCreating(false)}
          onSaved={(game) => {
            setGameCreating(false);
            void games.reload();
            // Tick the freshly created game right away — the operator opened
            // this form to attach it, so making them hunt for it in the
            // refreshed grid would be pure friction. The prune effect keeps
            // it: it matches the place's platform by construction.
            if (game) setGameIds((prev) => new Set(prev).add(game.id));
          }}
        />
      )}
    </Modal>
  );
};


export default PlaceForm;
