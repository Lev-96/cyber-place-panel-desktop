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

/**
 * How long typing must stop before we translate.
 *
 * Was 550ms, which turned out to be the difference between a working feature
 * and a dead one. Half a second is *inside* normal typing rhythm: "Кока-кола
 * 0.5" fired a request at almost every word, so creating three products spent
 * roughly fifteen provider requests — more than the free-tier allowance the
 * key had for the whole model. At 1.4s a pause means "I stopped", not "I am
 * thinking about the next word", and the same three products cost three
 * requests.
 *
 * The delay is not felt, because leaving the field translates immediately —
 * see `flush`.
 */
const IDLE_MS = 1400;

/**
 * Texts already translated in this session, so the same string is never paid
 * for twice.
 *
 * The server has a translation memory that does the same job durably, but it
 * is on the far side of a network round-trip and, more importantly, on the far
 * side of the provider's rate limit — a locally-known answer must not consume
 * a request slot. This covers exactly the repeats the UI generates by itself:
 * blur after the debounce already ran, editing a name back to what it was,
 * reopening a form.
 *
 * Module-level on purpose: the cache should survive a form closing and
 * reopening, which is when repeats actually happen.
 */
const CACHE_LIMIT = 400;
const cache = new Map<string, Partial<Record<Lang, string>>>();

const cacheKeyOf = (fieldClass: string, primary: Lang, targets: Lang[], text: string) =>
  `${fieldClass}|${primary}|${[...targets].sort().join(",")}|${text}`;

const writeCache = (key: string, value: Partial<Record<Lang, string>>) => {
  // Oldest out first — Map preserves insertion order, so the first key is it.
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next();
    if (!oldest.done) cache.delete(oldest.value);
  }
  cache.set(key, value);
};

/**
 * Test seam. The cache is module state and therefore outlives a test, which
 * would let one test's answer silently satisfy the next one's request.
 */
export const __clearAutoTranslateCache = () => cache.clear();

