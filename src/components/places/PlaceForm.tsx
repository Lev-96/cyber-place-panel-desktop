import { ListSkeleton } from "@/components/ui/Skeleton";
import Button from "@/components/ui/Button";
import { apiSaveEntityTranslations } from "@/api/translations";
import MultiLangInput, { LangValues, langValuesFromField, primaryValue } from "@/components/ui/MultiLangInput";
import { formatApiError } from "@/api/errors";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import PriceInput from "@/components/ui/PriceInput";
import Checkbox from "@/components/ui/Checkbox";
import Radio from "@/components/ui/Radio";
import PlatformPicker from "@/components/ui/PlatformPicker";
import PlatformNameInput, { LangNames } from "@/components/ui/PlatformNameInput";
import SubplatformTabs from "@/components/ui/SubplatformTabs";
import Spinner from "@/components/ui/Spinner";
import GameForm from "@/components/games/GameForm";
import { billingSettingsRepository } from "@/repositories/BillingSettingsRepository";
import { branchRepository } from "@/repositories/BranchRepository";
import { useAuth } from "@/auth/AuthContext";
import { can } from "@/auth/permissions";
import { useAsync } from "@/hooks/useAsync";
import { useLang } from "@/i18n/LanguageContext";
import { platformPriceNameOf } from "@/i18n/platformPriceName";
import { gameRepository } from "@/repositories/GameRepository";
import { placeRepository } from "@/repositories/PlaceRepository";
import { subplatformRepository } from "@/repositories/SubplatformRepository";
import { CHARGE_MODES, JoystickChargeMode, JoystickPricingMode, PRICING_MODES } from "@/api/joystickPrices";
import { IBranchApi, IBranchPlace, IBranchPlatformPrice, PlaceType } from "@/types/api";
import { isKnownPlatform, platformGroup, platformLabel, slugifyPlatform } from "@/utils/platform";
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

/**
 * WHICH extra pads this room charges for, as the form asks it.
 *
 * `""` is "as the branch does" — the room names nothing and its venue decides,
 * which is what every seat is until somebody chooses. The other three are the
 * shapes the server accepts, spelled the way an operator says them: the third
 * controller, the fourth, or the pair at one figure.
 *
 * `legacy` is not on the menu. It is what a room ALREADY on an older answer
 * shows — a count, or a bare price with no slots named — so that opening this
 * form cannot quietly re-price a seat by translating a setting nobody asked to
 * change. Picking anything else replaces it; leaving it alone sends it back
 * untouched.
 */
/**
 * What the MENU offers: follow the branch, charge for the third, or charge for
 * the pair at one figure.
 *
 * The bare fourth ("only the fourth costs money") left the menu on 2026-09-17.
 * It answered a question no venue turned out to ask, and it sat next to "3"
 * and "3,4" as a third shape an operator had to reason about before pricing
 * anything. What replaced it is a question asked only where it matters: pick
 * the third, and the form asks whether a fourth pad is sold at all.
 */
const JOYSTICK_SCOPES = ["3", "3,4"] as const;

/**
 * What a room may CARRY, which is deliberately more than the menu offers.
 *
 * A room stored as "4" keeps it: the option is gone from the menu, and erasing
 * the value on open would re-price a seat nobody touched. It stays selectable
 * for that room alone until an operator picks something else — the same
 * courtesy `legacy` gets, and for the same reason.
 */
const OWN_JOYSTICK_SCOPES = ["3", "4", "3,4"] as const;
type JoystickScope = "" | (typeof OWN_JOYSTICK_SCOPES)[number] | "legacy";

/**
 * Does this room price its fourth pad APART from its third?
 *
 * Stored as `joystick_charged_slots = "3,4"` plus a `joystick_price_4`, which
 * is the same shape the branch uses. The menu spells that "the third, and a
 * fourth of its own" rather than offering a fourth entry, so the two figures
 * stay one decision instead of two settings that can disagree.
 */
const pricesFourthApart = (place?: IBranchPlace): boolean =>
  place?.joystick_charged_slots === "3,4" && place?.joystick_price_4 != null;

