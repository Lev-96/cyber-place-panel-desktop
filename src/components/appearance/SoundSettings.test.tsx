// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";

/**
 * «Звуки уведомлений» (2026-10-27): one choice sets the sound of every kind
 * of notification; each kind can still be set on its own, and the one choice
 * then says the sounds differ.
 */
vi.mock("@/i18n/LanguageContext", () => ({ useLang: () => ({ t: (k: string) => k }) }));
vi.mock("@/preferences/UiPreferencesContext", () => ({
  useUiPreferences: () => ({ deviceSound: { volume: 100, muted: false }, setDeviceSound: vi.fn() }),
}));
const engine = vi.hoisted(() => ({ previewSound: vi.fn(() => () => {}) }));
vi.mock("@/sound/soundEngine", () => ({
  isAudioBlocked: () => false,
  onAudioBlockedChange: () => () => {},
  previewSound: engine.previewSound,
  soundLengthMs: () => 3000,
  stopPreview: vi.fn(),
  unlockAudio: vi.fn(),
}));

import SoundSettings from "./SoundSettings";
import { SOUND_CATEGORIES, defaultSound, type SoundPrefs } from "@/preferences/uiPreferences";

let last: SoundPrefs = defaultSound();
const Host = ({ start }: { start: SoundPrefs }) => {
  const [value, setValue] = useState(start);
  return <SoundSettings value={value} onChange={(next) => { last = next; setValue(next); }} />;
};
const allSelect = () => within(screen.getByTestId("sound-all")).getByRole("combobox") as HTMLSelectElement;
const kindSelect = (c: string) => within(screen.getByTestId(`sound-row-${c}`)).getByRole("combobox") as HTMLSelectElement;

afterEach(() => { cleanup(); engine.previewSound.mockClear(); });

describe("one sound for every notification", () => {
  test("choosing it sets every kind, and only the sound — on/off stays as it was", async () => {
    const start = defaultSound();
    start.categories.guests.enabled = false;
    render(<Host start={start} />);
    await act(async () => { fireEvent.change(allSelect(), { target: { value: "space" } }); });
    for (const c of SOUND_CATEGORIES) expect(last.categories[c].sound).toBe("space");
    expect(last.categories.guests.enabled).toBe(false);
    expect(allSelect().value).toBe("space");
  });

  test("different sounds per kind read as «different», and one kind can still be changed alone", async () => {
    render(<Host start={defaultSound()} />);
    // The defaults differ per kind: the one choice says so, the list is open.
    expect(allSelect().value).toBe("");
    expect(within(screen.getByTestId("sound-all")).getByText("sound.mixed")).toBeTruthy();
    expect((screen.getByText("sound.each").closest("details") as HTMLDetailsElement).open).toBe(true);

    await act(async () => { fireEvent.change(allSelect(), { target: { value: "chord" } }); });
    await act(async () => { fireEvent.change(kindSelect("support"), { target: { value: "calm" } }); });
    expect(last.categories.support.sound).toBe("calm");
    expect(last.categories.booking_new.sound).toBe("chord");
    expect(allSelect().value).toBe("");
  });

  test("Listen plays the chosen sound for all", async () => {
    const start = defaultSound();
    for (const c of SOUND_CATEGORIES) start.categories[c].sound = "woohoo";
    render(<Host start={start} />);
    await act(async () => { fireEvent.click(within(screen.getByTestId("sound-all")).getByRole("button", { name: /sound.listen/ })); });
    expect(engine.previewSound).toHaveBeenCalledWith("woohoo", "standard", 100);
  });
});
