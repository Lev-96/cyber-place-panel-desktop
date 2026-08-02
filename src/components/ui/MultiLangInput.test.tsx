// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { Lang } from "@/i18n/translations";
import type { TranslationPreviewResult } from "@/api/translations";
import { useState } from "react";

/**
 * The multilingual name field.
 *
 * The specification, as tests:
 *
 *   1. the interface language always comes first, and the order follows it;
 *   2. typing in that first box fills the other two automatically;
 *   3. every language can then be edited by hand;
 *   4. a hand-edited language is never silently overwritten afterwards;
 *   5. the three values are independent — editing one changes nothing else.
 */

const lang = vi.hoisted(() => ({ current: "ru" as Lang }));

// Typed against the real contract so a test cannot assert a shape the API
// does not actually return. `reason` is optional there, which is why the
// happy-path mocks below may omit it.
const api = vi.hoisted(() => ({
  apiPreviewTranslation: vi.fn(
    async (_body: unknown): Promise<TranslationPreviewResult> => ({ translations: {}, failed: [] }),
  ),
}));

vi.mock("@/i18n/LanguageContext", () => ({
  useLang: () => ({
    lang: lang.current,
    ready: true,
    chosen: true,
    setLang: vi.fn(),
    currency: "AMD",
    setCurrencyOverride: vi.fn(),
    t: (k: string) => k,
    money: (n: number) => String(n),
  }),
}));

vi.mock("@/api/translations", () => ({ apiPreviewTranslation: api.apiPreviewTranslation }));

import MultiLangInput, { emptyLangValues, LangValues } from "@/components/ui/MultiLangInput";

/** Renders the field as a controlled input and exposes the latest value. */
const Harness = ({ initial }: { initial?: LangValues }) => {
  const [values, setValues] = useState<LangValues>(initial ?? emptyLangValues());

  return (
    <>
      <MultiLangInput label="name" values={values} onChange={setValues} fieldClass="product_name" />
      <output data-testid="dump">{JSON.stringify(values)}</output>
    </>
  );
};

const dump = (): LangValues => JSON.parse(screen.getByTestId("dump").textContent ?? "{}");

/** Inputs in DOM order — index 0 is the primary (interface-language) box. */
const boxes = () => Array.from(document.querySelectorAll<HTMLInputElement>("input.input"));

/** Language chips in DOM order, which is what the ordering requirement is about. */
const langOrder = () =>
  Array.from(document.querySelectorAll(".cp-mli-lang > span")).map((el) => el.textContent);

const typePrimary = async (text: string) => {
  await act(async () => { fireEvent.change(boxes()[0], { target: { value: text } }); });
};

/** Let the debounce fire and the (already-resolved) request settle. */
const settle = async () => {
  await act(async () => { vi.advanceTimersByTime(600); });
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
};

