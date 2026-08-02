import { TranslationFailureReason, apiPreviewTranslation } from "@/api/translations";
import { Lang } from "@/i18n/translations";
import { useCallback, useEffect, useRef, useState } from "react";

/** A multilingual value: one independent string per language. */
export type LangValues = Record<Lang, string>;

interface Options {
  values: LangValues;
  onChange: (values: LangValues) => void;
  /** The box the user types in — always the interface language. */
  primary: Lang;
  /** The languages filled in for them. */
  secondary: Lang[];
  /** Groups identical strings in the translation memory; selects the provider. */
  fieldClass?: string;
  maxChars?: number;
  /** Transform applied to auto-filled text (e.g. the platform alphabet filter). */
  sanitize?: (locale: Lang, value: string) => string;
}

const DEBOUNCE_MS = 550;

/**
 * Auto-translation behaviour for a multilingual field.
 *
 * Extracted into a hook because two very different fields need exactly this
 * logic — the generic `MultiLangInput` and the platform-name field, which has
 * its own autocomplete and per-alphabet filtering and could not simply reuse
 * the component. Duplicating the debounce, the race guard and the lock rules
 * across both is how they would silently drift apart.
 *
 * Three behaviours worth stating, because each is a bug if absent:
 *
 *  - **Debounce.** Translating on every keystroke would bill a request per
 *    character. One call, ~half a second after typing stops.
 *  - **Race guard.** A slow response for text the user has already changed must
 *    never land in the boxes; each request carries a sequence number and only
 *    the newest may write.
 *  - **Locks.** Editing a translated box by hand pins that language. Without
 *    this, a correction someone made deliberately is destroyed by the next
 *    keystroke in the source box — the one behaviour users never forgive. The
 *    lock is releasable, so it is never a dead end.
 */
export const useAutoTranslate = ({
  values,
  onChange,
  primary,
  secondary,
  fieldClass = "default",
  maxChars = 255,
  sanitize,
}: Options) => {
  const [locked, setLocked] = useState<Partial<Record<Lang, boolean>>>({});
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<Lang[]>([]);
  // Whole-batch failure, if any — drives a specific message instead of the
  // generic "fill it in by hand".
  const [reason, setReason] = useState<TranslationFailureReason | null>(null);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);
  // Read inside the debounced callback so it always sees the newest values
  // without re-arming the timer on every keystroke.
  const latest = useRef(values);
  latest.current = values;

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const translate = useCallback(
    async (text: string, lockedNow: Partial<Record<Lang, boolean>>) => {
      const targets = secondary.filter((l) => !lockedNow[l]);
      if (!text.trim() || targets.length === 0) {
        setBusy(false);
        return;
      }

      const id = ++seq.current;
      setBusy(true);
      try {
        const res = await apiPreviewTranslation({
          text,
          source_locale: primary,
          targets,
          field_class: fieldClass,
          max_chars: maxChars,
        });

        if (id !== seq.current) return; // stale — the user kept typing

        const next = { ...latest.current };
        for (const [locale, value] of Object.entries(res.translations)) {
          const code = locale as Lang;
          if (lockedNow[code] || typeof value !== "string") continue;
          next[code] = sanitize ? sanitize(code, value) : value;
        }
        onChange(next);
        setFailed(res.failed ?? []);
        setReason(res.reason ?? null);
      } catch {
        // Never surface a hard error: the field must stay usable and the user
        // simply fills those languages by hand.
        if (id === seq.current) {
          setFailed(targets);
          // The request never reached the API — that is a transport problem,
          // which is exactly what `provider_error` means.
          setReason("provider_error");
        }
      } finally {
        if (id === seq.current) setBusy(false);
      }
    },
    [fieldClass, maxChars, onChange, primary, secondary, sanitize],
  );

  const setPrimary = useCallback(
    (text: string) => {
      onChange({ ...latest.current, [primary]: text });
      setFailed([]);
      setReason(null);

      if (timer.current) clearTimeout(timer.current);

      if (!text.trim()) {
        // Clearing the source clears the languages derived from it; leaving
        // them would strand translations of text that no longer exists.
        const cleared = { ...latest.current, [primary]: text };
        for (const l of secondary) if (!locked[l]) cleared[l] = "";
        onChange(cleared);
        setBusy(false);
        return;
      }

      const snapshot = locked;
      timer.current = setTimeout(() => void translate(text, snapshot), DEBOUNCE_MS);
    },
    [locked, onChange, primary, secondary, translate],
  );

  const setSecondary = useCallback(
    (locale: Lang, text: string) => {
      setLocked((prev) => ({ ...prev, [locale]: true }));
      setFailed((prev) => prev.filter((l) => l !== locale));
      onChange({ ...latest.current, [locale]: text });
    },
    [onChange],
  );

  const releaseLock = useCallback(
    (locale: Lang) => {
      const next = { ...locked, [locale]: false };
      setLocked(next);
      const source = (latest.current[primary] ?? "").trim();
      if (source) void translate(source, next);
    },
    [locked, primary, translate],
  );

  /** Adopting an existing record (a suggestion) replaces every language at once. */
  const adopt = useCallback(
    (next: LangValues) => {
      if (timer.current) clearTimeout(timer.current);
      seq.current++; // invalidate anything in flight
      setLocked({});
      setFailed([]);
      setReason(null);
      setBusy(false);
      onChange(next);
    },
    [onChange],
  );

  return { busy, failed, reason, locked, setPrimary, setSecondary, releaseLock, adopt };
};
