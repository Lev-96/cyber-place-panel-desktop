// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import Modal, { MODAL_LEAVE_MS } from "./Modal";

/**
 * One way to close (2026-09-24): the ×, a backdrop click and Escape all ask
 * the same question — "anything typed here?" — and a dialog holding changes
 * asks «Вы действительно хотите выйти?» before throwing them away. Leaving is
 * animated. A confirmation opened over a dialog closes ALONE.
 *
 * Labels come from the active language (English in tests): the question is
 * "Are you sure you want to leave?", answered "Yes" / "No".
 */
afterEach(() => cleanup());

const afterLeave = () => act(async () => { await new Promise<void>((r) => setTimeout(r, MODAL_LEAVE_MS + 30)); });
const QUESTION = "Are you sure you want to leave?";
const closeButton = () => document.querySelector(".cp-modal-close") as HTMLButtonElement;
const escape = () => act(async () => { window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })); });
const backdropClick = (el?: Element) => {
  const wrapper = (el ?? document.querySelector(".cp-modal-wrapper")) as HTMLElement;
  fireEvent.mouseDown(wrapper, { target: wrapper });
  fireEvent.mouseUp(wrapper, { target: wrapper });
};
/** A person typing: a key press (which takes the baseline) and then the change. */
const typeInto = (input: HTMLInputElement, value: string) => {
  fireEvent.keyDown(input, { key: "a" });
  fireEvent.change(input, { target: { value } });
};

/** A form whose field state lives in React, as every form here does. */
const Form = ({ onClose, initial = "" }: { onClose: () => void; initial?: string }) => {
  const [name, setName] = useState(initial);
  return (
    <Modal open onClose={onClose}>
      <div className="card">
        <input data-testid="name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
    </Modal>
  );
};

