import Button from "@/components/ui/Button";
import NavIcon from "@/components/ui/NavIcon";
import Switch from "@/components/ui/Switch";
import { REQUIRED_MENU_IDS, iconIdOf, isAddedEntry, type NavItem } from "@/components/sidebarNav";
import { useLang } from "@/i18n/LanguageContext";
import type { SidebarEntry } from "@/preferences/uiPreferences";

/**
 * The person's side menu: order and which entries show (2026-10-27).
 *
 * Lists exactly the entries the role's menu has — the same function builds
 * both — so it can only rearrange what the person may already open. Home is
 * fixed at the top; the entries the person must always reach say so and
 * cannot be hidden. Up / down buttons rather than drag, so it works from the
 * keyboard and on a touch screen.
 */
interface Props {
  /** The role's entries in their current order (home first). */
  items: NavItem[];
  arrangement: SidebarEntry[];
  onChange: (next: SidebarEntry[]) => void;
}

/** Every entry in display order, with its hidden flag, as an arrangement. */
export const arrangementOf = (items: NavItem[], arrangement: SidebarEntry[]): SidebarEntry[] => {
  const hidden = new Set(arrangement.filter((e) => e.hidden).map((e) => e.id));
  return items.map((i) => ({ id: i.id, hidden: hidden.has(i.id) && !REQUIRED_MENU_IDS.has(i.id) }));
};

const MenuEditor = ({ items, arrangement, onChange }: Props) => {
  const { t } = useLang();
  const [home, ...rest] = items;
  const rows = arrangementOf(rest, arrangement);
  const label = new Map(items.map((i) => [i.id, i.label]));

  const move = (index: number, by: -1 | 1) => {
    const next = [...rows];
    const [moved] = next.splice(index, 1);
    next.splice(index + by, 0, moved);
    onChange(next);
  };
  const toggle = (index: number) => onChange(rows.map((r, i) => (i === index ? { ...r, hidden: !r.hidden } : r)));
  // An entry the person added (2026-11-03) is removed, not hidden: gone from
  // the arrangement, so it can be added again (for another branch) later.
  const remove = (index: number) => onChange(rows.filter((_, i) => i !== index));

  return (
    <ol className="menu-editor" data-testid="menu-editor">
      {home && (
        <li className="menu-editor__row is-fixed">
          <NavIcon id={home.id} />
          <span className="menu-editor__name">{home.label}</span>
          <span className="muted menu-editor__note">{t("appearance.menu.home")}</span>
        </li>
      )}
      {rows.map((r, i) => {
        const required = REQUIRED_MENU_IDS.has(r.id);
        const added = isAddedEntry(r.id);
        const name = label.get(r.id) ?? r.id;
        return (
          <li key={r.id} className={`menu-editor__row${r.hidden ? " is-hidden" : ""}`} data-testid={`menu-row-${r.id}`}>
            <NavIcon id={iconIdOf(r.id)} />
            <span className="menu-editor__name">{name}</span>
            {required && <span className="muted menu-editor__note">{t("appearance.menu.required")}</span>}
            {added && <span className="muted menu-editor__note">{t("appearance.menu.added")}</span>}
            <span className="menu-editor__controls">
              <Button type="button" variant="secondary" disabled={i === 0} onClick={() => move(i, -1)}
                aria-label={`${t("appearance.menu.up")}: ${name}`} title={t("appearance.menu.up")}>↑</Button>
              <Button type="button" variant="secondary" disabled={i === rows.length - 1} onClick={() => move(i, 1)}
                aria-label={`${t("appearance.menu.down")}: ${name}`} title={t("appearance.menu.down")}>↓</Button>
              {/* One switch for every row (2026-11-03): an entry the role always has
                  is hidden or shown; a shortcut the person added is removed when
                  switched off (it is offered again under the branch's sections). */}
              <Switch
                size="md"
                checked={!r.hidden}
                disabled={required}
                onChange={() => (added ? remove(i) : toggle(i))}
                ariaLabel={`${t("appearance.menu.show")}: ${name}`}
                testId={`menu-show-${r.id}`}
              />
            </span>
          </li>
        );
      })}
    </ol>
  );
};

export default MenuEditor;
