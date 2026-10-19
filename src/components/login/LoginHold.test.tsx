// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/i18n/LanguageContext", async () => {
  const { t } = await import("@/i18n/translations");
  return { useLang: () => ({ t: (k: string) => t(k, "ru"), lang: "ru" }) };
});

import LoginHold from "./LoginHold";

/**
 * The sign-in hold counts the server's "seconds left" down against the
 * machine's monotonic clock (2026-10-07): a wrong system date changes nothing,
 * and when the time is up the form is told it may try again.
 */
let now = 0;
beforeEach(() => {
  vi.useFakeTimers();
  now = 1_000;
  vi.spyOn(performance, "now").mockImplementation(() => now);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const advance = async (ms: number) => {
  now += ms;
  await act(async () => { vi.advanceTimersByTime(ms); });
};

describe("the sign-in hold", () => {
  test("counts down from the server's seconds and then says the way is open", async () => {
    const onOver = vi.fn();
    render(<LoginHold kind="locked" seconds={3000} startedAt={1_000} onOver={onOver} />);

    expect(screen.getByText("Вход временно заблокирован")).toBeTruthy();
    expect(screen.getByText("Попробовать снова через")).toBeTruthy();
    expect(screen.getByText("50 мин 00 сек")).toBeTruthy();

    await advance(28_000);
    expect(screen.getByText("49 мин 32 сек")).toBeTruthy();

    await advance(3000 * 1000);
    expect(screen.getByText("Теперь можно попробовать войти снова.")).toBeTruthy();
    expect(onOver).toHaveBeenCalledTimes(1);
  });

  test("a wrong wall clock changes nothing: only the monotonic clock counts", async () => {
    vi.setSystemTime(new Date("2001-01-01T00:00:00Z"));
    render(<LoginHold kind="throttled" seconds={59} startedAt={1_000} onOver={() => {}} />);
    expect(screen.getByText("Слишком много попыток входа")).toBeTruthy();
    expect(screen.getByText("59 сек")).toBeTruthy();

    vi.setSystemTime(new Date("2099-01-01T00:00:00Z"));
    await advance(1000);
    expect(screen.getByText("58 сек")).toBeTruthy();
  });

  test("the ticking time is hidden from screen readers; the state is a status", () => {
    render(<LoginHold kind="locked" seconds={90} startedAt={1_000} onOver={() => {}} />);
    expect(screen.getByRole("status").textContent).toContain("Вход временно заблокирован");
    expect(screen.getByText("1 мин 30 сек").getAttribute("aria-hidden")).toBe("true");
  });
});
