import Button from "@/components/ui/Button";
import NavIcon from "@/components/ui/NavIcon";
import { REQUIRED_MENU_IDS, type NavItem } from "@/components/sidebarNav";
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
        const name = label.get(r.id) ?? r.id;
        return (
          <li key={r.id} className={`menu-editor__row${r.hidden ? " is-hidden" : ""}`} data-testid={`menu-row-${r.id}`}>
            <NavIcon id={r.id} />
            <span className="menu-editor__name">{name}</span>
            {required && <span className="muted menu-editor__note">{t("appearance.menu.required")}</span>}
            <span className="menu-editor__controls">
              <Button type="button" variant="secondary" disabled={i === 0} onClick={() => move(i, -1)}
                aria-label={`${t("appearance.menu.up")}: ${name}`} title={t("appearance.menu.up")}>↑</Button>
              <Button type="button" variant="secondary" disabled={i === rows.length - 1} onClick={() => move(i, 1)}
                aria-label={`${t("appearance.menu.down")}: ${name}`} title={t("appearance.menu.down")}>↓</Button>
              <label className="menu-editor__show">
                <input type="checkbox" checked={!r.hidden} disabled={required} onChange={() => toggle(i)}
                  aria-label={`${t("appearance.menu.show")}: ${name}`} />
                {t("appearance.menu.show")}
              </label>
            </span>
          </li>
        );
      })}
    </ol>
  );
};

export default MenuEditor;
