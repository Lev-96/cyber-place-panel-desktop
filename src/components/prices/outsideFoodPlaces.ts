import type { IOutsideFoodPlaceFee } from "@/api/joystickPrices";
import type { IBranchPlace } from "@/types/api";

/**
 * Per-place «Свои продукты» figures on the Prices page (2026-11-14, owner).
 *
 * One source of truth: `places.outside_food_fee` — null = like the branch's
 * tier, 0 = not charged at this place, a figure = this place's own. The list
 * reads the places as the page already does (`listRawByBranch`) and a Save
 * sends ONLY the rows the owner changed (`outside_food_place_fees` on the
 * billing-settings PUT). Pure functions only; the list is
 * `OutsideFoodPlacesField.tsx`.
 */

/** The server's ceiling for one fee (`max:99999999`). */
export const OUTSIDE_FOOD_FEE_MAX = 99_999_999;

/** What the list needs of a place. */
export type FeePlace = Pick<IBranchPlace, "id" | "number" | "name" | "type" | "platform" | "status" | "outside_food_fee">;

/** The owner's typed boxes, by place id; a place with no entry shows its stored figure. */
export type PlaceDrafts = Readonly<Record<number, string>>;

/** One changed row, as the PUT carries it. */
export type PlaceFeeRow = IOutsideFoodPlaceFee;

export type PlacesTab = "all" | "vip" | "standard" | "own";
export const PLACES_TABS: readonly PlacesTab[] = ["all", "vip", "standard", "own"];

export type FeeState = "own" | "notCharged" | "branch" | "invalid";

/** The stored figure as the box holds it (AMD, a string; empty = like the branch). */
export const draftOf = (fee: number | null | undefined): string => (fee == null ? "" : String(fee));

/** A box's meaning: null = like the branch, 0 = not charged, a figure, or NaN. */
export const parsePlaceFee = (box: string): number | null => {
  if (box.trim() === "") return null;
  const n = Number(box);
  return Number.isFinite(n) && n >= 0 && n <= OUTSIDE_FOOD_FEE_MAX ? n : NaN;
};

export const feeStateOf = (fee: number | null): FeeState => {
  if (fee === null) return "branch";
  if (Number.isNaN(fee)) return "invalid";
  return fee === 0 ? "notCharged" : "own";
};

const savedOf = (p: FeePlace): number | null => p.outside_food_fee ?? null;
const boxOf = (p: FeePlace, drafts: PlaceDrafts): string => drafts[p.id] ?? draftOf(savedOf(p));
/** The place's fee as it reads right now (the typed box, or the stored figure). */
export const currentFeeOf = (p: FeePlace, drafts: PlaceDrafts): number | null => parsePlaceFee(boxOf(p, drafts));

/** The rows whose box now says something other than what is stored; invalid boxes never travel. */
export const changedPlaceFees = (places: readonly FeePlace[], drafts: PlaceDrafts): PlaceFeeRow[] =>
  places.flatMap((p) => {
    const fee = currentFeeOf(p, drafts);
    if (Number.isNaN(fee) || fee === savedOf(p)) return [];
    return [{ place_id: p.id, fee }];
  });

/**
 * Whether a place belongs to a tab. «own» = any setting of the place's own (a
 * figure or 0), stored OR typed, so a row does not vanish under the cursor
 * while its box is being cleared.
 */
export const inTab = (p: FeePlace, tab: PlacesTab, drafts: PlaceDrafts): boolean => {
  if (tab === "vip") return p.type === "vip";
  if (tab === "standard") return p.type !== "vip";
  if (tab === "own") return savedOf(p) !== null || currentFeeOf(p, drafts) !== null;
  return true;
};

export const tabCounts = (places: readonly FeePlace[], drafts: PlaceDrafts): Record<PlacesTab, number> => {
  const counts: Record<PlacesTab, number> = { all: 0, vip: 0, standard: 0, own: 0 };
  for (const p of places) for (const tab of PLACES_TABS) if (inTab(p, tab, drafts)) counts[tab] += 1;
  return counts;
};

/** «Со своей суммой» when any place has one, otherwise «Все». */
export const defaultPlacesTab = (places: readonly FeePlace[]): PlacesTab =>
  places.some((p) => savedOf(p) !== null) ? "own" : "all";

/** Number (with or without «№»/«#», by prefix) or name (anywhere in it), case-insensitive. */
export const matchesSearch = (p: FeePlace, query: string): boolean => {
  const q = query.trim().toLowerCase();
  if (q === "") return true;
  const digits = q.replace(/^[№#]\s*/, "");
  if (/^\d+$/.test(digits) && String(p.number ?? p.id).startsWith(digits)) return true;
  return (p.name ?? "").toLowerCase().includes(q);
};

const numberOf = (p: FeePlace) => p.number ?? p.id;

/** Places by platform, each sorted by number; groups ordered by their lowest number. */
export const groupByPlatform = <P extends FeePlace>(places: readonly P[]): { platform: string; places: P[] }[] => {
  const groups = new Map<string, P[]>();
  for (const p of [...places].sort((a, b) => numberOf(a) - numberOf(b))) {
    const list = groups.get(p.platform);
    if (list) list.push(p);
    else groups.set(p.platform, [p]);
  }
  return [...groups].map(([platform, list]) => ({ platform, places: list }));
};

export interface PlacesSummary {
  own: number;
  notCharged: number;
  branch: number;
  /** Rows a Save would send. */
  pending: number;
  /** Boxes that say nothing a Save could send. */
  invalid: number;
}

/** Counted over ALL places (not the tab or the search), as the boxes read now. */
export const placesSummary = (places: readonly FeePlace[], drafts: PlaceDrafts): PlacesSummary => {
  const s: PlacesSummary = { own: 0, notCharged: 0, branch: 0, pending: changedPlaceFees(places, drafts).length, invalid: 0 };
  for (const p of places) s[feeStateOf(currentFeeOf(p, drafts))] += 1;
  return s;
};

/** The form's key part on the page: changes with any place's fee; null (not loaded) ≠ []. */
export const placeFeesFingerprint = (places: readonly FeePlace[] | null | undefined): string =>
  places == null ? "-" : places.map((p) => `${p.id}=${draftOf(savedOf(p)) || "_"}`).join(",");
