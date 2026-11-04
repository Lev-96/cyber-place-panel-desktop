import { branchSectionsFor, branchShortcutId } from "@/components/branches/branchSections";
import NavIcon from "@/components/ui/NavIcon";
import Switch from "@/components/ui/Switch";
import { useLang } from "@/i18n/LanguageContext";
import type { Role } from "@/types/api";
import { useEffect, useState } from "react";

/**
 * «Разделы филиала в меню» (2026-11-03): every section of a branch the role
 * is offered in the hub (the same list, `branchSections.ts`), each with a
 * switch that puts it in the side menu or takes it out. A manager works their
 * own branch; an owner picks which of THEIR branches (the list the server
 * gives them). The switch only edits the person's menu; nothing it shows can
 * open a section the role may not, the route guards and the server decide.
 */
export interface BranchOption {
  id: number;
  label: string;
}

interface Props {
  role: Role | undefined;
  /** The branches this person may make shortcuts for (manager: their own). */
  branches: BranchOption[];
  /** The ids of the shortcuts in the menu now (visible ones). */
  active: ReadonlySet<string>;
  /** The owner's branch list could not be read. */
  failed?: boolean;
  onToggle: (shortcutId: string, on: boolean) => void;
}

const BranchShortcuts = ({ role, branches, active, failed = false, onToggle }: Props) => {
  const { t } = useLang();
  const [picked, setPicked] = useState<number | null>(branches[0]?.id ?? null);
  // A list that arrives (or changes) after the first render picks its first.
  useEffect(() => {
    if (picked === null || !branches.some((b) => b.id === picked)) setPicked(branches[0]?.id ?? null);
  }, [branches, picked]);

  if (failed) return <p className="error appearance-note" role="alert">{t("appearance.menu.branchesFailed")}</p>;
  if (branches.length === 0 || picked === null) return null;
  const sections = branchSectionsFor(role);

  return (
    <div className="col branch-shortcuts" data-testid="branch-shortcuts">
      {branches.length > 1 && (
        <label className="col branch-shortcuts__branch">
          <span className="label">{t("appearance.menu.branch")}</span>
          <select
            className="input"
            value={picked}
            onChange={(e) => setPicked(Number(e.target.value))}
            data-testid="branch-shortcuts-branch"
          >
            {branches.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
          </select>
        </label>
      )}
      <ul className="branch-shortcuts__list">
        {sections.map((s) => {
          const id = branchShortcutId(s.key, picked);
          const on = active.has(id);
          const name = t(s.titleKey);
          return (
            <li key={s.key} className={`branch-shortcuts__row${on ? " is-on" : ""}`}>
              <NavIcon id={s.icon} />
              <span className="branch-shortcuts__name">
                <span className="branch-shortcuts__title">{name}</span>
                <span className="muted branch-shortcuts__hint">{t(s.hintKey)}</span>
              </span>
              <Switch
                size="md"
                checked={on}
                onChange={(next) => onToggle(id, next)}
                ariaLabel={`${t("appearance.menu.inMenu")}: ${name}`}
                testId={`shortcut-${s.key}`}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default BranchShortcuts;
