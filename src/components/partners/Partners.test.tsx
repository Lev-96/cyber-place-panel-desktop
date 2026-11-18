// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { IPartner, ISettlement } from "@/api/partners";

/**
 * «Мои партнёры» (2026-11-18, owner): the list says the terms in words, the
 * dialog sends exactly the body the server takes (the figure of the chosen
 * terms only), archive asks the in-app confirm first, and the settlement
 * prints every figure as sent, saying plainly when the partner owes the club.
 */

const repo = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn(), update: vi.fn(), archive: vi.fn(), settlement: vi.fn() }));
vi.mock("@/repositories/PartnerRepository", () => ({
  partnerRepository: {
    list: (...a: unknown[]) => repo.list(...a),
    create: (...a: unknown[]) => repo.create(...a),
    update: (...a: unknown[]) => repo.update(...a),
    archive: (...a: unknown[]) => repo.archive(...a),
    settlement: (...a: unknown[]) => repo.settlement(...a),
  },
}));
const branches = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("@/repositories/BranchRepository", () => ({ branchRepository: { list: (...a: unknown[]) => branches.list(...a) } }));
vi.mock("@/i18n/LanguageContext", async () => {
  const { t } = await import("@/i18n/translations");
  return { useLang: () => ({ t: (k: string) => t(k, "ru"), money: (n: number) => `${n} ֏`, lang: "ru" }) };
});
vi.mock("@/components/ui/Modal", () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/components/ui/PriceInput", () => ({
  default: ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
    <input aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));
const confirmAnswer = vi.hoisted(() => ({ value: true, asked: [] as string[] }));
vi.mock("@/components/ui/ConfirmProvider", () => ({
  useConfirm: () => async (msg: string) => { confirmAnswer.asked.push(msg); return confirmAnswer.value; },
}));

import PartnerList from "./PartnerList";
import PartnerDialog from "./PartnerDialog";
import PartnerSettlementView from "./PartnerSettlementView";

const partner = (over: Partial<IPartner> = {}): IPartner => ({
  id: 7, company_id: 1, name: "Pizza House", phone: "+37491000000", note: null, terms: "percent", percent: "10.00",
  fixed_amount: null, active: true, archived: false, archived_at: null, products_count: 3, ...over,
});

const settle = async () => { for (let i = 0; i < 5; i++) await act(async () => { await Promise.resolve(); }); };

beforeEach(() => {
  for (const f of Object.values(repo)) f.mockReset();
  branches.list.mockReset();
  branches.list.mockResolvedValue([]);
  confirmAnswer.value = true;
  confirmAnswer.asked = [];
});
afterEach(() => cleanup());

describe("PartnerList", () => {
  test("each partner: name, terms in words, phone and products", async () => {
    repo.list.mockResolvedValue([partner(), partner({ id: 8, name: "Grill", terms: "fixed", percent: null, fixed_amount: "50000.00", phone: null, products_count: 0 })]);
    await act(async () => { render(<PartnerList companyId={1} />); });
    await settle();
    expect(repo.list).toHaveBeenCalledWith(1, false);
    const first = screen.getByTestId("partner-row-7");
    expect(within(first).getByTestId("partner-terms").textContent).toBe("10% остаётся клубу");
    expect(first.textContent).toContain("+37491000000 · Товаров: 3");
    expect(within(screen.getByTestId("partner-row-8")).getByTestId("partner-terms").textContent).toBe("50000 ֏ в месяц платит клубу");
  });

  test("archive asks first; «no» sends nothing, «yes» archives and reads the list again", async () => {
    repo.list.mockResolvedValue([partner()]);
    repo.archive.mockResolvedValue(partner({ archived: true }));
    await act(async () => { render(<PartnerList companyId={1} />); });
    await settle();
    confirmAnswer.value = false;
    await act(async () => { fireEvent.click(screen.getByTestId("partner-archive")); });
    expect(confirmAnswer.asked[0]).toContain("«Pizza House»");
    expect(repo.archive).not.toHaveBeenCalled();
    confirmAnswer.value = true;
    await act(async () => { fireEvent.click(screen.getByTestId("partner-archive")); });
    await settle();
    expect(repo.archive).toHaveBeenCalledWith(7);
    expect(repo.list).toHaveBeenCalledTimes(2);
  });

  test("the archive is read only when asked, and an archived partner has no buttons", async () => {
    repo.list.mockResolvedValue([partner({ archived: true })]);
    await act(async () => { render(<PartnerList companyId={1} />); });
    await settle();
    await act(async () => { fireEvent.click(screen.getByText("Показать архив")); });
    await settle();
    expect(repo.list).toHaveBeenLastCalledWith(1, true);
    expect(screen.getByTestId("partner-row-7").textContent).toContain("В архиве");
    expect(screen.queryByTestId("partner-edit")).toBeNull();
    expect(screen.queryByTestId("partner-archive")).toBeNull();
  });
});

