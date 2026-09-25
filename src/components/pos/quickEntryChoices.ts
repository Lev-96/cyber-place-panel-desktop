import type { IItemChoice, IResolvedItems } from "@/api/sessions";

/**
 * The operator's picks for ambiguous quick-entry lines (2026-09-25) — pure, so
 * every rule here is tested without a dialog.
 *
 * A pick is keyed by the line's INDEX and its TEXT together: edit the text and
 * the old pick no longer matches any line, so it can never land on a line the
 * operator did not choose it for. The server applies the same rule again (and
 * checks the product is one of that line's options) — this only decides what
 * the panel asks for.
 */
export type QuickEntryChoices = Readonly<Record<string, number>>;

export const choiceKey = (line: number, raw: string): string => `${line}:${raw}`;

/** The picks as the resolve endpoints take them, in line order. */
export const toChoicePayload = (choices: QuickEntryChoices): IItemChoice[] =>
  Object.entries(choices)
    .map(([key, productId]) => {
      const at = key.indexOf(":");
      return { line: Number(key.slice(0, at)), raw: key.slice(at + 1), product_id: productId };
    })
    .sort((a, b) => a.line - b.line);

/**
 * Only the picks the latest answer still stands behind: the line is still
 * there with the same text, and the product is one of its options (or is the
 * product the server resolved it to). Returns the SAME object when nothing is
 * dropped, so a caller keyed on it does not loop.
 */
export const pruneChoices = (choices: QuickEntryChoices, resolved: IResolvedItems | null): QuickEntryChoices => {
  if (resolved === null) return choices;

  let dropped = false;
  const kept: Record<string, number> = {};
  for (const [key, productId] of Object.entries(choices)) {
    const at = key.indexOf(":");
    const line = resolved.lines[Number(key.slice(0, at))];
    const stands = line !== undefined
      && line.raw === key.slice(at + 1)
      && (line.product_id === productId || (line.options ?? []).some((o) => o.product_id === productId));
    if (stands) kept[key] = productId;
    else dropped = true;
  }

  return dropped ? kept : choices;
};

/** How many lines still wait for the operator to say which product they mean. */
export const pendingPicks = (resolved: IResolvedItems | null): number =>
  (resolved?.lines ?? []).filter((l) => l.status === "ambiguous").length;