beforeEach(() => {
  vi.useFakeTimers();
  lang.current = "ru";
  api.apiPreviewTranslation.mockResolvedValue({ translations: {}, failed: [] });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("field order follows the interface language", () => {
  test("Russian interface puts Russian first", () => {
    lang.current = "ru";
    render(<Harness />);

    expect(langOrder()).toEqual(["Русский", "English", "Հայերեն"]);
  });

  test("English interface puts English first", () => {
    lang.current = "en";
    render(<Harness />);

    expect(langOrder()).toEqual(["English", "Русский", "Հայերեն"]);
  });

  test("Armenian interface puts Armenian first", () => {
    lang.current = "am";
    render(<Harness />);

    expect(langOrder()).toEqual(["Հայերեն", "English", "Русский"]);
  });
});

describe("automatic translation", () => {
  test("typing in the first box fills the other two", async () => {
    api.apiPreviewTranslation.mockResolvedValue({
      translations: { en: "Coke", am: "Կոլա" },
      failed: [],
    });

    render(<Harness />);
    await typePrimary("Кола");
    await settle();

    expect(dump()).toEqual({ ru: "Кола", en: "Coke", am: "Կոլա" });
  });

  test("it asks only for the languages it does not already own", async () => {
    render(<Harness />);
    await typePrimary("Кола");
    await settle();

    const body = api.apiPreviewTranslation.mock.calls[0][0] as {
      source_locale: Lang; targets: Lang[]; text: string;
    };
    expect(body.source_locale).toBe("ru");
    expect(body.targets).toEqual(["en", "am"]);
    expect(body.text).toBe("Кола");
  });

  test("typing is debounced into one request", async () => {
    render(<Harness />);

    // Four keystrokes in quick succession must not be four billed calls.
    await typePrimary("К");
    await typePrimary("Ко");
    await typePrimary("Кол");
    await typePrimary("Кола");
    await settle();

    expect(api.apiPreviewTranslation).toHaveBeenCalledTimes(1);
  });

  test("clearing the source clears the languages derived from it", async () => {
    api.apiPreviewTranslation.mockResolvedValue({
      translations: { en: "Coke", am: "Կոլա" },
      failed: [],
    });

    render(<Harness />);
    await typePrimary("Кола");
    await settle();
    await typePrimary("");

    // Leaving "Coke" behind would strand a translation of text that no longer
    // exists, and it would be saved.
    expect(dump()).toEqual({ ru: "", en: "", am: "" });
  });

  test("a failed language is reported, not filled with the source text", async () => {
    api.apiPreviewTranslation.mockResolvedValue({
      translations: { en: "Coke" },
      failed: ["am"],
    });

    render(<Harness />);
    await typePrimary("Кола");
    await settle();

    // Echoing "Кола" into the Armenian box would look like it worked.
    expect(dump().am).toBe("");
    expect(screen.getByText("multilang.failed")).toBeTruthy();
  });

  test("a configuration failure says so, instead of the generic message", async () => {
    // The exact case that prompted this: staging had no Google credentials and
    // the form could only say "fill it in by hand", which is true but useless.
    api.apiPreviewTranslation.mockResolvedValue({
      translations: {},
      failed: ["en", "am"],
      reason: "not_configured",
    });

    render(<Harness />);
    await typePrimary("Магазин");
    await settle();

    expect(screen.getByText("multilang.reason.not_configured")).toBeTruthy();
  });

  test("the reason is shown once, not once per language", async () => {
    api.apiPreviewTranslation.mockResolvedValue({
      translations: {},
      failed: ["en", "am"],
      reason: "quota",
    });

    render(<Harness />);
    await typePrimary("Магазин");
    await settle();

    // Two languages failed for one reason — saying it twice reads as two
    // separate problems.
    expect(screen.getAllByText("multilang.reason.quota")).toHaveLength(1);
  });

  test("a single rejected language is NOT reported as an outage", async () => {
    api.apiPreviewTranslation.mockResolvedValue({
      translations: { en: "Coke" },
      failed: ["am"],
      reason: null,
    });

    render(<Harness />);
    await typePrimary("Кола");
    await settle();

    // Sending an operator to check the API key over one awkward word is the
    // wrong path entirely.
    expect(screen.queryByText(/multilang\.reason\./)).toBeNull();
    expect(screen.getByText("multilang.failed")).toBeTruthy();
  });

  test("a provider outage leaves the field usable", async () => {
    api.apiPreviewTranslation.mockRejectedValue(new Error("network down"));

    render(<Harness />);
    await typePrimary("Кола");
    await settle();

    expect(dump().ru).toBe("Кола");
    // …and the user can still type the others by hand.
    await act(async () => { fireEvent.change(boxes()[1], { target: { value: "Coke" } }); });
    expect(dump().en).toBe("Coke");
  });
});

describe("manual edits win", () => {
  test("a hand-edited language is not overwritten by later auto-translation", async () => {
    api.apiPreviewTranslation.mockResolvedValue({
      translations: { en: "Coke", am: "Կոլա" },
      failed: [],
    });

    render(<Harness />);
    await typePrimary("Кола");
    await settle();

    // The user corrects the English by hand…
    await act(async () => { fireEvent.change(boxes()[1], { target: { value: "Coca-Cola" } }); });

    api.apiPreviewTranslation.mockResolvedValue({
      translations: { en: "Coke Zero", am: "Կոլա Զերո" },
      failed: [],
    });

    // …then keeps editing the source. Destroying their correction here is the
    // one behaviour users never forgive.
    await typePrimary("Кола Зеро");
    await settle();

    expect(dump().en).toBe("Coca-Cola");
    expect(dump().am).toBe("Կոլա Զերո");
  });

  test("only the requested languages are asked for once one is pinned", async () => {
    render(<Harness />);
    await typePrimary("Кола");
    await settle();

    await act(async () => { fireEvent.change(boxes()[1], { target: { value: "Coca-Cola" } }); });
    api.apiPreviewTranslation.mockClear();

    await typePrimary("Кола Зеро");
    await settle();

    const body = api.apiPreviewTranslation.mock.calls[0][0] as { targets: Lang[] };
    expect(body.targets).toEqual(["am"]);
  });

  test("the pin can be released, which re-translates that language", async () => {
    api.apiPreviewTranslation.mockResolvedValue({
      translations: { en: "Coke", am: "Կոլա" },
      failed: [],
    });

    render(<Harness />);
    await typePrimary("Кола");
    await settle();
    await act(async () => { fireEvent.change(boxes()[1], { target: { value: "typo" } }); });

    // A lock the user cannot undo is a trap, so it is a visible control.
    await act(async () => { fireEvent.click(screen.getByRole("button")); });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    expect(dump().en).toBe("Coke");
  });

  test("editing one language changes nothing else", async () => {
    render(<Harness initial={{ ru: "Кола", en: "Coke", am: "Կոլա" }} />);

    await act(async () => { fireEvent.change(boxes()[2], { target: { value: "Կոկա" } }); });

    expect(dump()).toEqual({ ru: "Кола", en: "Coke", am: "Կոկա" });
  });
});
