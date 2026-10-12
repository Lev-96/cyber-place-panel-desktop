// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("@/i18n/LanguageContext", () => ({ useLang: () => ({ t: (k: string) => k, lang: "en" }) }));

import ImageUpload from "./ImageUpload";
import Input from "./Input";

/** The red required mark is opt-in (2026-10-12): `required` alone changes no label. */
afterEach(cleanup);

describe("RequiredMark", () => {
  test("Input draws it only with requiredMark", () => {
    const { container } = render(<><Input label="Name" requiredMark required /><Input label="Site" required /></>);
    const labels = container.querySelectorAll(".label");
    expect(labels[0].querySelector(".req-mark")?.textContent).toBe("*");
    expect(labels[1].querySelector(".req-mark")).toBeNull();
    expect(labels[1].textContent).toBe("Site");
  });

  test("ImageUpload draws it when required", () => {
    const { container } = render(<><ImageUpload label="Logo" required onChange={() => {}} /><ImageUpload label="Photo" onChange={() => {}} /></>);
    const labels = container.querySelectorAll(".label");
    expect(labels[0].querySelector(".req-mark")).toBeTruthy();
    expect(labels[1].querySelector(".req-mark")).toBeNull();
  });
});
