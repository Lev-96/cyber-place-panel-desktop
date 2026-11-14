import { SESSION_ITEM_KIND, type SessionItemKind } from "@/types/sessions";
import { sessionItemLineTotal, type SessionItemLine } from "./sessionAmount";

/**
 * «Свои продукты» (2026-11-13, owner): the player brought their own food, and
 * Start put a fixed fee on the place's bill as an ordinary line with
 * `kind = "outside_food"`. Priced and summed by the server like any line; this
 * module only RECOGNISES the line and names it.
 *
 * Named by its kind, never by its `name`: the server writes the name in the
 * language of whoever started the session, so a cashier reading the panel in
 * Armenian would otherwise see «Свои продукты» on a Russian-started seat.
 */
export const OUTSIDE_FOOD_KIND: SessionItemKind = SESSION_ITEM_KIND.OutsideFood;

/** Anything that carries a line's kind: a session item, a bill line, an audit line. */
interface KindedLine {
  kind?: unknown;
}

/** Is this the own-food fee line? */
export const isOutsideFoodLine = (line: KindedLine | null | undefined): boolean =>
  line?.kind === OUTSIDE_FOOD_KIND;

/**
 * What a bill line is called on this screen: the localized name of its kind
 * when it has one, else the name the server stored (a product's name).
 */
export const sessionLineLabel = (
  line: KindedLine & { name?: string | null },
  t: (key: string) => string,
): string => (isOutsideFoodLine(line) ? t("session.outsideFood.line") : (line.name ?? ""));

/**
 * What the own-food line puts on this bill, or null when there is none (never
 * switched on, or removed). The line's own figure through the helper every
 * bill line goes through; nothing is priced here.
 */
export const outsideFoodFeeOf = (items: readonly SessionItemLine[] | null | undefined): number | null => {
  const lines = (items ?? []).filter(isOutsideFoodLine);
  return lines.length === 0 ? null : lines.reduce((sum, l) => sum + sessionItemLineTotal(l), 0);
};

/** The products on a bill, the own-food fee left out: what "· N товаров" counts. */
export const productLineCount = (items: readonly KindedLine[] | null | undefined): number =>
  (items ?? []).filter((l) => !isOutsideFoodLine(l)).length;