describe("PartnerDialog — the body the server takes", () => {
  const type = async (testId: string, value: string) => {
    await act(async () => { fireEvent.change(screen.getByTestId(testId), { target: { value } }); });
  };
  const save = async () => { await act(async () => { fireEvent.click(screen.getByTestId("partner-save")); }); };

  test("percent terms: the percent only, empty phone and comment as null", async () => {
    repo.create.mockResolvedValue(partner());
    await act(async () => { render(<PartnerDialog companyId={1} onClose={() => {}} onSaved={() => {}} />); });
    await type("partner-name", "  Pizza House ");
    await type("partner-percent", "12,5");
    await save();
    expect(repo.create).toHaveBeenCalledWith(1, { name: "Pizza House", phone: null, note: null, terms: "percent", percent: 12.5 });
  });

  test("fixed terms: the sum only, never a percent", async () => {
    repo.create.mockResolvedValue(partner());
    await act(async () => { render(<PartnerDialog companyId={1} onClose={() => {}} onSaved={() => {}} />); });
    await type("partner-name", "Grill");
    await type("partner-percent", "10");
    await act(async () => { fireEvent.click(within(screen.getByTestId("partner-terms-fixed")).getByRole("radio")); });
    await act(async () => { fireEvent.change(screen.getByLabelText("Сумма в месяц"), { target: { value: "50000" } }); });
    await type("partner-note", "pays on the 5th");
    await save();
    expect(repo.create).toHaveBeenCalledWith(1, { name: "Grill", phone: null, note: "pays on the 5th", terms: "fixed", fixed_amount: 50000 });
  });

  test("a percent over 100 or a missing name is refused here, nothing is sent", async () => {
    await act(async () => { render(<PartnerDialog companyId={1} onClose={() => {}} onSaved={() => {}} />); });
    // Spaces only: past the browser's own «required», stopped here.
    await type("partner-name", "   ");
    await save();
    expect(screen.getByRole("alert").textContent).toBe("Введите название партнёра");
    await type("partner-name", "X");
    await type("partner-percent", "101");
    await save();
    expect(screen.getByRole("alert").textContent).toBe("Процент: число от 0 до 100");
    expect(repo.create).not.toHaveBeenCalled();
  });

  test("editing opens on the partner's terms and PATCHes that partner", async () => {
    repo.update.mockResolvedValue(partner());
    await act(async () => { render(<PartnerDialog companyId={1} initial={partner({ percent: "7.50" })} onClose={() => {}} onSaved={() => {}} />); });
    expect((screen.getByTestId("partner-percent") as HTMLInputElement).value).toBe("7.5");
    await save();
    expect(repo.update).toHaveBeenCalledWith(7, { name: "Pizza House", phone: "+37491000000", note: null, terms: "percent", percent: 7.5 });
    expect(repo.create).not.toHaveBeenCalled();
  });

  test("the server's refusal stays under the fields", async () => {
    repo.create.mockRejectedValue(new Error("Компания заблокирована."));
    await act(async () => { render(<PartnerDialog companyId={1} onClose={() => {}} onSaved={() => {}} />); });
    await type("partner-name", "X");
    await type("partner-percent", "5");
    await save();
    expect(screen.getByRole("alert").textContent).toBe("Компания заблокирована.");
  });
});

const SETTLEMENT: ISettlement = {
  company_id: 1, month: "2026-11", branch_id: null, windows: [], terms_note: "server note",
  partners: [
    {
      partner: { id: 7, name: "Pizza House", active: true, archived: false },
      terms: { terms: "percent", percent: "10.00", fixed_amount: null },
      sales_total: "100000.00", units: 40, rows: [{ product_id: 2, name: "Pizza", quantity: 40, total: "100000.00" }],
      club_share: "10000.00", partner_share: "90000.00", partner_owes: false,
    },
    {
      partner: { id: 8, name: "Grill", active: true, archived: false },
      terms: { terms: "fixed", percent: null, fixed_amount: "50000.00" },
      sales_total: "30000.00", units: 12, rows: [{ product_id: 3, name: "Kebab", quantity: 12, total: "30000.00" }],
      // The server's figures, deliberately NOT what a client would work out:
      // the screen must print these, never its own sum.
      club_share: "50000.00", partner_share: "-20000.00", partner_owes: true,
    },
  ],
  own: { sales_total: "8000.00", units: 9, rows: [{ product_id: 4, name: "Hot dog", quantity: 9, total: "8000.00" }] },
  totals: { sales_total: "130000.00", units: 52, club_share: "60000.00", partner_share: "70000.00", fast_food_total: "138000.00", fast_food_units: 61 },
};