describe("a clean dialog closes at once", () => {
  test.each([
    ["the ×", () => { fireEvent.click(closeButton()); }],
    ["a backdrop click", () => backdropClick()],
    ["Escape", () => escape()],
  ])("%s", async (_label, close) => {
    const onClose = vi.fn();
    render(<Form onClose={onClose} />);

    await close();
    await afterLeave();

    expect(screen.queryByText(QUESTION)).toBeNull();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("the × is labelled for a screen reader and the dialog says what it is", () => {
    render(<Form onClose={vi.fn()} />);

    expect(closeButton().getAttribute("aria-label")).toBe("Close");
    const dialog = document.querySelector(".cp-modal-dialog")!;
    expect(dialog.getAttribute("role")).toBe("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
  });

  test("a dialog that cannot be closed has no ×", () => {
    render(<Modal open><div className="card">update ready</div></Modal>);

    expect(closeButton()).toBeNull();
  });
});

describe("a dialog with changes asks first", () => {
  test.each([
    ["the ×", () => { fireEvent.click(closeButton()); }],
    ["a backdrop click", () => backdropClick()],
    ["Escape", () => escape()],
  ])("%s asks, and No keeps the dialog and what was typed", async (_label, close) => {
    const onClose = vi.fn();
    render(<Form onClose={onClose} />);
    typeInto(screen.getByTestId("name") as HTMLInputElement, "PS5 room");

    await close();
    expect(screen.getByText(QUESTION)).toBeTruthy();

    fireEvent.click(screen.getByText("No"));
    await afterLeave();

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByText(QUESTION)).toBeNull();
    expect((screen.getByTestId("name") as HTMLInputElement).value).toBe("PS5 room");
  });

  test("Yes closes it — and only then", async () => {
    const onClose = vi.fn();
    render(<Form onClose={onClose} />);
    typeInto(screen.getByTestId("name") as HTMLInputElement, "PS5 room");

    fireEvent.click(closeButton());
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("Yes"));
    await afterLeave();

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("an edit put back the way it was is clean again", async () => {
    const onClose = vi.fn();
    render(<Form onClose={onClose} initial="500" />);
    const input = screen.getByTestId("name") as HTMLInputElement;

    typeInto(input, "700");
    typeInto(input, "500");
    fireEvent.click(closeButton());
    await afterLeave();

    expect(screen.queryByText(QUESTION)).toBeNull();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("a value the form loaded after opening is not a change", async () => {
    const onClose = vi.fn();
    const Late = () => {
      const [v, setV] = useState("");
      return (
        <Modal open onClose={onClose}>
          <input data-testid="late" value={v} onChange={(e) => setV(e.target.value)} />
          <button data-testid="load" onClick={() => setV("loaded")}>load</button>
        </Modal>
      );
    };
    render(<Late />);
    // The data arrives before the person touches anything.
    act(() => { (screen.getByTestId("load") as HTMLButtonElement).click(); });

    fireEvent.click(closeButton());
    await afterLeave();

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("the question closes alone on Escape — the form and its text stay", async () => {
    const onClose = vi.fn();
    render(<Form onClose={onClose} />);
    typeInto(screen.getByTestId("name") as HTMLInputElement, "PS5 room");

    fireEvent.click(closeButton());
    await escape();
    await afterLeave();

    expect(screen.queryByText(QUESTION)).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    expect((screen.getByTestId("name") as HTMLInputElement).value).toBe("PS5 room");
  });

  test("a click on the question's backdrop closes the question, not the form", async () => {
    const onClose = vi.fn();
    render(<Form onClose={onClose} />);
    typeInto(screen.getByTestId("name") as HTMLInputElement, "PS5 room");

    fireEvent.click(closeButton());
    backdropClick(screen.getByText(QUESTION).closest(".cp-modal-wrapper")!);
    await afterLeave();

    expect(screen.queryByText(QUESTION)).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });

  test("an explicit `dirty` wins over the fields, and confirmOnDirty={false} never asks", async () => {
    const onA = vi.fn();
    const { unmount } = render(<Modal open onClose={onA} dirty><div className="card">x</div></Modal>);
    fireEvent.click(closeButton());
    expect(screen.getByText(QUESTION)).toBeTruthy();
    unmount();

    const onB = vi.fn();
    render(<Modal open onClose={onB} dirty confirmOnDirty={false}><div className="card">x</div></Modal>);
    fireEvent.click(closeButton());
    await afterLeave();
    expect(onB).toHaveBeenCalledTimes(1);
  });
});

describe("stacked dialogs", () => {
  const Parent = ({ onParent, onChild }: { onParent: () => void; onChild: () => void }) => (
    <Modal open onClose={onParent}>
      <div className="card">parent</div>
      <Modal open onClose={onChild}>
        <div className="card">child</div>
      </Modal>
    </Modal>
  );

  test("Escape closes only the one on top", async () => {
    const onParent = vi.fn();
    const onChild = vi.fn();
    render(<Parent onParent={onParent} onChild={onChild} />);

    await escape();
    await afterLeave();

    expect(onChild).toHaveBeenCalledTimes(1);
    expect(onParent).not.toHaveBeenCalled();
  });

  test("a click on the child's backdrop does not close the parent", async () => {
    const onParent = vi.fn();
    const onChild = vi.fn();
    render(<Parent onParent={onParent} onChild={onChild} />);

    // The child's own backdrop, found by what it holds — portal order in the
    // DOM is React's business, not something to index into.
    backdropClick(screen.getByText("child").closest(".cp-modal-wrapper")!);
    await afterLeave();

    expect(onChild).toHaveBeenCalledTimes(1);
    expect(onParent).not.toHaveBeenCalled();
  });

  test("an Escape a field inside has used (a suggestion list) does not close the dialog", async () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose}>
        <input data-testid="q" onKeyDown={(e) => { if (e.key === "Escape") e.preventDefault(); }} />
      </Modal>,
    );
    const q = screen.getByTestId("q");
    q.focus();

    await act(async () => { fireEvent.keyDown(q, { key: "Escape" }); });
    await afterLeave();

    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("leaving is animated and happens once", () => {
  test("the dialog stays through the exit with the leaving class, then goes", async () => {
    const Host = () => {
      const [open, setOpen] = useState(true);
      return open ? <Modal open onClose={() => setOpen(false)}><div className="card">x</div></Modal> : null;
    };
    render(<Host />);

    fireEvent.click(closeButton());
    expect(document.querySelector(".cp-modal.cp-modal-leaving")).toBeTruthy();

    await afterLeave();
    expect(document.querySelector(".cp-modal")).toBeNull();
  });

  test("a parent closing it with open={false} gets the same exit", async () => {
    const { rerender } = render(<Modal open onClose={vi.fn()}><div className="card">x</div></Modal>);

    rerender(<Modal open={false} onClose={vi.fn()}><div className="card">x</div></Modal>);
    expect(document.querySelector(".cp-modal.cp-modal-leaving")).toBeTruthy();

    await afterLeave();
    expect(document.querySelector(".cp-modal")).toBeNull();
  });

  test("a quick second click, backdrop or Escape does not close it twice", async () => {
    const onClose = vi.fn();
    render(<Form onClose={onClose} />);

    fireEvent.click(closeButton());
    fireEvent.click(closeButton());
    backdropClick();
    await escape();
    await afterLeave();

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("a second press mid-exit neither restarts nor delays it", async () => {
    const onClose = vi.fn();
    render(<Form onClose={onClose} />);

    fireEvent.click(closeButton());
    await act(async () => { await new Promise<void>((r) => setTimeout(r, MODAL_LEAVE_MS / 2)); });
    fireEvent.click(closeButton());
    // On time for the FIRST press — a restarted exit would still be running.
    await act(async () => { await new Promise<void>((r) => setTimeout(r, MODAL_LEAVE_MS / 2 + 30)); });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("a close the parent refuses (a save in flight) leaves the dialog visible", async () => {
    render(<Modal open onClose={() => {}}><div className="card">saving</div></Modal>);

    fireEvent.click(closeButton());
    await afterLeave();

    expect(document.querySelector(".cp-modal")).toBeTruthy();
    expect(document.querySelector(".cp-modal-leaving")).toBeNull();
  });

  test("reopening mid-exit shows it again", async () => {
    const { rerender } = render(<Modal open onClose={vi.fn()}><div className="card">x</div></Modal>);
    rerender(<Modal open={false} onClose={vi.fn()}><div className="card">x</div></Modal>);
    rerender(<Modal open onClose={vi.fn()}><div className="card">x</div></Modal>);
    await afterLeave();

    expect(document.querySelector(".cp-modal")).toBeTruthy();
    expect(document.querySelector(".cp-modal-leaving")).toBeNull();
  });

  test("an unmounted dialog no longer listens and releases the scroll lock", async () => {
    const onClose = vi.fn();
    const { unmount } = render(<Modal open onClose={onClose}><div className="card">x</div></Modal>);
    expect(document.body.classList.contains("cp-modal-open")).toBe(true);

    unmount();
    await escape();
    await afterLeave();

    expect(onClose).not.toHaveBeenCalled();
    expect(document.body.classList.contains("cp-modal-open")).toBe(false);
  });
});
