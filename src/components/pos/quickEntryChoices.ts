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

/** PHP's `trim()` set — the server's, NOT JavaScript's wider `String.trim`. */
const serverTrim = (s: string): string => s.replace(/^[ \t\n\r\0\x0B]+|[ \t\n\r\0\x0B]+$/g, "");
/** PHP's `\R`: any line break. */
const LINE_BREAK = /\r\n|[\n\v\f\r\u0085\u2028\u2029]/;

/**
 * Take one typed line out of the draft (2026-09-26) — the × on a picked line.
 *
 * `index` is the server's: the n-th NON-BLANK line after its trim
 * (`ProductTextResolver::split`), so blank lines between entries never shift
 * which line goes. The other lines are left exactly as typed. Picks follow
 * their lines: the removed line's pick is dropped (its product id must not
 * come back with a retyped line), later picks move up one. Nothing is
 * written — the next read of the box is the only request.
 */
export const removeTypedLine = (
  text: string,
  choices: QuickEntryChoices,
  index: number,
): { text: string; choices: QuickEntryChoices } => {
  const physical = text.split(LINE_BREAK);
  let seen = -1;
  const at = physical.findIndex((l) => serverTrim(l) !== "" && ++seen === index);
  if (at < 0) return { text, choices };

  // Rebuild with the original breaks: split with a capture keeps them.
  const parts = text.split(new RegExp(`(${LINE_BREAK.source})`));
  // parts = [line0, br0, line1, br1, …]; line k is parts[2k], its break parts[2k+1].
  const lineAt = at * 2;
  const next = at < physical.length - 1
    ? [...parts.slice(0, lineAt), ...parts.slice(lineAt + 2)]
    : [...parts.slice(0, Math.max(lineAt - 1, 0))];

  const moved: Record<string, number> = {};
  for (const { line, raw, product_id } of toChoicePayload(choices)) {
    if (line < index) moved[choiceKey(line, raw)] = product_id;
    else if (line > index) moved[choiceKey(line - 1, raw)] = product_id;
  }

  return { text: next.join(""), choices: moved };
};