describe("PartnerSettlementView", () => {
  test("asks for this month, says the period by days, and prints each partner's figures as sent", async () => {
    vi.useFakeTimers({ now: new Date(2026, 10, 18, 12, 0), toFake: ["Date"] });
    repo.settlement.mockResolvedValue(SETTLEMENT);
    await act(async () => { render(<PartnerSettlementView companyId={1} />); });
    await settle();
    vi.useRealTimers();
    expect(repo.settlement).toHaveBeenCalledWith(1, "2026-11", null);
    expect(screen.getByTestId("settlement-period").textContent).toBe("с 01.11.2026 по 30.11.2026");
    const pizza = screen.getByTestId("settlement-partner-7");
    expect(within(pizza).getByTestId("settlement-terms").textContent).toBe("10% остаётся клубу");
    expect(within(pizza).getByTestId("settlement-sold").textContent).toBe("Продано на100000 ֏Штук: 40");
    expect(within(pizza).getByTestId("settlement-club").textContent).toBe("Клубу10000 ֏");
    expect(within(pizza).getByTestId("settlement-partner").textContent).toBe("Партнёру90000 ֏");
    expect(within(pizza).queryByTestId("settlement-owes")).toBeNull();
    expect(pizza.textContent).toContain("Pizza× 40100000 ֏");
    expect(screen.getByTestId("settlement-total").textContent).toContain("138000 ֏");
    expect(screen.getByTestId("settlement-own").textContent).toContain("8000 ֏");
    expect(screen.getByTestId("settlement-own").textContent).toContain("Hot dog");
  });

  test("a partner who owes the club is told so plainly, with the server's sum", async () => {
    repo.settlement.mockResolvedValue(SETTLEMENT);
    await act(async () => { render(<PartnerSettlementView companyId={1} />); });
    await settle();
    const grill = screen.getByTestId("settlement-partner-8");
    expect(within(grill).getByTestId("settlement-terms").textContent).toBe("50000 ֏ в месяц платит клубу");
    expect(within(grill).getByTestId("settlement-club").textContent).toBe("Клубу50000 ֏");
    expect(within(grill).getByTestId("settlement-partner").textContent).toBe("Партнёру-20000 ֏");
    expect(within(grill).getByTestId("settlement-owes").textContent).toBe("Партнёр должен клубу 20000 ֏");
    expect(grill.className).toContain("is-owes");
  });

  test("another month and a branch go on the request", async () => {
    vi.useFakeTimers({ now: new Date(2026, 0, 10, 12, 0), toFake: ["Date"] });
    repo.settlement.mockResolvedValue(SETTLEMENT);
    branches.list.mockResolvedValue([
      { id: 1, company_id: 1, address: "Abovyan 1", city: "Yerevan" },
      { id: 2, company_id: 1, address: "Tumanyan 5", city: "Yerevan" },
    ]);
    await act(async () => { render(<PartnerSettlementView companyId={1} />); });
    await settle();
    await act(async () => { fireEvent.click(screen.getByTestId("settlement-prev")); });
    await settle();
    vi.useRealTimers();
    expect(repo.settlement).toHaveBeenLastCalledWith(1, "2025-12", null);
    expect(branches.list).toHaveBeenCalledWith({ company_id: 1 });
    await act(async () => { fireEvent.change(screen.getByTestId("settlement-branch"), { target: { value: "2" } }); });
    await settle();
    expect(repo.settlement).toHaveBeenLastCalledWith(1, "2025-12", 2);
  });

  test("a failed month shows the error, never the previous month's figures", async () => {
    repo.settlement.mockResolvedValueOnce(SETTLEMENT);
    await act(async () => { render(<PartnerSettlementView companyId={1} />); });
    await settle();
    repo.settlement.mockRejectedValueOnce(new Error("boom"));
    await act(async () => { fireEvent.click(screen.getByTestId("settlement-prev")); });
    await settle();
    expect(screen.queryByTestId("settlement-partner-7")).toBeNull();
    expect(screen.getByText("Не удалось загрузить расчёт")).toBeTruthy();
  });
});
