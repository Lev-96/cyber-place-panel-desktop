/**
 * A paid bill's method in plain words (2026-11-07) — one wording for a seat's
 * history, a till sale and the shift: «Наличные», «Другой способ: Idram», or
 * for a split «Раздельно: Наличные 2 000 · Карта 3 000 (3000 картой…)».
 */
type T = (key: string) => string;
type Money = (n: number) => string;

export type AnyMethod = "cash" | "card" | "other" | "deposit";

export const METHOD_LABEL_KEY: Record<AnyMethod, string> = {
  cash: "session.payCash",
  card: "session.payCard",
  other: "session.payOther",
  deposit: "till.payDeposit",
};

export interface PaidPart { method: AnyMethod; amount: number | string; note?: string | null }

/** «Наличные 2 000 · Карта 3 000». */
export const paymentPartsText = (parts: readonly PaidPart[], t: T, money: Money): string =>
  parts.map((p) => `${t(METHOD_LABEL_KEY[p.method] ?? p.method)} ${money(Number(p.amount))}`).join(" · ");

/** The note a split carries (on its lines), when one was written. */
export const paymentNoteOf = (parts: readonly PaidPart[]): string | null =>
  parts.map((p) => (p.note ?? "").trim()).find((n) => n !== "") ?? null;

/**
 * The whole line, or null when nothing was recorded. A split is read from its
 * parts; a row from before them from its one method.
 */
export const paymentText = (
  row: { payment_method?: string | null; payment_method_other?: string | null; payments?: readonly PaidPart[] },
  t: T,
  money: Money,
): string | null => {
  const parts = row.payments ?? [];
  if (row.payment_method === "split" || parts.length > 1) {
    if (parts.length === 0) return t("pay.splitSummary");
    const note = paymentNoteOf(parts);
    return `${t("pay.splitSummary")}: ${paymentPartsText(parts, t, money)}${note ? ` (${note})` : ""}`;
  }
  const method = row.payment_method as AnyMethod | null | undefined;
  if (!method) return null;
  if (method === "other") {
    const typed = (row.payment_method_other ?? "").trim();
    return typed === "" ? null : `${t(METHOD_LABEL_KEY.other)}: ${typed}`;
  }
  return t(METHOD_LABEL_KEY[method] ?? method);
};
