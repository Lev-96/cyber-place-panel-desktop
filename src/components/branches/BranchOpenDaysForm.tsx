import Button from "@/components/ui/Button";
import LineIcon from "@/components/ui/LineIcon";
import Modal from "@/components/ui/Modal";
import { useLang } from "@/i18n/LanguageContext";
import { LocalizedText, renderText, textKey, textLiteral } from "@/i18n/localizedText";
import { branchRepository } from "@/repositories/BranchRepository";
import { IBranchApi } from "@/types/api";
import { notify } from "@/ui/notify";
import { HHMM_RE } from "@/utils/clockTime";
import { FormEvent, useRef, useState } from "react";
import OpenDayRow from "./OpenDayRow";
import {
  applyToOpenDays,
  DayRow,
  FieldRef,
  payloadOf,
  readableSaveError,
  refusedFields,
  rowsFromBranch,
  summaryOf,
} from "./openDaysModel";

interface Props {
  branch: IBranchApi;
  onClose: () => void;
  onSaved: () => void;
}

/** The open days' time fields that are not a complete "HH:MM". */
const incompleteFields = (rows: ReadonlyArray<DayRow>): Set<FieldRef> => {
  const out = new Set<FieldRef>();
  for (const r of rows) {
    if (!r.open) continue;
    if (!HHMM_RE.test(r.start_time)) out.add(`${r.day_of_week}:start`);
    if (!HHMM_RE.test(r.end_time)) out.add(`${r.day_of_week}:end`);
  }
  return out;
};

/**
 * Branch → Working hours (redesigned 2026-11-13).
 *
 * One row per weekday, a live one-line summary over them, per-day
 * «apply to all» as the only shortcuts. The rules (what the server takes,
 * overnight hours, the server's refusals in words) live in `openDaysModel`.
 * Payload and endpoint are unchanged: `updateOpenDays(branch.id, [...])`.
 */
const BranchOpenDaysForm = ({ branch, onClose, onSaved }: Props) => {
  const { t } = useLang();
  const [rows, setRows] = useState<DayRow[]>(() => rowsFromBranch(branch.days_of_weeks));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<LocalizedText | null>(null);
  // Fields to mark: incomplete at the last save attempt, or named by the server.
  const [marked, setMarked] = useState<Set<FieldRef>>(() => new Set());
  const listRef = useRef<HTMLUListElement>(null);

  /** `day` = the one weekday edited: only its own marks clear. Without it (a shortcut) all do. */
  const update = (next: DayRow[], day?: number) => {
    setRows(next);
    setErr(null);
    setMarked((prev) => (day === undefined ? new Set() : new Set([...prev].filter((ref) => !ref.startsWith(`${day}:`)))));
  };

  const focusFirstMarked = () => {
    requestAnimationFrame(() => listRef.current?.querySelector<HTMLInputElement>('input[aria-invalid="true"]')?.focus());
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const payload = payloadOf(rows);
    // The backend refuses an empty week (`min:1`); say so instead of sending it.
    if (payload.length === 0) {
      setErr(textKey("openDays.errors.noDays"));
      return;
    }
    const incomplete = incompleteFields(rows);
    if (incomplete.size > 0) {
      setMarked(incomplete);
      setErr(textKey("openDays.errors.time"));
      focusFirstMarked();
      return;
    }
    setBusy(true);
    setErr(null);
    setMarked(new Set());
    try {
      await branchRepository.updateOpenDays(branch.id, payload);
      // The dialog closes on save; the toast is what says it worked (owner,
      // 2026-11-14). Only here: a guard above or a refusal below says its own.
      notify.success("openDays", "saved");
      onSaved();
    } catch (failure) {
      const sentence = readableSaveError(failure, payload, t);
      setErr(sentence ? textLiteral(sentence) : textKey("form.errors.failedSave"));
      setMarked(refusedFields(failure, payload));
      focusFirstMarked();
    } finally {
      setBusy(false);
    }
  };

  const allClosed = rows.every((r) => !r.open);

  return (
    // A close asked for mid-save is refused; Modal brings the dialog back.
    <Modal open onClose={() => { if (!busy) onClose(); }}>
      <form className="card open-days" onSubmit={submit} noValidate aria-labelledby="open-days-title">
        <header className="open-days__head">
          <h2 id="open-days-title" className="open-days__title">{t("branch.editTabs.hours")}</h2>
          <p className="open-days__address">{branch.address}</p>
        </header>

        <div className="open-days__bar">
          <p className="open-days__summary" data-state={allClosed ? "closed" : undefined} role="status">
            <LineIcon size={16}>
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </LineIcon>
            <span data-testid="open-days-summary">{summaryOf(rows, t)}</span>
          </p>
        </div>

        <ul className="open-days__list" ref={listRef}>
          {rows.map((row) => (
            <OpenDayRow
              key={row.day_of_week}
              row={row}
              invalidStart={marked.has(`${row.day_of_week}:start`)}
              invalidEnd={marked.has(`${row.day_of_week}:end`)}
              disabled={busy}
              onChange={(next) => update(rows.map((r) => (r.day_of_week === next.day_of_week ? next : r)), next.day_of_week)}
              onApplyToAll={() => update(applyToOpenDays(rows, row.day_of_week))}
            />
          ))}
        </ul>

        {err && <p className="open-days__error" role="alert">{renderText(err, t)}</p>}

        <div className="open-days__actions">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>{t("action.cancel")}</Button>
          <Button type="submit" disabled={busy}>{busy ? t("company.saving") : t("action.save")}</Button>
        </div>
      </form>
    </Modal>
  );
};

export default BranchOpenDaysForm;
