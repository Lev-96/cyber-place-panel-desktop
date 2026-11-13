/**
 * Test support for `useSortableList` (jsdom only; never imported by the app).
 *
 * jsdom has no layout and no PointerEvent. `installSortableTestEnv` lays rows
 * out top to bottom (`ROW` px high, `GAP` px apart, by their place among their
 * siblings, plus any `translate` written on them, as a browser would report)
 * and gives `window` a PointerEvent: a MouseEvent with the pointer fields
 * React reads. It returns the function that puts both back.
 */
export const ROW = 40;
export const GAP = 10;

/** The vertical centre of the row at `index` among its siblings. */
export const rowCentre = (index: number): number => index * (ROW + GAP) + ROW / 2;

export const installSortableTestEnv = (isRow: (el: HTMLElement) => boolean): (() => void) => {
  const realRect = HTMLElement.prototype.getBoundingClientRect;
  const realPointer = Object.getOwnPropertyDescriptor(window, "PointerEvent");
  if (typeof window.PointerEvent === "undefined") {
    class PointerEventStub extends MouseEvent {
      readonly pointerId: number;
      readonly isPrimary: boolean;
      readonly pointerType: string;
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 1;
        this.isPrimary = init.isPrimary ?? true;
        this.pointerType = init.pointerType ?? "mouse";
      }
    }
    Object.defineProperty(window, "PointerEvent", { configurable: true, writable: true, value: PointerEventStub });
  }
  HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
    if (isRow(this)) {
      const at = Array.from(this.parentElement?.children ?? []).indexOf(this);
      const shift = Number.parseFloat(this.style.translate.split(" ")[1] ?? "0") || 0;
      return new DOMRect(0, at * (ROW + GAP) + shift, 300, ROW);
    }
    if (this.parentElement && Array.from(this.children).some((c) => c instanceof HTMLElement && isRow(c))) {
      return new DOMRect(0, 0, 300, this.children.length * (ROW + GAP));
    }
    return realRect.call(this);
  };
  return () => {
    HTMLElement.prototype.getBoundingClientRect = realRect;
    if (realPointer) Object.defineProperty(window, "PointerEvent", realPointer);
    else Reflect.deleteProperty(window, "PointerEvent");
  };
};
