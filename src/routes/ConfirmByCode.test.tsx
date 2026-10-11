// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

/**
 * Scan code: the booking code box holds at most six digits (2026-10-11) — the
 * server's own rule (`ConfirmByCodeRequest`: `digits:6`). Typed or pasted,
 * only digits are kept, leading zeros included, and only a full code is sent.
 */

const api = vi.hoisted(() => ({ confirm: vi.fn() }));
vi.mock("@/api/bookings", () => ({ apiConfirmBookingByCode: (c: string) => api.confirm(c) }));
vi.mock("@/i18n/LanguageContext", () => ({ useLang: () => ({ t: (k: string) => k, lang: "en" }) }));

import ConfirmByCode from "./ConfirmByCode";

const box = () => screen.getByPlaceholderText("bookings.codePlaceholder") as HTMLInputElement;
const typeIn = async (v: string) => { await act(async () => { fireEvent.change(box(), { target: { value: v } }); }); };
const submit = async () => { await act(async () => { fireEvent.submit(box().closest("form")!); }); };
const button = () => screen.getByRole("button", { name: "action.confirm" }) as HTMLButtonElement;

beforeEach(() => {
  api.confirm.mockReset();
  api.confirm.mockResolvedValue({ booking: { code: "001234", status: "confirmed" } });
  render(<ConfirmByCode />);
});
afterEach(cleanup);

describe("the booking code box", () => {
  test("keeps at most six digits, typed or pasted", async () => {
    await typeIn("1234567890");
    expect(box().value).toBe("123456");
  });

  test("drops anything that is not a digit, including from a paste", async () => {
    await typeIn(" 12-34 ab56 ");
    expect(box().value).toBe("123456");
    await typeIn("abc");
    expect(box().value).toBe("");
  });

  test("keeps leading zeros and sends the code as a string", async () => {
    await typeIn("001234");
    expect(box().value).toBe("001234");
    await submit();
    expect(api.confirm).toHaveBeenCalledWith("001234");
  });

  test("an incomplete code cannot be sent, not even with Enter", async () => {
    await typeIn("12345");
    expect(button().disabled).toBe(true);
    await submit();
    expect(api.confirm).not.toHaveBeenCalled();
  });

  test("cleared after a confirmed code, ready for the next one", async () => {
    await typeIn("482931");
    expect(button().disabled).toBe(false);
    await submit();
    expect(api.confirm).toHaveBeenCalledTimes(1);
    expect(box().value).toBe("");
    await typeIn("777777");
    await submit();
    expect(api.confirm).toHaveBeenLastCalledWith("777777");
  });
});
