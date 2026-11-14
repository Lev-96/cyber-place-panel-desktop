import LineIcon from "@/components/ui/LineIcon";
import NavIcon from "@/components/ui/NavIcon";
import Switch from "@/components/ui/Switch";
import { REQUIRED_MENU_IDS, iconIdOf, isAddedEntry, type NavItem } from "@/components/sidebarNav";
import { moveIndex, useSortableList } from "@/hooks/useSortableList";
import { useLang } from "@/i18n/LanguageContext";
import { fmt } from "@/i18n/translations";
import type { SidebarEntry } from "@/preferences/uiPreferences";
import { useId } from "react";

/**
 * The person's side menu: order and which entries show (2026-10-27).
 *
 * Lists exactly the entries the role's menu has — the same function builds
 * both — so it can only rearrange what the person may already open. Home is
 * fixed at the top (no grip, never a drop target: it is not in the sortable
 * list at all); the entries the person must always reach say so and cannot be
 * hidden, but can be moved.
 *
 * Order by drag and drop (2026-11-13, owner; it replaced the ↑ / ↓ buttons):
 * grab a row by its grip and drop it anywhere, with a mouse or a finger
 * (`useSortableList`, Pointer Events; only the grip blocks scrolling, so a
 * swipe on the rest of a row still scrolls the page on a phone). The grip is
 * also the keyboard control: Space / Enter picks the row up, the arrows move
 * it, Space / Enter drops it, Escape puts it back, each step announced.
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

/** Six dots: the grip (Lucide "grip-vertical" geometry, like `NavIcon`'s). */
const GripIcon = () => (
  <LineIcon size={18}>
    <circle cx="9" cy="5" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="9" cy="19" r="1" />
    <circle cx="15" cy="5" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="15" cy="19" r="1" />
  </LineIcon>
);

const MenuEditor = ({ items, arrangement, onChange }: Props) => {
  const { t } = useLang();
  const hintId = useId();
  const [home, ...rest] = items;
  const rows = arrangementOf(rest, arrangement);
  const label = new Map(items.map((i) => [i.id, i.label]));
  const nameOf = (id: string) => label.get(id) ?? id;

  const sortable = useSortableList<HTMLOListElement, HTMLLIElement, HTMLButtonElement>({
    ids: rows.map((r) => r.id),
    onMove: (from, to) => onChange(moveIndex(rows, from, to)),
    messages: {
      pickedUp: (id, at, of) => fmt(t("appearance.menu.sort.pickedUp"), nameOf(id), at, of),
      moved: (id, at, of) => fmt(t("appearance.menu.sort.moved"), nameOf(id), at, of),
      dropped: (id, at, of) => fmt(t("appearance.menu.sort.dropped"), nameOf(id), at, of),
      cancelled: (id, at) => fmt(t("appearance.menu.sort.cancelled"), nameOf(id), at),
    },
  });

  const toggle = (index: number) => onChange(rows.map((r, i) => (i === index ? { ...r, hidden: !r.hidden } : r)));
  // An entry the person added (2026-11-03) is removed, not hidden: gone from
  // the arrangement, so it can be added again (for another branch) later.
  const remove = (index: number) => onChange(rows.filter((_, i) => i !== index));

  return (
    <>
      <ol className="menu-editor" data-testid="menu-editor" {...sortable.listProps}>
        {home && (
          <li className="menu-editor__row is-fixed">
            <span className="menu-editor__grip-space" aria-hidden="true" />
            <NavIcon id={home.id} />
            <span className="menu-editor__name">{home.label}</span>
            <span className="muted menu-editor__note">{t("appearance.menu.home")}</span>
          </li>
        )}
        {rows.map((r, i) => {
          const required = REQUIRED_MENU_IDS.has(r.id);
          const added = isAddedEntry(r.id);
          const name = nameOf(r.id);
          return (
            <li
              key={r.id}
              {...sortable.itemProps(r.id)}
              className={`menu-editor__row${r.hidden ? " is-hidden" : ""}`}
              data-testid={`menu-row-${r.id}`}
            >
              <button
                type="button"
                className="menu-editor__grip"
                {...sortable.handleProps(r.id)}
                aria-label={`${t("appearance.menu.move")}: ${name}`}
                aria-describedby={hintId}
                title={t("appearance.menu.moveTitle")}
                data-testid={`menu-grip-${r.id}`}
              >
                <GripIcon />
              </button>
              <NavIcon id={iconIdOf(r.id)} />
              <span className="menu-editor__name">{name}</span>
              {required && <span className="muted menu-editor__note">{t("appearance.menu.required")}</span>}
              {added && <span className="muted menu-editor__note">{t("appearance.menu.added")}</span>}
              <span className="menu-editor__controls">
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
      <span id={hintId} className="sec-sr-only">{t("appearance.menu.moveKeys")}</span>
      <span className="sec-sr-only" role="status" aria-live="assertive" data-testid="menu-editor-live">
        {sortable.announcement}
      </span>
    </>
  );
};

export default MenuEditor;
