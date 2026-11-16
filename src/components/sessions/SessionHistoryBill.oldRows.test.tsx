// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { ISessionApi } from "@/types/sessions";
import { t as translate } from "@/i18n/translations";

/**
 * Bills of sessions ended before 2026-11-15 (no prepayment, no change, no
 * unpaid lines), through the real dictionary. Recorded BEFORE the new rows were
 * added: an old bill must read exactly as it did.
 */
vi.mock("@/i18n/LanguageContext", () => ({
  useLang: () => ({ t: (k: string) => translate(k, "ru"), money: (n: number) => `${n} AMD` }),
}));
import SessionHistoryBill from "./SessionHistoryBill";

afterEach(() => cleanup());

const rowsOf = () => [...document.querySelectorAll("tr")].map((tr) => [...tr.children].map((c) => c.textContent));

const base = {
  id: 9, status: "stopped", is_free: false, total_paid: 3200, payment_method: "cash",
  items: [{ id: 1, name: "Cola", qty: 2, price: 600, product_id: 1 }], joysticks: [],
};

const OLD: Record<string, Record<string, unknown>> = {
  cash: base,
  cardNoItems: { ...base, items: [], payment_method: "card", total_paid: 1500 },
  split: { ...base, payment_method: "split", payments: [{ method: "cash", amount: "1200.00" }, { method: "card", amount: "2000.00" }] },
  free: { ...base, is_free: true, total_paid: 0 },
  cancelled: { ...base, cancelled_at: "2026-11-10T14:00:00Z", total_paid: 0, payment_method: null },
  unrecorded: { ...base, status: "expired", payment_method: null },
  running: { ...base, status: "active" },
  waived: { ...base, time_waived_total: 400 },
};

describe("old bills render exactly as before (snapshot)", () => {
  for (const [name, s] of Object.entries(OLD)) {
    test(name, () => {
      render(<SessionHistoryBill session={s as unknown as ISessionApi} closed={s.status !== "active"} />);
      expect(rowsOf()).toMatchSnapshot();
    });
  }
});
