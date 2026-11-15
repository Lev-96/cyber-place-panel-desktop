import { beforeAll, describe, expect, test } from "vitest";
import type { ISessionEvent } from "@/api/sessions";
import { t as translate, type Lang } from "@/i18n/translations";
import { eventPresentation } from "./sessionHistoryModel";

/**
 * Every audit row an older backend wrote, in the three languages, through the
 * REAL dictionary (2026-11-15). Recorded BEFORE the paid-ahead / unpaid-line /
 * keep-rate / reminder renders were added: a history line written before them
 * must read exactly as it did. A diff here is a regression in an old row, not
 * a snapshot to update.
 *
 * ONE deliberate change, made with these renders: `payment_recorded` (row 29)
 * had no entry in the action table, so it fell to the unknown-action dump and
 * printed "After: expired", "Payment method: card" in English in every
 * language. It now reads how it was paid ("Card" / "Карта" / ...), like a stop.
 */

beforeAll(() => {
  // formatTime reads the machine's zone; the venue's keeps the snapshot stable.
  process.env.TZ = "Asia/Yerevan";
});

const money = (n: number) => `${n} AMD`;
const user = { id: 3, name: "Aram", role: "manager" };

const at = "2026-11-10T14:00:00Z";
const row = (id: number, action: string, amount: number | null, meta: Record<string, unknown> | null): ISessionEvent => ({
  id, session_id: 7, branch_id: 1, action, amount, meta, created_at: at, user,
} as ISessionEvent);

/** One row per action, with the meta each carried before 2026-11-15. */
export const OLD_ROWS: ISessionEvent[] = [
  row(1, "started", 0, { mode: "open", is_free: false }),
  row(2, "started", 3000, { mode: "fixed", is_free: false, planned_minutes: 180, hourly_rate: 1000, planned_amount: 3000 }),
  row(3, "started", 2500, { mode: "fixed", is_free: false, planned_minutes: 180, hourly_rate: 833.33, planned_amount: 2500, price_set_by_hand: true, standard_amount: 3000 }),
  row(4, "time_added", 1000, { minutes: 60, new_ends_at: "2026-11-10T16:00:00Z" }),
  row(5, "time_added", 800, { minutes: 60, new_ends_at: "2026-11-10T16:00:00Z", price_set_by_hand: true, standard_charge: 1000 }),
  row(6, "item_added", 1200, { count: 2, lines: [{ name: "Cola", price: 600, qty: 2, extra: false, hourly: false }], place_number: 3 }),
  row(7, "item_removed", 0, { count: 1, lines: [{ name: "Cola", price: 600, qty: 1 }] }),
  row(8, "item_returned", 0, { count: 1, lines: [{ name: "Cue", price: 500, qty: 1 }], minutes: 40 }),
  row(9, "joystick_added", 500, { price: 500, hourly: false, count_after: 2 }),
  row(10, "joystick_added", 500, { price: 500, hourly: true, count_after: 3 }),
  row(11, "joystick_removed", 0, { count_after: 1 }),
  row(12, "made_unlimited", null, { old_mode: "fixed", hourly_rate: 1500 }),
  row(13, "made_unlimited", null, null),
  row(14, "limited", 1500, { minutes: 60, ends_at: "2026-11-10T16:00:00Z" }),
  row(15, "paused", null, null),
  row(16, "resumed", null, { paused_seconds: 600, new_ends_at: "2026-11-10T16:10:00Z" }),
  row(17, "resumed", null, { reason: "pause_limit", paused_seconds: 1800 }),
  row(18, "moved", null, { from_place_number: 2, to_place_number: 5, played_minutes_before: 75, total_before: 1250 }),
  row(19, "moved", null, { from_place_number: 2, to_place_number: 5, reason: "relocation", rate_before: 1000, rate_after: 1500 }),
  row(20, "time_reset", 400, { items_total: 600, joysticks_total: 0 }),
  row(21, "cancelled", 1600, { time_cost: 1000, items_total: 600, joysticks_total: 0 }),
  row(22, "unpaid_on", 1000, null),
  row(23, "unpaid_off", null, null),
  row(24, "free_enabled", 1000, null),
  row(25, "free_disabled", null, null),
  row(26, "stopped", 2200, { payment_method: "cash", payment_method_other: null, payments: [{ method: "cash", amount: "2200.00" }] }),
  row(27, "stopped", 2200, { reason: "expired", payment_method: null }),
  row(28, "stopped", 3000, { payment_method: "split", payments: [{ method: "cash", amount: "1000.00" }, { method: "card", amount: "2000.00" }], payment_note: "Idram" }),
  row(29, "payment_recorded", 2200, { payments: [{ method: "card", amount: "2200.00" }], after: "expired", payment_method: "card", payment_method_other: null }),
  row(30, "time_add_refused", null, { minutes: 60, reason: "seat_unavailable", max_minutes: 20 }),
  row(31, "move_failed", null, { from_place_number: 2, minutes: 30, reason: "target_taken" }),
];

describe("old audit rows render exactly as before (snapshot, real dictionary)", () => {
  for (const lang of ["en", "ru", "am"] as Lang[]) {
    test(lang, () => {
      const t = (k: string) => translate(k, lang);
      const rendered = OLD_ROWS.map((e) => ({ id: e.id, action: e.action, ...eventPresentation(e, t, money) }));
      expect(rendered).toMatchSnapshot();
    });
  }
});
