// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import SupportComposer, { SUPPORT_BODY_MAX, growToContent } from "./SupportComposer";

/**
 * The composer was a one-line `<input>` the width of what the buttons left
 * over: a long message about a problem could not be read back before sending.
 * It is a textarea now. What must not change with it: Enter still sends (it
 * did before), the server's 4000-character limit is still the limit, and
 * attachments still go through the same chips.
 */

vi.mock("@/i18n/LanguageContext", () => ({
  useLang: () => ({ t: (k: string) => k, lang: "ru" }),
}));

afterEach(cleanup);

const setup = (over: Partial<Parameters<typeof SupportComposer>[0]> = {}) => {
  const props = {
    value: "",
    onChange: vi.fn(),
    onSubmit: vi.fn(),
    checked: [],
    attachmentsInvalid: false,
    onAddFiles: vi.fn(),
    onRemoveFile: vi.fn(),
    problemText: () => "",
    fileInputRef: createRef<HTMLInputElement>(),
    ...over,
  };
  render(<SupportComposer {...props} />);
  return props;
};

describe("SupportComposer", () => {
  test("the message field is a multi-line textarea", () => {
    setup();
    const field = screen.getByPlaceholderText("support.placeholder");
    expect(field.tagName).toBe("TEXTAREA");
  });

  test("Enter sends; Shift+Enter is a new line, not a send", () => {
    const props = setup({ value: "hello" });
    const field = screen.getByPlaceholderText("support.placeholder");

    fireEvent.keyDown(field, { key: "Enter", shiftKey: true });
    expect(props.onSubmit).not.toHaveBeenCalled();

    fireEvent.keyDown(field, { key: "Enter" });
    expect(props.onSubmit).toHaveBeenCalledTimes(1);
  });

  test("Enter while an input method is composing does not send", () => {
    const props = setup({ value: "hello" });
    const field = screen.getByPlaceholderText("support.placeholder");
    fireEvent.keyDown(field, { key: "Enter", isComposing: true });
    expect(props.onSubmit).not.toHaveBeenCalled();
  });

  test("the limit is the server's 4000 characters", () => {
    expect(SUPPORT_BODY_MAX).toBe(4000);
    setup();
    const field = screen.getByPlaceholderText("support.placeholder") as HTMLTextAreaElement;
    expect(field.maxLength).toBe(4000);
  });

  test("the counter appears only near the limit", () => {
    setup({ value: "a".repeat(100) });
    expect(screen.queryByText(/\/ 4000/)).toBeNull();
    cleanup();
    setup({ value: "a".repeat(3700) });
    expect(screen.getByText("3700 / 4000")).toBeTruthy();
  });

  test("Send is disabled with nothing to send and with a refused attachment", () => {
    setup();
    expect((screen.getByText("support.send").closest("button") as HTMLButtonElement).disabled).toBe(true);
    cleanup();
    setup({ value: "x", attachmentsInvalid: true });
    expect((screen.getByText("support.send").closest("button") as HTMLButtonElement).disabled).toBe(true);
    cleanup();
    setup({ value: "x" });
    expect((screen.getByText("support.send").closest("button") as HTMLButtonElement).disabled).toBe(false);
  });

  test("growToContent sizes the field to its content", () => {
    const el = document.createElement("textarea");
    Object.defineProperty(el, "scrollHeight", { configurable: true, value: 180 });
    el.style.height = "40px";
    growToContent(el);
    expect(el.style.height).toBe("180px");
  });
});
