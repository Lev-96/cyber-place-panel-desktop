// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { t as translate } from "@/i18n/translations";
import type { IBranchApi } from "@/types/api";

/**
 * Branch → Working hours (2026-11-13).
 *
 * The bug: `branch_works_hours` stores MySQL TIME, so the branch reads back
 * "10:00:00"; the form sent that straight back and the backend
 * (`date_format:H:i`) refused every save with
 * «days_of_weeks.0.start_time не соответствует формату H:i (and 13 more)».
 * The form must send "HH:MM" whatever the server did, never send an empty
 * week (a 422 the backend's UpdateService would otherwise ignore), treat a close
 * at or before the open as next-day hours, and show a refusal in words.
 */

const repo = vi.hoisted(() => ({ updateOpenDays: vi.fn() }));
vi.mock("@/repositories/BranchRepository", () => ({
  branchRepository: { updateOpenDays: (...a: unknown[]) => repo.updateOpenDays(...a) },
}));
// The real English dictionary, so the assertions read like the screen.
vi.mock("@/i18n/LanguageContext", () => ({ useLang: () => ({ t: (k: string) => translate(k, "en"), lang: "en" }) }));
vi.mock("@/components/ui/Modal", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import BranchOpenDaysForm from "./BranchOpenDaysForm";

type Day = { day_of_week: number; start_time: string; end_time: string };

const branch = (days: Day[]): IBranchApi => ({
  id: 7,
  company_id: 3,
  city: "Yerevan",
  country: "Armenia",
  address: "Abovyan 5",
  address_lat: 40.18,
  address_lng: 44.5,
  phone: "+374 77 123456",
  branch_logo_path: "",
  status: "active",
  ratings_avg_rating: null,
  days_of_weeks: days,
});

/** Seven days as the server returns them: TIME columns, seconds included. */
const storedWeek = (start = "10:00:00", end = "23:00:00"): Day[] =>
  [1, 2, 3, 4, 5, 6, 7].map((d) => ({ day_of_week: d, start_time: start, end_time: end }));

let onSaved: ReturnType<typeof vi.fn<() => void>>;
const mount = (days: Day[]) => {
  onSaved = vi.fn<() => void>();
  render(<BranchOpenDaysForm branch={branch(days)} onClose={() => {}} onSaved={onSaved} />);
};

const save = async () => {
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Save" })); });
};
const ISO: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
const dayRow = (day: string) => screen.getByTestId(`open-day-${ISO[day]}`);
const time = (day: string, which: "Open" | "Close") =>
  screen.getByRole("textbox", { name: `${day}, ${which}` }) as HTMLInputElement;
const type = (day: string, which: "Open" | "Close", value: string) =>
  fireEvent.change(time(day, which), { target: { value } });
const toggle = (day: string) => fireEvent.click(screen.getByRole("switch", { name: day }));
const sent = () => repo.updateOpenDays.mock.calls[0][1] as Day[];

beforeEach(() => {
  repo.updateOpenDays.mockReset().mockResolvedValue({ message: "ok" });
});
afterEach(cleanup);

describe("BranchOpenDaysForm", () => {
  test("a stored 10:00:00 is shown and saved as 10:00 (the reported bug)", async () => {
    mount(storedWeek());
    expect(time("Mon", "Open").value).toBe("10:00");
    expect(time("Mon", "Close").value).toBe("23:00");

    await save();

    expect(repo.updateOpenDays).toHaveBeenCalledTimes(1);
    for (const day of sent()) {
      expect(day.start_time).toBe("10:00");
      expect(day.end_time).toBe("23:00");
    }
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  test("sends exactly the open days, Monday first, three fields each, HH:MM only", async () => {
    // Stored out of order, with seconds; Tuesday, Thursday and Saturday off.
    mount([
      { day_of_week: 7, start_time: "12:00:00", end_time: "02:40:00" },
      { day_of_week: 1, start_time: "09:30:00", end_time: "22:00:00" },
      { day_of_week: 5, start_time: "10:00", end_time: "00:00" },
      { day_of_week: 3, start_time: "00:00:00", end_time: "00:00:00" },
    ]);

    await save();

    expect(repo.updateOpenDays).toHaveBeenCalledWith(7, [
      { day_of_week: 1, start_time: "09:30", end_time: "22:00" },
      { day_of_week: 3, start_time: "00:00", end_time: "00:00" },
      { day_of_week: 5, start_time: "10:00", end_time: "00:00" },
      { day_of_week: 7, start_time: "12:00", end_time: "02:40" },
    ]);
  });

  test("a stored time that is not HH:MM or HH:MM:SS falls back to 10:00 / 23:00", async () => {
    mount([{ day_of_week: 2, start_time: "9:00", end_time: "24:00:00" }]);
    expect(time("Tue", "Open").value).toBe("10:00");
    expect(time("Tue", "Close").value).toBe("23:00");
  });

  test("every day switched off: nothing is sent and the form says why", async () => {
    mount(storedWeek());
    for (const day of ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]) toggle(day);

    expect(screen.getByTestId("open-days-summary").textContent).toBe("Closed every day");
    await save();

    expect(repo.updateOpenDays).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toBe(translate("openDays.errors.noDays", "en"));
  });

  test("a closed day shows «Day off», hides its times, and keeps them for when it reopens", async () => {
    mount([{ day_of_week: 1, start_time: "11:00:00", end_time: "21:00:00" }]);
    expect(within(dayRow("Tue")).getByText("Day off")).toBeTruthy();
    expect(within(dayRow("Tue")).queryByRole("textbox")).toBeNull();

    toggle("Mon");
    expect(within(dayRow("Mon")).getByText("Day off")).toBeTruthy();
    toggle("Mon");
    expect(time("Mon", "Open").value).toBe("11:00");
  });

  test("a close after midnight is next-day hours, never an error", async () => {
    mount([
      { day_of_week: 1, start_time: "10:00:00", end_time: "02:40:00" },
      { day_of_week: 2, start_time: "10:00:00", end_time: "23:00:00" },
      { day_of_week: 3, start_time: "10:00:00", end_time: "10:00:00" },
      { day_of_week: 4, start_time: "00:00:00", end_time: "00:00:00" },
    ]);

    expect(within(dayRow("Mon")).getByText("Until 02:40 next day")).toBeTruthy();
    expect(within(dayRow("Tue")).queryByTestId("open-day-hint")).toBeNull();
    expect(within(dayRow("Wed")).getByText("24 hours, until 10:00 next day")).toBeTruthy();
    expect(within(dayRow("Thu")).getByText("Around the clock")).toBeTruthy();

    // Typing an overnight close updates the hint live.
    type("Tue", "Close", "03:15");
    expect(within(dayRow("Tue")).getByText("Until 03:15 next day")).toBeTruthy();

    await save();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(sent()[0]).toEqual({ day_of_week: 1, start_time: "10:00", end_time: "02:40" });
  });

  test("apply to all: one day's hours on every open day, closed days stay closed", async () => {
    mount(storedWeek().filter((d) => d.day_of_week !== 6));
    type("Tue", "Open", "12:00");
    type("Tue", "Close", "04:00");

    fireEvent.click(screen.getByRole("button", { name: "Apply Tue hours to every open day" }));
    expect(screen.getByTestId("open-days-summary").textContent).toBe("Open 6 days a week · 12:00–04:00 (+1 day)");
    expect(within(dayRow("Sat")).getByText("Day off")).toBeTruthy();

    await save();
    expect(sent().map((d) => d.day_of_week)).toEqual([1, 2, 3, 4, 5, 7]);
    for (const day of sent()) expect([day.start_time, day.end_time]).toEqual(["12:00", "04:00"]);
  });

  test("an incomplete time blocks the save and is marked", async () => {
    mount(storedWeek());
    type("Wed", "Close", "2");
    await save();

    expect(repo.updateOpenDays).not.toHaveBeenCalled();
    expect(time("Wed", "Close").getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByRole("alert").textContent).toBe(translate("openDays.errors.time", "en"));
  });

  test("the server's refusal is shown in words, with the refused field marked", async () => {
    const refusal = Object.assign(
      new Error("The days_of_weeks.1.start_time field must match the format H:i. (and 13 more errors)"),
      {
        status: 422,
        body: {
          message: "The days_of_weeks.1.start_time field must match the format H:i. (and 13 more errors)",
          errors: { "days_of_weeks.1.start_time": ["The days_of_weeks.1.start_time field must match the format H:i."] },
        },
      },
    );
    repo.updateOpenDays.mockRejectedValueOnce(refusal);
    mount(storedWeek().filter((d) => d.day_of_week !== 1));

    await save();

    const alert = screen.getByRole("alert").textContent ?? "";
    // Index 1 of what was sent is Wednesday (Monday is off).
    expect(alert).toBe('The "Wed, Open" field must match the format H:i. (and 13 more errors)');
    expect(alert).not.toContain("days_of_weeks");
    expect(time("Wed", "Open").getAttribute("aria-invalid")).toBe("true");
    expect(onSaved).not.toHaveBeenCalled();

    // Editing the field clears the server's mark.
    type("Wed", "Open", "11:00");
    expect(time("Wed", "Open").getAttribute("aria-invalid")).toBeNull();
  });

  test("a failure with no server sentence says the generic failure", async () => {
    repo.updateOpenDays.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    mount(storedWeek());
    await save();
    expect(screen.getByRole("alert").textContent).toBe(translate("form.errors.failedSave", "en"));
  });
});
