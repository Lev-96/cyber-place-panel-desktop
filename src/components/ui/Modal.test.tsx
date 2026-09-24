// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import Modal, { MODAL_LEAVE_MS } from "./Modal";

afterEach(() => cleanup());

const flush = () => new Promise<void>((r) => setTimeout(r, 0));
/** Past the leave animation: a close the MODAL starts reaches `onClose` then. */
const afterLeave = () => act(async () => { await new Promise<void>((r) => setTimeout(r, MODAL_LEAVE_MS + 30)); });

describe("Modal — backdrop close (mousedown→mouseup)", () => {
  test("closes when both mousedown and mouseup land on backdrop", async () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose}>
        <div data-testid="card">card</div>
      </Modal>,
    );

    const wrapper = document.querySelector(".cp-modal-wrapper") as HTMLElement;
    fireEvent.mouseDown(wrapper, { target: wrapper });
    fireEvent.mouseUp(wrapper, { target: wrapper });

    // After the leave animation, once.
    expect(onClose).not.toHaveBeenCalled();
    await afterLeave();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("does NOT close when drag-select starts on card and ends on backdrop", () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose}>
        <input data-testid="text" defaultValue="abc" />
      </Modal>,
    );

    const input = screen.getByTestId("text");
    const wrapper = document.querySelector(".cp-modal-wrapper") as HTMLElement;

    // Reproduces the Ctrl+V / drag-select-then-release-outside flow that
    // used to close the modal under the plain onClick implementation.
    fireEvent.mouseDown(input);
    fireEvent.mouseUp(wrapper, { target: wrapper });

    expect(onClose).not.toHaveBeenCalled();
  });

  test("does NOT close when mousedown is on backdrop but mouseup is on card", () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose}>
        <button data-testid="btn">btn</button>
      </Modal>,
    );

    const wrapper = document.querySelector(".cp-modal-wrapper") as HTMLElement;
    const btn = screen.getByTestId("btn");

    fireEvent.mouseDown(wrapper, { target: wrapper });
    fireEvent.mouseUp(btn);

    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("Modal — keyboard", () => {
  test("Escape calls onClose", async () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose}>
        <input />
      </Modal>,
    );
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      await flush();
    });
    await afterLeave();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("Tab from the LAST focusable wraps to the first (focus trap)", async () => {
    render(
      <Modal open onClose={vi.fn()}>
        <input data-testid="first" />
        <input data-testid="middle" />
        <button data-testid="last">last</button>
      </Modal>,
    );
    const first = screen.getByTestId("first");
    // The × is the dialog's last control — last in the DOM on purpose, so a
    // form's first field stays the first stop.
    const last = document.querySelector(".cp-modal-close") as HTMLElement;

    last.focus();
    expect(document.activeElement).toBe(last);

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab" }));
      await flush();
    });

    expect(document.activeElement).toBe(first);
  });

  test("Shift+Tab from the FIRST focusable wraps to the last", async () => {
    render(
      <Modal open onClose={vi.fn()}>
        <input data-testid="first" />
        <button data-testid="last">last</button>
      </Modal>,
    );
    const first = screen.getByTestId("first");
    const last = document.querySelector(".cp-modal-close") as HTMLElement;

    first.focus();
    expect(document.activeElement).toBe(first);

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true }));
      await flush();
    });

    expect(document.activeElement).toBe(last);
  });

  test("Tab inside the modal moves focus normally (does NOT trigger close)", async () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose}>
        <input data-testid="a" />
        <input data-testid="b" />
      </Modal>,
    );
    screen.getByTestId("a").focus();
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab" }));
      await flush();
    });
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("Modal — initial focus (Electron can't-type fix)", () => {
  test("focuses the first text field on open (buttons skipped)", async () => {
    render(
      <Modal open onClose={vi.fn()}>
        <button data-testid="tab">tab</button>
        <input data-testid="label" />
        <input data-testid="second" />
      </Modal>,
    );
    await act(async () => { await flush(); });
    expect(document.activeElement).toBe(screen.getByTestId("label"));
  });

  test("does NOT steal focus already placed inside the dialog", async () => {
    render(
      <Modal open onClose={vi.fn()}>
        <input data-testid="a" />
        <input data-testid="b" />
      </Modal>,
    );
    screen.getByTestId("b").focus();
    await act(async () => { await flush(); });
    expect(document.activeElement).toBe(screen.getByTestId("b"));
  });

  test("no fields (ConfirmDialog-style) → does not throw / focus stays out", async () => {
    render(
      <Modal open onClose={vi.fn()}>
        <button data-testid="ok">OK</button>
      </Modal>,
    );
    await act(async () => { await flush(); });
    // No text field to focus; the button is not force-focused by our effect.
    expect(document.activeElement).not.toBe(screen.getByTestId("ok"));
  });
});