const joystickScopeOf = (place?: IBranchPlace): JoystickScope => {
  const slots = place?.joystick_charged_slots;

  // The pair priced APART reopens as "the third" with the fourth-pad question
  // answered yes — which is how it was entered, and the only reading under
  // which both figures stay visible and editable.
  if (pricesFourthApart(place)) return "3";

  if (OWN_JOYSTICK_SCOPES.includes(slots as (typeof OWN_JOYSTICK_SCOPES)[number])) {
    return slots as JoystickScope;
  }

  // Nothing named. An untouched room follows its branch; one carrying the
  // older answer keeps it rather than being translated into a shape it never
  // chose.
  return place?.joystick_included == null && place?.joystick_price == null ? "" : "legacy";
};

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
  /**
   * THIS place's own price per hour, when the form is not already collecting a
   * rate for something bigger than the place.
   *
   * Empty is inherit, the same empty-means-inherit every other box here uses:
   * the seat then bills from its sub-category, its custom platform or the
   * branch's tariff matrix, exactly as it always has. A figure beats all three,
   * which is the order the server already resolves in
   * (`ResolveSessionRateService`: the place's own rate first, then the matrix)
   * — so this box states what a seat costs rather than adding a fourth rule.
   */
  const [placeRate, setPlaceRate] = useState(initial?.hourly_rate != null ? String(initial.hourly_rate) : "");
  /**
   * This place's own joystick policy. Empty string is INHERIT, the same way an
   * empty `hourlyRate` above means "this platform's price applies".
   *
   * A venue's joystick rule belongs on the branch and almost every seat runs
   * on it. The exception is the room quoted with four pads in the rate, or the
   * one seat whose fifth hour of Mortal Kombat is sold with a free second pad:
   * one seat differing must not become a reason to move the whole branch.
   */
  const [joystickScope, setJoystickScope] = useState<JoystickScope>(() => joystickScopeOf(initial));
  const [joystickPrice, setJoystickPrice] = useState(
    initial?.joystick_price != null ? String(initial.joystick_price) : "",
  );
  /**
   * Does this room sell a FOURTH pad, and at what price?
   *
   * Asked only under "the third", because that is the only answer where the
   * fourth is still open: "3,4" already prices the pair together and "as the
   * branch does" prices nothing here at all. A yes with an empty box holds
   * Save rather than guessing — both guesses (nothing, or the third's figure)
   * are money the operator did not name.
   */
  const [wantsFourthPad, setWantsFourthPad] = useState<boolean>(() => pricesFourthApart(initial));
  const [joystickPrice4, setJoystickPrice4] = useState(
    initial?.joystick_price_4 != null ? String(initial.joystick_price_4) : "",
  );
  /**
   * HOW this room prices an extra pad, and HOW OFTEN it charges for one.
   *
   * Empty is inherit, like every other box here. The two questions are
   * deliberately separate: the first is what the money is (a fee owed on
   * handout, or a higher hourly rate while the pad is out), the second is
   * whether it is owed again the next time a controller changes hands.
   */
  const [joystickStrategy, setJoystickStrategy] = useState<JoystickPricingMode | "">(
    initial?.joystick_pricing_mode ?? "",
  );
  const [joystickChargeMode, setJoystickChargeMode] = useState<JoystickChargeMode | "">(
    initial?.joystick_charge_mode ?? "",
  );
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
  /**
   * Joysticks are a PlayStation question, and the question is the PLATFORM's.
   *
   * Deliberately NOT `pc.kind`: that says "no kiosk agent runs here" and is
   * equally true of a ping-pong table. `platformGroup` matches every console
   * generation (ps4, ps5, ps6, …), which is the same question the backend and
   * the session dialog ask.
   */
  const isPlayStation = platformGroup(platform) === "ps";
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
  /**
   * The BRANCH's default price for this platform and tier — the tariff matrix
   * cell a known platform bills from when the seat carries no price of its own
   * (`ResolveSessionRateService`: the place first, then this).
   *
   * Loaded here rather than passed down because the modal is the only screen
   * that asks the question, and it already fetches what it needs to answer the
   * others (sub-categories, games). One GET when it opens.
   */
  const branch = useAsync(() => branchRepository.byId(branchId), [branchId]);
  /**
   * The VENUE's joystick policy — what an extra pad costs here when a room
   * does not price its own.
   *
   * Read rather than recomputed: it is the same figure `JoystickRule` resolves
   * on the server when a room's own column is null, and a form that guessed it
   * would be a second answer to a question the server already answers.
   */
  const branchJoysticks = useAsync(() => billingSettingsRepository.get(branchId), [branchId]);
  const branchJoystickPrice = branchJoysticks.data?.joystick_price ?? null;
  /**
   * Is this room pricing its own pads?
   *
   * True only for the three answers the menu offers. `""` is the branch's rule
   * and `legacy` is an older one being left alone — under both the price box
   * is read-only, because under both the figure it shows was not decided here.
   */
  const isOwnJoystickRule = OWN_JOYSTICK_SCOPES.includes(
    joystickScope as (typeof OWN_JOYSTICK_SCOPES)[number],
  );
  /** The fourth-pad question is only open under "the third". */
  const asksFourthPad = joystickScope === "3";
  /**
   * What travels as the room's charged pads. Saying yes to a fourth pad IS the
   * pair — the server stores one column, and a second spelling of "3 plus a
   * fourth" is how the form and the bill start disagreeing.
   */
  const outgoingScope = asksFourthPad && wantsFourthPad ? "3,4" : joystickScope;
  /** What the read-only box shows: the venue's figure, or the room's older one. */
  const joystickPriceShown = joystickScope === "" ? branchJoystickPrice : null;
  const branchRate = ((): number | null => {
    const cell = branch.data?.price_for_branch?.[
      `${platform}-${type === "vip" ? "vip" : "standard"}` as keyof NonNullable<IBranchApi["price_for_branch"]>
    ];
    const value = typeof cell === "number" ? cell : null;

    // Zero is not a price here for the same reason it is not one on the
    // server: a seat resolving to nothing cannot start a paid session, and
    // giving one away is `Free session`, which is explicit and separate.
    return value !== null && value > 0 ? value : null;
  })();
  /**
   * A PlayStation seat with no branch price and no price of its own cannot run
   * a paid session — the server refuses it, and this is what stops the operator
   * finding that out at the counter instead of here.
   *
   * Zero is not a price on either side: the server bills from a figure greater
   * than zero and steps over a zero exactly as it steps over an empty column,
   * so a box reading "0" is this same seat with a number in it. Giving a seat
   * away is `Free session`, which is a different, explicit thing.
   *
   * Silent while the branch is still loading — the matrix is unknown then, and
   * an error that appears for a moment on every open is noise, not a warning.
   */
  const ownRate = Number(placeRate.trim());
  const hasOwnRate = placeRate.trim() !== "" && Number.isFinite(ownRate) && ownRate > 0;
  const needsOwnRate = isPlayStation && !branch.loading && branchRate === null && !hasOwnRate;
  /**
   * A figure was typed and it is not one the seat can be billed at.
   *
   * Separate from `needsOwnRate` because it is a different mistake: the box is
   * filled in, and what is wrong is the number in it. The server refuses it on
   * its own sentence too — a zero stored beside a priced branch is written
   * down, shown here, and never charged.
   */
  const ownRateIsNotAPrice = isPlayStation && placeRate.trim() !== "" && !hasOwnRate;
  /**
   * Whether the form is ALREADY asking for a rate — an unpriced sub-category,
   * or a custom platform whose tier has no price yet.
   *
   * In those cases the box on screen IS this place's rate (and seeds the
   * sub-category's or the platform's), so a second one would be two fields for
   * one number. Everywhere else — a known platform on the matrix, a locked
   * custom tier, a sub-category that already prices this tier — nothing was
   * editable at all, and that is where the place's own price goes.
   */
  const collectsPlatformRate = needsSubplatformRate || (isCustomPlatform && !tierLocked);

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
    // A fourth pad the room says it sells must carry a price. Both fallbacks
    // are money nobody named: nothing at all would hand the pad over free, and
    // the third's figure would be a second price invented by this form.
    if (isPlayStation && asksFourthPad && wantsFourthPad && joystickPrice4.trim() === "") {
      return setErr(t("place.errors.joystickFourthPriceRequired"));
    }
    // The subcategory owns the rate: priced → nothing to ask, unpriced → the
    // rate is mandatory. Only when no subcategory owns it does the platform's
    // own "price this tier" rule apply.
    if (needsSubplatformRate && !hourlyRate) {
      return setErr(t("subplatform.errors.priceRequired"));
    }
    if (!ownsRate && isCustomPlatform && !tierLocked && !hourlyRate) {
      return setErr(t("place.errors.priceRequired"));
    }
    // A PlayStation seat with nothing to bill at. The server refuses it either
    // way; saying so here is what keeps the operator from discovering it at the
    // counter, on a seat they thought was finished.
    if (ownRateIsNotAPrice) {
      return setErr(t("place.zeroNotAPriceHint"));
    }
    if (needsOwnRate) {
      return setErr(t("place.noBranchRateHint"));
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
        // One field, three cases, in the order the form asks them:
        //
        //   collecting a platform/sub-category rate → that box, which the
        //     server also seeds the bigger price from;
        //   this place priced on its own            → that box, which beats the
        //     matrix for this seat and nothing else;
        //   neither                                  → a locked custom tier
        //     keeps re-sending its platform's figure, and a known platform
        //     sends null, which is "bill from the matrix" — what every place
        //     did before this box existed.
        hourly_rate: collectsPlatformRate
          ? (hourlyRate ? Number(hourlyRate) : null)
          : placeRate.trim() !== ""
            ? Number(placeRate)
            : (isCustomPlatform && tierLocked ? Number(tierPrice) : null),
        // Per-place joystick policy. Empty box = null = inherit the branch's
        // rule. A place that is not a PlayStation carries no override at all,
        // so switching ps5 → pc drops one rather than leaving it behind.
        // WHICH pads this room charges for, and what they cost here.
        //
        //   ""        as the branch does — every column null, and the price
        //             box was read-only showing the venue's figure;
        //   3|4|3,4   this room's own answer, with its own price;
        //   legacy    a room already on the older answer, sent back exactly as
        //             it came so that opening this form re-prices nothing.
        //
        // `joystick_included` is no longer asked here — the slots say what the
        // count used to approximate — but a room that carries one keeps it,
        // because clearing a setting the operator did not touch is a price
        // change nobody made.
        joystick_charged_slots: isPlayStation && isOwnJoystickRule ? outgoingScope : null,
        // The fourth pad's own figure, and only where the room actually sells
        // one: under "as the branch does", the shared pair or a legacy answer
        // it is null, which is the server's "this room did not price the pair
        // apart". A typed 0 is a real setting and travels as 0.
        joystick_price_4: isPlayStation && isOwnJoystickRule && asksFourthPad
          && wantsFourthPad && joystickPrice4.trim() !== ""
          ? Number(joystickPrice4)
          : null,
        joystick_included: isPlayStation && joystickScope !== ""
          ? (initial?.joystick_included ?? null)
          : null,
        joystick_price: isPlayStation && joystickScope !== "" && joystickPrice !== ""
          ? Number(joystickPrice)
          : null,
        joystick_pricing_mode: isPlayStation && joystickStrategy !== "" ? joystickStrategy : null,
        joystick_charge_mode: isPlayStation && joystickChargeMode !== "" ? joystickChargeMode : null,
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
  const gamesGrid = games.loading ? <ListSkeleton rows={3} /> : (
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
        ) : !isCustomPlatform && branchRate !== null ? (
          // A known platform bills from the branch's tariff matrix. Shown as
          // APPLIED, exactly like a sub-category's or a custom platform's
          // price: it belongs to the branch and is changed in Branch Prices,
          // not per place. The box below is how one seat departs from it.
          <div className="col" style={{ gap: 6 }}>
            <span className="label">{t("place.hourlyRate")} · {typeLabel}</span>
            <div
              className="card"
              style={{ padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}
            >
              <span>{t("place.branchDefaultRate")}</span>
              <strong style={{ color: "#07ddf1" }}>{money(branchRate)}</strong>
            </div>
            <span className="muted" style={{ fontSize: 11 }}>{t("place.branchDefaultNote")}</span>
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

        {/* This seat's own price per hour.
            Shown only where the form is not already asking for a rate, so a
            place never carries two price boxes for one number. Empty is the
            normal case and means the price above applies — the sub-category's,
            the custom platform's, or the branch's matrix cell. */}
        {!collectsPlatformRate && (
          <div className="col" style={{ gap: 6 }}>
            <PriceInput
              label={t("place.ownRate")}
              value={placeRate}
              onChange={setPlaceRate}
              placeholder={t("place.ownRateInherit")}
              disabled={busy}
            />
            <span className="muted" style={{ fontSize: 11 }}>{t("place.ownRateNote")}</span>
            {/* A PlayStation seat with nothing to bill at. The server refuses
                it; this is what stops the operator finding that out at the
                counter, on a seat they thought was finished. */}
            {ownRateIsNotAPrice && (
              <span className="error" style={{ fontSize: 11 }}>{t("place.zeroNotAPriceHint")}</span>
            )}
            {needsOwnRate && (
              <span className="error" style={{ fontSize: 11 }}>{t("place.noBranchRateHint")}</span>
            )}
          </div>
        )}

        {/* Per-place joystick policy, for PlayStation seats only. Both boxes
            empty is the normal case and means "the branch's rule applies", the
            same empty-means-inherit the rate above uses. */}
        {isPlayStation && (
          <div className="col" style={{ gap: 6 }}>
            <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
              <label className="col" style={{ gap: 6 }}>
                <span className="label">{t("place.joystickScope")}</span>
                {/* WHICH extra pads this room charges for — the controllers by
                    number, because that is how a cashier hands them over. The
                    seat's own two come with the PlayStation and are never on
                    this list. It was a count of pads "included in the rate",
                    which offered 1 and 2 to a seat that always has two and
                    could not say "the third and not the fourth" at all. */}
                <select
                  className="input"
                  value={joystickScope}
                  disabled={busy}
                  onChange={(e) => {
                    const next = e.target.value as JoystickScope;
                    setJoystickScope(next);
                    // Leaving "the third" closes the fourth-pad question, so
                    // its answer goes with it. A figure left behind in state
                    // is a price the operator can no longer see and would be
                    // saved by the next click.
                    if (next !== "3") {
                      setWantsFourthPad(false);
                      setJoystickPrice4("");
                    }
                  }}
                  style={{ width: 180 }}
                >
                  <option value="">{t("place.joystickInherit")}</option>
                  {JOYSTICK_SCOPES.map((scope) => (
                    <option key={scope} value={scope}>{t(`place.joystickScope.${scope}`)}</option>
                  ))}
                  {/* The bare fourth is no longer offered. A room already on it
                      keeps it — and only that room sees it — because clearing
                      the answer on open would re-price a seat nobody touched. */}
                  {joystickScope === "4" && (
                    <option value="4">{t("place.joystickScope.4")}</option>
                  )}
                  {/* Only for a room already on an older answer, and only until
                      it picks one of the three above. Offering it to everybody
                      would be offering a setting nobody can explain. */}
                  {joystickScope === "legacy" && (
                    <option value="legacy">{t("place.joystickScopeLegacy")}</option>
                  )}
                </select>
              </label>
              <div style={{ flex: 1, minWidth: 160 }}>
                {/* The price is this room's only where the room prices its own
                    pads. Under "as the branch does" the box shows the VENUE's
                    figure and is read-only: an editable box that silently
                    discards what is typed into it is worse than no box. */}
                <PriceInput
                  label={t("place.joystickPrice")}
                  value={isOwnJoystickRule
                    ? joystickPrice
                    : joystickPriceShown !== null ? String(joystickPriceShown) : joystickPrice}
                  onChange={setJoystickPrice}
                  placeholder={t("place.joystickInherit")}
                  disabled={busy || ! isOwnJoystickRule}
                />
              </div>
            </div>
            {/* Is a FOURTH pad sold at all, and for how much?
                Asked only under "the third", where it is the one thing still
                open. Yes turns the room's answer into the charged pair with
                two figures; no leaves the third priced alone and the fourth
                handed over at 0.00. The box is mandatory under yes: a price
                nobody named is a price the receipt would invent. */}
            {asksFourthPad && (
              <div className="col" style={{ gap: 6 }}>
                <span className="label">{t("place.joystickFourth")}</span>
                <div className="row" role="radiogroup" aria-label={t("place.joystickFourth")} style={{ gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
                  <Radio
                    name="cp-place-joystick-fourth"
                    checked={! wantsFourthPad}
                    onChange={() => { setWantsFourthPad(false); setJoystickPrice4(""); }}
                    disabled={busy}
                    label={t("action.no")}
                  />
                  <Radio
                    name="cp-place-joystick-fourth"
                    checked={wantsFourthPad}
                    onChange={() => setWantsFourthPad(true)}
                    disabled={busy}
                    label={t("action.yes")}
                  />
                  {wantsFourthPad && (
                    <div style={{ minWidth: 180 }}>
                      <PriceInput
                        label={t("place.joystickFourthPrice")}
                        value={joystickPrice4}
                        onChange={setJoystickPrice4}
                        disabled={busy}
                      />
                    </div>
                  )}
                </div>
                <span className="muted" style={{ fontSize: 11 }}>{t("place.joystickFourthHint")}</span>
              </div>
            )}

            {/* HOW a pad is priced here. Two answers and no third: a club
                ran both models at once for a day, and a choice made per seat
                is a choice a cashier can get wrong on money. */}
            <div className="col" style={{ gap: 6 }}>
              <span className="label">{t("place.joystickStrategy")}</span>
              <div className="row" role="radiogroup" aria-label={t("place.joystickStrategy")} style={{ gap: 16, flexWrap: "wrap" }}>
                <Radio
                  name="cp-place-joystick-strategy"
                  checked={joystickStrategy === ""}
                  onChange={() => setJoystickStrategy("")}
                  disabled={busy}
                  label={t("place.joystickInherit")}
                />
                {PRICING_MODES.map((m) => (
                  <Radio
                    key={m}
                    name="cp-place-joystick-strategy"
                    checked={joystickStrategy === m}
                    onChange={() => setJoystickStrategy(m)}
                    disabled={busy}
                    label={t(`joystickPrice.strategy.${m}`)}
                  />
                ))}
              </div>
            </div>

            {/* …and how often it is charged. The old screen spelled these "3"
                and "3/4" — slot numbers an operator had to translate into
                money. They say what they do now. */}
            <div className="col" style={{ gap: 6 }}>
              <span className="label">{t("place.joystickChargeMode")}</span>
              <div className="row" role="radiogroup" aria-label={t("place.joystickChargeMode")} style={{ gap: 16, flexWrap: "wrap" }}>
                <Radio
                  name="cp-place-joystick-charge"
                  checked={joystickChargeMode === ""}
                  onChange={() => setJoystickChargeMode("")}
                  disabled={busy}
                  label={t("place.joystickInherit")}
                />
                {CHARGE_MODES.map((m) => (
                  <Radio
                    key={m}
                    name="cp-place-joystick-charge"
                    checked={joystickChargeMode === m}
                    onChange={() => setJoystickChargeMode(m)}
                    disabled={busy}
                    label={t(`joystickPrice.chargeMode.${m}`)}
                  />
                ))}
              </div>
            </div>

            <span className="muted" style={{ fontSize: 11 }}>
              {isOwnJoystickRule
                ? t("place.joystickOwnNote")
                : joystickScope === "legacy"
                  ? t("place.joystickLegacyNote")
                  : t("place.joystickBranchNote")}
            </span>
          </div>
        )}

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
