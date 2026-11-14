import Button from "@/components/ui/Button";
import { useLang } from "@/i18n/LanguageContext";
import { formatSize, type AttachmentProblem, type CheckedFile } from "@/support/attachmentRules";
import { useLayoutEffect, useRef, type RefObject } from "react";

/**
 * The longest message the server accepts (`SupportController`: `max:4000`).
 * Mirrored here only so the field stops where the server would refuse: the
 * backend's rule is the one that counts.
 */
export const SUPPORT_BODY_MAX = 4000;

/** The counter shows from here on: far from the limit it is noise. */
const COUNTER_FROM = Math.round(SUPPORT_BODY_MAX * 0.9);

/**
 * Size a textarea to what it holds.
 *
 * Collapsed first so a field that lost lines can shrink, then set to its
 * content plus its borders (the app is `border-box`). The CSS `max-height`
 * caps it; past that the field scrolls instead of pushing the thread away.
 */
export const growToContent = (el: HTMLTextAreaElement): void => {
  const borders = el.offsetHeight - el.clientHeight;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight + Math.max(0, borders)}px`;
};

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  checked: CheckedFile[];
  attachmentsInvalid: boolean;
  onAddFiles: (files: File[]) => void;
  onRemoveFile: (file: File) => void;
  problemText: (problem: AttachmentProblem) => string;
  /** Owned by the screen, which clears the native picker after a send. */
  fileInputRef: RefObject<HTMLInputElement | null>;
}

/**
 * Where a message to support is written.
 *
 * The text gets the whole width of the thread on a row of its own, and grows
 * with what is typed up to a cap, then scrolls: a message about a problem is
 * often several lines and has to be readable before it is sent, at the
 * 520-pixel minimum window as much as at 1920. The buttons sit under it.
 *
 * Enter sends, as it always has; Shift+Enter is a new line.
 */
const SupportComposer = ({
  value,
  onChange,
  onSubmit,
  checked,
  attachmentsInvalid,
  onAddFiles,
  onRemoveFile,
  problemText,
  fileInputRef,
}: Props) => {
  const { t } = useLang();
  const field = useRef<HTMLTextAreaElement>(null);
  const actions = useRef<HTMLDivElement>(null);

  // Before paint, so a new line never flashes a scrollbar first. While the
  // person is typing, the page follows the growing field so Send never ends
  // up below the fold of a short window.
  useLayoutEffect(() => {
    const el = field.current;
    if (!el) return;
    growToContent(el);
    if (document.activeElement === el) actions.current?.scrollIntoView?.({ block: "nearest" });
  }, [value]);

  const nothingToSend = !value.trim() && checked.length === 0;

  return (
    <div className="support-composer">
      {checked.length > 0 && (
        <div className="col" style={{ gap: 6 }}>
          {checked.map(({ file, problem }) => (
            <div
              key={`${file.name}:${file.size}:${file.lastModified}`}
              className={`support-chip${problem ? " is-bad" : ""}`}
            >
              <span className="support-chip__icon" aria-hidden>{problem ? "✕" : "📎"}</span>
              <span className="support-chip__name" title={file.name}>{file.name}</span>
              <span className="support-chip__size">{formatSize(file.size)}</span>
              {problem && <span className="support-chip__why">{problemText(problem)}</span>}
              <button
                type="button"
                aria-label={`${t("support.file.remove")}: ${file.name}`}
                onClick={() => onRemoveFile(file)}
              >
                ✕
              </button>
            </div>
          ))}
          {attachmentsInvalid && (
            <span className="cp-mli-failed" style={{ fontSize: 12 }}>
              {t("support.file.fixBeforeSending")}
            </span>
          )}
        </div>
      )}

      <textarea
        ref={field}
        className="input support-composer__field"
        rows={2}
        maxLength={SUPPORT_BODY_MAX}
        placeholder={t("support.placeholder")}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          // An input method still composing owns its Enter.
          if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
          e.preventDefault();
          onSubmit();
        }}
      />

      <div ref={actions} className="support-composer__actions">
        <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
          {t("support.attach")}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          style={{ display: "none" }}
          onChange={(e) => onAddFiles(Array.from(e.target.files ?? []))}
        />
        {value.length >= COUNTER_FROM && (
          <span className="support-composer__count" aria-live="polite">
            {value.length} / {SUPPORT_BODY_MAX}
          </span>
        )}
        <Button
          className="support-composer__send"
          onClick={onSubmit}
          // Nothing to send, or something that must not be sent.
          disabled={nothingToSend || attachmentsInvalid}
          title={attachmentsInvalid ? t("support.file.fixBeforeSending") : undefined}
        >
          {t("support.send")}
        </Button>
      </div>
    </div>
  );
};

export default SupportComposer;
