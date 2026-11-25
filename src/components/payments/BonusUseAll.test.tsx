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
});
