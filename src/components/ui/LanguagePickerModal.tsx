import Button from "@/components/ui/Button";
import FlagIcon from "@/components/ui/FlagIcon";
import Modal from "@/components/ui/Modal";
import { LANGUAGES, Lang, t as translate } from "@/i18n/translations";
import { KeyboardEvent, useEffect, useRef, useState } from "react";

interface Props {
  open: boolean;
  /** Pre-selected language — the current one, so "keep it" is one click. */
  initial: Lang;
  onConfirm: (lang: Lang) => void;
  /** Omitted for the blocking first-run step: there is nothing to go back to. */
  onDismiss?: () => void;
  /** Copy variant. `firstRun` welcomes; `workspace` confirms before the cabinet. */
  variant: "firstRun" | "workspace";
}

/**
 * Language chooser used by both gates in the startup flow.
 *
 * Design decisions worth keeping:
 *
 *  - **Live preview.** Titles and the confirm button re-render in the
 *    highlighted language *before* it is committed. A picker that only applies
 *    on confirm forces users to commit to a language to find out what it looks
 *    like; here they see the answer while arrowing through the list.
 *  - **Endonyms first.** "Հայերեն" is findable by someone who reads only
 *    Armenian; "Armenian" is not. The English name sits underneath for everyone
 *    else.
 *  - **Real radio semantics.** A `radiogroup` with roving tabindex, arrow-key
 *    navigation and Enter to confirm — so the first screen of the app is usable
 *    from the keyboard alone, which on a front-desk machine is common.
 *  - **No dead end.** The first-run variant cannot be dismissed (there is no
 *    app behind it yet); the workspace variant can, and dismissing simply keeps
 *    the current language.
 */
const LanguagePickerModal = ({ open, initial, onConfirm, onDismiss, variant }: Props) => {
  const [selected, setSelected] = useState<Lang>(initial);
  const optionRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Re-sync when the gate re-opens with a different current language (e.g. the
  // workspace step opening after the first-run step already changed it).
  useEffect(() => {
    if (open) setSelected(initial);
  }, [open, initial]);

  // Translate against the HIGHLIGHTED language, not the committed one — this is
  // what makes the preview live.
  const t = (key: string): string => translate(key, selected);

  const move = (delta: number) => {
    const index = LANGUAGES.findIndex((l) => l.code === selected);
    const next = LANGUAGES[(index + delta + LANGUAGES.length) % LANGUAGES.length];
    setSelected(next.code);
    optionRefs.current[next.code]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      move(1);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      move(-1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      onConfirm(selected);
    }
  };

  return (
    <Modal open={open} onClose={onDismiss} closeOnBackdrop={!!onDismiss}>
      <div className="card cp-langpick" role="dialog" aria-modal="true" aria-labelledby="cp-langpick-title">
        <div className="cp-langpick-head" data-testid={`lang-picker-${variant}`}>
          <span className="cp-langpick-eyebrow">Cyber Place</span>
          <h2 id="cp-langpick-title" className="cp-langpick-title">
            {t(variant === "firstRun" ? "lang.firstRun.title" : "lang.workspace.title")}
          </h2>
          <p className="cp-langpick-sub">
            {t(variant === "firstRun" ? "lang.firstRun.subtitle" : "lang.workspace.subtitle")}
          </p>
        </div>

        <div
          className="cp-langpick-grid"
          role="radiogroup"
          aria-label={t("lang.firstRun.title")}
          onKeyDown={onKeyDown}
        >
          {LANGUAGES.map((l) => {
            const active = l.code === selected;
            return (
              <button
                key={l.code}
                ref={(el) => { optionRefs.current[l.code] = el; }}
                type="button"
                role="radio"
                aria-checked={active}
                // Roving tabindex: one stop for the whole group, arrows move
                // within it — the behaviour a screen-reader user expects from
                // a radiogroup, and it keeps Tab moving on to the button.
                tabIndex={active ? 0 : -1}
                className={`cp-langpick-option${active ? " is-active" : ""}`}
                onClick={() => setSelected(l.code)}
                // Double-click commits: the impatient path, without making a
                // single click ambiguous.
                onDoubleClick={() => onConfirm(l.code)}
              >
                <FlagIcon lang={l.code} size={48} />
                <span className="cp-langpick-name">{l.name}</span>
                {/* For English the endonym and the English name are the same
                    word — printing it twice looks like a rendering bug. A
                    non-breaking space keeps every card exactly the same height
                    without a second layout rule. */}
                <span className="cp-langpick-latin">
                  {l.latin === l.name ? " " : l.latin}
                </span>
                <span className="cp-langpick-check" aria-hidden="true">✓</span>
              </button>
            );
          })}
        </div>

        <div className="cp-langpick-actions">
          {onDismiss && (
            <Button type="button" variant="secondary" data-testid="lang-dismiss" onClick={onDismiss}>
              {t("action.cancel")}
            </Button>
          )}
          <Button type="button" data-testid="lang-confirm" onClick={() => onConfirm(selected)} style={{ minWidth: 180 }}>
            {t("lang.continue")}
          </Button>
        </div>

        <p className="cp-langpick-foot">{t("lang.changeLaterHint")}</p>
      </div>
    </Modal>
  );
};

export default LanguagePickerModal;
