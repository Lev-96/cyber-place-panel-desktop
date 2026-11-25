// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

const confirmAnswer = vi.hoisted(() => ({ value: true, asked: [] as string[] }));
vi.mock("@/components/ui/ConfirmProvider", () => ({ useConfirm: () => async (m: string) => { confirmAnswer.asked.push(m); return confirmAnswer.value; } }));
vi.mock("@/i18n/LanguageContext", () => ({ useLang: () => ({ t: (k: string) => k, money: (n: number, o?: { minimumFractionDigits?: number }) => (o?.minimumFractionDigits ? n.toFixed(2) : String(n)) }) }));
vi.mock("@/i18n/translations", () => ({ fmt: (s: string, ...a: unknown[]) => `${s}|${a.join("|")}` }));

import BonusUseAll from "./BonusUseAll";
import { emptyPaymentDraft } from "./paymentSplit";

afterEach(() => { cleanup(); confirmAnswer.asked = []; confirmAnswer.value = true; });

describe("«Использовать все бонусы»", () => {
  test("asks first, then spends what the card has and says the shortfall", async () => {
    const onChange = vi.fn();
    render(<BonusUseAll balanceCents={30000} dueCents={100000} value={emptyPaymentDraft("cash")} onChange={onChange} />);
    await act(async () => { fireEvent.click(screen.getByTestId("pay-bonus-use-all")); });
    expect(confirmAnswer.asked).toEqual(["pay.bonusUseAllConfirm|300"]);
    expect(onChange.mock.calls[0][0]).toMatchObject({ split: true, bonus: "300.00", amounts: { cash: "700.00", card: "" } });
    expect(screen.getByTestId("pay-bonus-short").textContent).toBe("pay.bonusShort|700");
  });

  test("to the cent (QA 2026-11-25): a bill of 40.28 asks «40.28», never «40»", async () => {
    render(<BonusUseAll balanceCents={30000} dueCents={4028} value={emptyPaymentDraft("cash")} onChange={vi.fn()} />);
    await act(async () => { fireEvent.click(screen.getByTestId("pay-bonus-use-all")); });
    expect(confirmAnswer.asked.at(-1)).toBe("pay.bonusUseAllConfirm|40.28");
  });

  test("declined: nothing changes", async () => {
    confirmAnswer.value = false;
    const onChange = vi.fn();
    render(<BonusUseAll balanceCents={30000} dueCents={100000} value={emptyPaymentDraft("cash")} onChange={onChange} />);
    await act(async () => { fireEvent.click(screen.getByTestId("pay-bonus-use-all")); });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByTestId("pay-bonus-short")).toBeNull();
  });

  test("an empty card cannot be used", () => {
    render(<BonusUseAll balanceCents={0} dueCents={100000} value={emptyPaymentDraft("cash")} onChange={vi.fn()} />);
    expect((screen.getByTestId("pay-bonus-use-all") as HTMLButtonElement).disabled).toBe(true);
  });

  const typeIn = async (v: string) => {
    await act(async () => { fireEvent.change(screen.getByTestId("pay-bonus-part-input"), { target: { value: v } }); });
  };
  const input = () => screen.getByTestId("pay-bonus-part-input") as HTMLInputElement;

  test("«Сколько бонусами» (2026-11-25): 300 of a 1 000 bill → 300 bonuses + 700 cash as typed, no button", async () => {
    const onChange = vi.fn();
    render(<BonusUseAll balanceCents={50000} dueCents={100000} value={emptyPaymentDraft("cash")} onChange={onChange} />);
    expect(screen.queryByTestId("pay-bonus-part-apply")).toBeNull();
    await typeIn("300");
    expect(onChange.mock.lastCall![0]).toMatchObject({ split: true, bonus: "300.00", amounts: { cash: "700.00", card: "" } });
  });

  test("more than the card holds is cut to the card: 250 typed, 200 on the card → 200 + 800 cash", async () => {
    const onChange = vi.fn();
    render(<BonusUseAll balanceCents={20000} dueCents={100000} value={emptyPaymentDraft("cash")} onChange={onChange} />);
    await typeIn("250");
    expect(input().value).toBe("200");
    expect(onChange.mock.lastCall![0]).toMatchObject({ split: true, bonus: "200.00", amounts: { cash: "800.00" } });
  });

  test("letters never land; a cleared box puts the whole bill back on cash", async () => {
    const onChange = vi.fn();
    render(<BonusUseAll balanceCents={50000} dueCents={100000} value={emptyPaymentDraft("cash")} onChange={onChange} />);
    await typeIn("1a");
    expect(onChange).not.toHaveBeenCalled();
    await typeIn("150.5");
    expect(onChange.mock.lastCall![0]).toMatchObject({ bonus: "150.50", amounts: { cash: "849.50" } });
    await typeIn("");
    expect(onChange.mock.lastCall![0]).toMatchObject({ bonus: "", amounts: { cash: "1000.00" } });
  });

  test("the whole bill from the card: a single «Бонусы», not a split", async () => {
    const onChange = vi.fn();
    render(<BonusUseAll balanceCents={500000} dueCents={100000} value={emptyPaymentDraft("cash")} onChange={onChange} />);
    await typeIn("1000");
    expect(onChange.mock.lastCall![0]).toMatchObject({ split: false, method: "bonus" });
  });
});