/**
 * Auto-translation behaviour for a multilingual field.
 *
 * Extracted into a hook because two very different fields need exactly this
 * logic — the generic `MultiLangInput` and the platform-name field, which has
 * its own autocomplete and per-alphabet filtering and could not simply reuse
 * the component. Duplicating the debounce, the race guard and the lock rules
 * across both is how they would silently drift apart.
 *
 * Five behaviours worth stating, because each is a bug if absent:
 *
 *  - **Debounce.** Translating on every keystroke would spend a request per
 *    character. See {@link IDLE_MS} for why the exact value matters.
 *  - **Flush on blur.** Leaving the field translates at once, so the longer
 *    debounce costs the user nothing in responsiveness.
 *  - **Session cache.** The same text is never sent twice, so a blur right
 *    after the debounce already ran is free rather than a second request.
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
  // Seconds until the automatic retry, for `quota` only. Present means the
  // field is waiting rather than broken.
  const [retryAfter, setRetryAfter] = useState<number | null>(null);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);
  // Read inside the debounced callback so it always sees the newest values
  // without re-arming the timer on every keystroke.
  const latest = useRef(values);
  latest.current = values;

  // One automatic retry per distinct text. Without the guard, a quota that
  // stays exhausted turns into an endless self-firing request loop.
  const retriedFor = useRef<string | null>(null);
  // Lets the retry timer call the newest `translate` without the callback
  // having to reference itself.
  const translateRef = useRef<((text: string, locked: Partial<Record<Lang, boolean>>) => void) | null>(null);

  const clearTimers = () => {
    if (timer.current) clearTimeout(timer.current);
    if (retryTimer.current) clearTimeout(retryTimer.current);
    timer.current = null;
    retryTimer.current = null;
  };

  useEffect(() => () => clearTimers(), []);

  /** Write a translated map into the boxes, honouring locks and the sanitiser. */
  const apply = useCallback(
    (map: Partial<Record<Lang, string>>, lockedNow: Partial<Record<Lang, boolean>>) => {
      const next = { ...latest.current };
      for (const [locale, value] of Object.entries(map)) {
        const code = locale as Lang;
        if (lockedNow[code] || typeof value !== "string") continue;
        next[code] = sanitize ? sanitize(code, value) : value;
      }
      onChange(next);
    },
    [onChange, sanitize],
  );

  const translate = useCallback(
    async (text: string, lockedNow: Partial<Record<Lang, boolean>>) => {
      const targets = secondary.filter((l) => !lockedNow[l]);
      const trimmed = text.trim();
      if (!trimmed || targets.length === 0) {
        setBusy(false);
        return;
      }

      const key = cacheKeyOf(fieldClass, primary, targets, trimmed);

      // Known locally — no request, no rate-limit slot, no waiting.
      const hit = cache.get(key);
      if (hit) {
        seq.current++; // anything in flight is now stale
        apply(hit, lockedNow);
        setFailed([]);
        setReason(null);
        setRetryAfter(null);
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

        apply(res.translations, lockedNow);
        setFailed(res.failed ?? []);
        setReason(res.reason ?? null);

        // Only cache an answer that actually covers every language asked for.
        // "No failures" is not the same as "complete" — an empty result also
        // reports no failures, and caching that would pin the field to blank
        // for this text forever, with no request left to fix it.
        const complete = targets.every((l) => (res.translations[l] ?? "") !== "");
        if (complete && (res.failed ?? []).length === 0 && !res.reason) {
          writeCache(key, res.translations);
        }

        const wait = res.reason === "quota" ? res.retry_after ?? null : null;
        setRetryAfter(wait);

        // A rate limit is not a failure, it is a wait. Retrying it ourselves is
        // the difference between "fill three boxes by hand" and a pause the
        // user may not even notice.
        if (wait !== null && retriedFor.current !== key) {
          retriedFor.current = key;
          if (retryTimer.current) clearTimeout(retryTimer.current);
          retryTimer.current = setTimeout(
            // +1s: the provider reports the wait fractionally, and coming back
            // a moment early just spends another slot on the same refusal.
            () => translateRef.current?.(text, lockedNow),
            (wait + 1) * 1000,
          );
        }
      } catch {
        // Never surface a hard error: the field must stay usable and the user
        // simply fills those languages by hand.
        if (id === seq.current) {
          setFailed(targets);
          // The request never reached the API — that is a transport problem,
          // which is exactly what `provider_error` means.
          setReason("provider_error");
          setRetryAfter(null);
        }
      } finally {
        if (id === seq.current) setBusy(false);
      }
    },
    [apply, fieldClass, maxChars, primary, secondary],
  );

  translateRef.current = (text, lockedNow) => void translate(text, lockedNow);

  const setPrimary = useCallback(
    (text: string) => {
      onChange({ ...latest.current, [primary]: text });
      setFailed([]);
      setReason(null);
      setRetryAfter(null);

      clearTimers();

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
      timer.current = setTimeout(() => void translate(text, snapshot), IDLE_MS);
    },
    [locked, onChange, primary, secondary, translate],
  );

  /**
   * Translate now — for the moment the user leaves the field.
   *
   * This is what pays for the long debounce: the wait only ever applies to
   * someone still sitting in the box. If the debounce already produced this
   * text the session cache answers it without a request.
   */
  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }

    const text = (latest.current[primary] ?? "").trim();
    if (text) void translate(text, locked);
  }, [locked, primary, translate]);

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
      clearTimers();
      seq.current++; // invalidate anything in flight
      setLocked({});
      setFailed([]);
      setReason(null);
      setRetryAfter(null);
      setBusy(false);
      onChange(next);
    },
    [onChange],
  );

  return {
    busy,
    failed,
    reason,
    retryAfter,
    locked,
    setPrimary,
    setSecondary,
    releaseLock,
    flush,
    adopt,
  };
};
