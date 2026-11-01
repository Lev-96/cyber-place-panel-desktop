// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { LanguageProvider, accountCurrencyKey, useLang } from "./LanguageContext";

/**
 * The display currency is the person's, not the machine's (2026-10-27): what
 * an owner picks on the front-desk PC is not what the next manager sees.
 */
let state: ReturnType<typeof useLang> | null = null;
const Probe = () => { state = useLang(); return null; };

const mount = async () => {
  await act(async () => { render(<LanguageProvider><Probe /></LanguageProvider>); });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
};
const settle = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };

beforeEach(() => { window.localStorage.clear(); state = null; });
afterEach(() => cleanup());

describe("the display currency per account", () => {
  test("one account's choice is not the next account's", async () => {
    await mount();
    await act(async () => { state!.applyAccountCurrency(1); });
    await settle();
    await act(async () => { state!.setCurrencyOverride("USD"); });
    expect(state!.currency).toBe("USD");

    await act(async () => { state!.applyAccountCurrency(null); });
    expect(state!.currency).toBe("AMD");
    await act(async () => { state!.applyAccountCurrency(2); });
    await settle();
    expect(state!.currency).toBe("AMD");

    await act(async () => { state!.applyAccountCurrency(1); });
    await settle();
    expect(state!.currency).toBe("USD");
  });

  test("the old per-machine choice is removed, never handed to whoever signs in", async () => {
    window.localStorage.setItem("cp.currencyOverride", JSON.stringify("RUB"));
    await mount();
    await act(async () => { state!.applyAccountCurrency(3); });
    await settle();
    expect(state!.currency).toBe("AMD");
    expect(window.localStorage.getItem("cp.currencyOverride")).toBeNull();
    expect(window.localStorage.getItem(accountCurrencyKey(3))).toBeNull();
  });

  test("nothing is written when nobody is signed in", async () => {
    await mount();
    await act(async () => { state!.setCurrencyOverride("USD"); });
    expect(Object.keys(window.localStorage).filter((k) => k.includes("currency"))).toEqual([]);
  });
});
