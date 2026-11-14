import type { PlaceType } from "@/types/api";

/**
 * The dictionary key that says a place's tier (`places.type`).
 *
 * The same words as the Prices page's two columns, so a cashier reads one
 * vocabulary on the board, the live map and the price matrix. The raw value
 * is an identifier, never copy: printed as is it read «STANDARD» in every
 * language (B6, audit 2026-11-13).
 */
export const PLACE_TYPE_LABEL_KEY = {
  standard: "branch.prices.standard",
  vip: "branch.prices.vip",
} as const satisfies Record<PlaceType, string>;

export const placeTypeLabelKey = (type: PlaceType): string =>
  PLACE_TYPE_LABEL_KEY[type] ?? PLACE_TYPE_LABEL_KEY.standard;
