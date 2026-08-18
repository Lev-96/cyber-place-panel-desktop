// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Toaster from "./Toaster";
import { notify } from "@/ui/notify";
import { TRANSLATIONS } from "@/i18n/translations";

/**
 * A red toast used to carry the success sentence. Creating a place that the
 * server rejected produced a red box reading "New place created" — the colour
 * said one thing, the words said the opposite, and the words are what people
 * read. Both outcomes resolved from the same key; only the styling differed.
 *
 * These tests hold the two apart, in every language the panel ships.
 */

const LANGS = ["en", "ru", "am"] as const;

// The Toaster resolves through `useLang().t`. Standing a whole
// LanguageProvider up would drag in storage and config for no gain — what
// these tests are about is WHICH key the component asks for, so the stand-in
// answers from the real dictionary in whichever language the test picked.
const lang = vi.hoisted(() => ({ current: "en" as (typeof LANGS)[number] }));
vi.mock("@/i18n/LanguageContext", async () => {
  const { TRANSLATIONS: dict } = await import("@/i18n/translations");
  return {
    useLang: () => ({
      t: (key: string) => dict[key]?.[lang.current] ?? key,
    }),
  };
});

const renderToaster = (which: (typeof LANGS)[number] = "ru") => {
  lang.current = which;
  return render(<Toaster />);
};

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("Toaster", () => {
  it("shows the entity's own sentence when the mutation succeeded", () => {
    renderToaster("en");
    act(() => notify.success("place", "created"));

    expect(screen.getByText(TRANSLATIONS["toast.place.created"].en)).toBeTruthy();
  });

  it("never shows a success sentence on a failure", () => {
    renderToaster("en");
    act(() => notify.error("place", "created"));

    expect(screen.queryByText(TRANSLATIONS["toast.place.created"].en)).toBeNull();
    expect(screen.getByText(TRANSLATIONS["toast.fail.created"].en)).toBeTruthy();
  });

  it("says what failed for every action that has a failure sentence", () => {
    renderToaster("en");

    for (const action of ["created", "updated", "saved", "deleted", "blocked", "unblocked"]) {
      act(() => notify.error("place", action));
      expect(
        screen.getByText(TRANSLATIONS[`toast.fail.${action}`].en),
        `error toast for '${action}' must say it failed`,
      ).toBeTruthy();
      cleanup();
      renderToaster("en");
    }
  });

  it("falls back to a generic failure for an action with no sentence of its own", () => {
    renderToaster("en");
    act(() => notify.error("place", "teleported"));

    expect(screen.getByText(TRANSLATIONS["toast.generic.error"].en)).toBeTruthy();
  });

  it("speaks all three languages on both outcomes", () => {
    for (const lang of LANGS) {
      renderToaster(lang);

      act(() => notify.success("place", "created"));
      expect(screen.getByText(TRANSLATIONS["toast.place.created"][lang])).toBeTruthy();
      cleanup();

      renderToaster(lang);
      act(() => notify.error("place", "created"));
      expect(screen.getByText(TRANSLATIONS["toast.fail.created"][lang])).toBeTruthy();
      cleanup();
    }
  });

  it("shows a raw-text toast exactly as given", () => {
    // The former alert() path — callers pass an already-translated sentence.
    renderToaster("ru");
    act(() => notify.message("error", "Место с таким номером уже есть"));

    expect(screen.getByText("Место с таким номером уже есть")).toBeTruthy();
  });
});
