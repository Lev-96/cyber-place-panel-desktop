import { useAuth } from "@/auth/AuthContext";
import BoardSettings from "@/components/appearance/BoardSettings";
import BranchShortcuts, { type BranchOption } from "@/components/appearance/BranchShortcuts";
import PreviewDock from "@/components/appearance/PreviewDock";
import PresetPicture from "@/components/appearance/PresetPicture";
import ChoiceCards from "@/components/appearance/ChoiceCards";
import { themeChoices } from "@/components/appearance/themeChoices";
import MenuEditor, { arrangementOf } from "@/components/appearance/MenuEditor";
import { interfaceSummary } from "@/components/appearance/interfaceSummary";
import { parseBranchShortcut } from "@/components/branches/branchSections";
import { menuSpecsFor } from "@/components/Sidebar";
import {
  applyPersonalMenu, canHaveBranchShortcuts, isAddedEntry, sortedNavItems, withStaffMenu,
} from "@/components/sidebarNav";
import Button from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import ScreenWithBg from "@/components/ui/ScreenWithBg";
import SectionTabs from "@/components/ui/SectionTabs";
import SettingsSection from "@/components/ui/SettingsSection";
import Switch from "@/components/ui/Switch";
import { useAsync } from "@/hooks/useAsync";
import { useLang } from "@/i18n/LanguageContext";
import { tr } from "@/i18n/translated";
import { useUiPreferences } from "@/preferences/UiPreferencesContext";
import {
  BOARD_DEFAULTS, BUTTON_LABELS, PRESETS, effectiveBoard, effectiveLayout, hasOwnInterface, sameLook,
  type BoardGeometry, type InterfaceId, type Layout,
} from "@/preferences/uiPreferences";
import { branchRepository } from "@/repositories/BranchRepository";
import { notify } from "@/ui/notify";
import { useEffect, useMemo, useState } from "react";

/**
 * «Интерфейс и тема» (2026-10-27; regrouped 2026-11-03): the ready-made
 * interfaces and «Мой интерфейс», the theme, a preview, the Active Places
 * cards, the workspace and the side menu, in plain words. (The notification
 * sounds moved to Settings on 2026-11-09 and save on their own.)
 *
 * Every change is tried on at once — the whole panel shows it — and nothing
 * is kept until «Сохранить». «Отменить изменения» puts the saved look back;
 * leaving the screen with edits keeps them aside and the panel says so
 * (UnsavedInterfaceNotice), so nothing is lost without a word. Only display
 * changes here: permissions, data and every action stay as they are.
 */
const READY: ReadonlyArray<Exclude<InterfaceId, "custom">> = ["simple", "standard", "compact"];

const Appearance = () => {
  const { t, lang } = useLang();
  const { user } = useAuth();
  const confirm = useConfirm();
  const { prefs, draft, editDraft, discardDraft, save, preview, saveFailed } = useUiPreferences();
  const working = draft ?? prefs;
  const dirty = draft !== null && !sameLook(draft, prefs);
  const layout = effectiveLayout(working);
  const board = effectiveBoard(working);
  const [saving, setSaving] = useState(false);
  // The preview above the settings, shown unless the person hid it.
  const [previewOpen, setPreviewOpen] = useState(true);

  // Back on the screen with edits: show them again; leaving: the saved look.
  useEffect(() => {
    if (draft) preview(draft);
    return () => preview(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const role = user?.role;
  const dash = user?.dashboard;
  const myBranchId = typeof dash?.branch_id === "number" ? dash.branch_id : null;
  const myCompanyId = typeof dash?.company_id === "number" ? dash.company_id : null;
  // The role's own menu — with the shortcuts this person switched on — built
  // by the same function the side menu uses.
  const roleItems = useMemo(
    () => sortedNavItems(withStaffMenu(menuSpecsFor(role, myBranchId, myCompanyId, {}, layout.sidebar), role), t, lang),
    [role, myBranchId, myCompanyId, layout.sidebar, t, lang],
  );
  const homeOptions = useMemo(() => {
    const options = roleItems.filter((i) => !isAddedEntry(i.id)).map((i) => ({ to: i.to, label: i.label }));
    if (myBranchId !== null) options.splice(1, 0, { to: `/branches/${myBranchId}/sessions`, label: t("hub.tile.sessions") });
    return options.filter((o) => /^\/[a-z0-9/_-]{0,80}$/.test(o.to));
  }, [roleItems, myBranchId, t]);

  // The branches this person may make shortcuts for: a manager's own; an
  // owner's from the server's list for their company (read only here, only
  // for an owner). Nobody else is offered shortcuts.
  const ownerBranches = useAsync(
    () => (role === "company_owner" && myCompanyId !== null
      ? branchRepository.list({ company_id: myCompanyId })
      : Promise.resolve([])),
    [role, myCompanyId],
  );
  const branchOptions: BranchOption[] = useMemo(() => {
    if (!canHaveBranchShortcuts(role)) return [];
    if (role === "manager") return myBranchId !== null ? [{ id: myBranchId, label: t("nav.myBranch") }] : [];
    return (ownerBranches.data ?? []).map((b) => ({ id: b.id, label: [tr(b, "address", lang), b.city].filter(Boolean).join(", ") }));
  }, [role, myBranchId, ownerBranches.data, t, lang]);
  const branchLabel = useMemo(() => new Map(branchOptions.map((b) => [b.id, b.label])), [branchOptions]);

  // The editor's rows: an owner's shortcut names its branch (they may have several).
  const orderedItems = useMemo(
    () => applyPersonalMenu(roleItems, layout.sidebar.map((e) => ({ id: e.id, hidden: false })))
      .map((i) => {
        const branchId = parseBranchShortcut(i.id)?.branchId;
        const where = branchId !== undefined && role === "company_owner" ? branchLabel.get(branchId) : undefined;
        return where ? { ...i, label: `${i.label} · ${where}` } : i;
      }),
    [roleItems, layout.sidebar, role, branchLabel],
  );
  const activeShortcuts = useMemo(
    () => new Set(orderedItems.filter((i) => isAddedEntry(i.id)).map((i) => i.id)),
    [orderedItems],
  );

  // Any edit to a control switches to «Мой интерфейс», starting from what is
  // on screen (a ready-made one's layout and the standard board).
  const toCustom = (nextLayout: Layout, nextBoard: BoardGeometry) =>
    editDraft({ ...working, interface: "custom", layout: nextLayout, board: nextBoard });
  const setLayout = (patch: Partial<Layout>) => toCustom({ ...layout, ...patch }, board);
  const setBoard = (patch: Partial<BoardGeometry>) => toCustom(layout, { ...board, ...patch });
  const setInterface = (id: InterfaceId) => editDraft({ ...working, interface: id });

  // A shortcut switched on goes last in the menu as it stands; off, it leaves.
  const toggleShortcut = (id: string, on: boolean) => {
    const current = arrangementOf(orderedItems.slice(1), layout.sidebar).filter((e) => e.id !== id);
    setLayout({ sidebar: on ? [...current, { id, hidden: false }] : current });
  };

  const onSave = async () => {
    setSaving(true);
    try {
      // The sounds are saved from Settings now (2026-11-09): never overwrite
      // them with a draft that was started before they changed.
      await save({ ...working, sound: prefs.sound });
      notify.message("success", t("appearance.saved"));
    } catch {
      notify.message("error", t("appearance.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  // «Интерфейс по умолчанию»: the standard interface; «Мой интерфейс» stays
  // kept aside (it is not lost by trying the default on).
  const onDefault = () => setInterface("standard");
  // Resetting «Мой интерфейс» DOES lose the person's own settings: asked first.
  const onResetMine = async () => {
    const yes = await confirm(t("appearance.my.resetConfirm"), { confirmLabel: t("appearance.my.reset") });
    if (!yes) return;
    editDraft({ ...working, interface: "standard", layout: { ...PRESETS.standard }, board: { ...BOARD_DEFAULTS } });
  };

  // «Мой интерфейс» is a card like the ready-made ones once the person has
  // SAVED one; its words are what was saved (what choosing it brings back).
  const showMine = hasOwnInterface(prefs);
  const interfaces = [
    ...READY.map((key) => ({
      key: key as InterfaceId,
      title: t(`appearance.ui.${key}`),
      description: t(`appearance.ui.${key}Desc`),
      picture: <PresetPicture id={key} />,
    })),
    ...(showMine ? [{
      key: "custom" as InterfaceId,
      title: t("appearance.ui.custom"),
      description: interfaceSummary(prefs, t),
      picture: <PresetPicture id="custom" />,
    }] : []),
  ];
  // Every theme the model knows (one list with the first-run setup).
  const themes = themeChoices(t);

  return (
    <ScreenWithBg bg="./bg/settings.jpg" title={t("nav.appearance")}>
      <div className="appearance-page">
      <p className="muted appearance-intro">{t("appearance.intro")}</p>
      <div className="appearance-help" role="note">{t("appearance.help")}</div>

      <SettingsSection title={t("appearance.ui.title")} description={t("appearance.ui.hint")}>
        <ChoiceCards
          name="interface"
          label={t("appearance.ui.title")}
          value={working.interface}
          onChange={setInterface}
          choices={interfaces}
        />
        {showMine && (
          <div className="appearance-mine-actions">
            <Button type="button" variant="secondary" onClick={() => void onResetMine()} data-testid="my-interface-reset">
              {t("appearance.my.resetMine")}
            </Button>
          </div>
        )}
      </SettingsSection>

      <SettingsSection title={t("appearance.theme.title")} description={t("appearance.theme.hint")}>
        <ChoiceCards
          name="theme"
          label={t("appearance.theme.title")}
          value={working.theme}
          onChange={(theme) => editDraft({ ...working, theme })}
          choices={themes.map((c) => ({ ...c, picture: <span className={`theme-swatch theme-swatch--${c.key}`} /> }))}
        />
      </SettingsSection>

      <SettingsSection title={t("appearance.cards.title")} description={t("appearance.cards.hint")}>
        <PreviewDock open={previewOpen} onToggle={() => setPreviewOpen((v) => !v)} quick={layout.quick_actions} />
        <div className="appearance-grid" data-testid="appearance-cards">
          <div className="col appearance-field">
            <span className="label">{t("appearance.custom.boardView")}</span>
            <SectionTabs
              label={t("appearance.custom.boardView")}
              value={layout.board_view}
              onChange={(board_view) => setLayout({ board_view })}
              tabs={[
                { key: "grid", label: t("appearance.custom.grid") },
                { key: "list", label: t("appearance.custom.list") },
              ]}
            />
          </div>
          <div className="col appearance-field">
            <span className="label">{t("appearance.custom.cardSize")}</span>
            <SectionTabs
              label={t("appearance.custom.cardSize")}
              value={layout.card_size}
              onChange={(card_size) => setLayout({ card_size })}
              tabs={[
                { key: "l", label: t("appearance.custom.sizeL") },
                { key: "m", label: t("appearance.custom.sizeM") },
                { key: "s", label: t("appearance.custom.sizeS") },
              ]}
            />
          </div>
          <BoardSettings value={board} onChange={setBoard} />
          <div className="col appearance-field">
            <span className="label">{t("appearance.custom.actions")}</span>
            <SectionTabs
              label={t("appearance.custom.actions")}
              value={layout.quick_actions}
              onChange={(quick_actions) => setLayout({ quick_actions })}
              tabs={[
                { key: "all", label: t("appearance.custom.actionsAll") },
                { key: "primary", label: t("appearance.custom.actionsPrimary") },
              ]}
            />
          </div>
          <div className="col appearance-field">
            <span className="label">{t("appearance.labels.title")}</span>
            <SectionTabs
              label={t("appearance.labels.title")}
              value={layout.button_labels}
              onChange={(button_labels) => setLayout({ button_labels })}
              tabs={BUTTON_LABELS.map((key) => ({ key, label: t(`appearance.labels.${key}`) }))}
            />
            <span className="muted appearance-note">{t("appearance.labels.hint")}</span>
          </div>
          <div className="col appearance-field">
            <Switch
              size="md"
              checked={layout.show_secondary}
              onChange={(show_secondary) => setLayout({ show_secondary })}
              label={t("appearance.custom.secondary")}
              testId="appearance-secondary"
            />
            <span className="muted appearance-note">{t("appearance.custom.secondaryHint")}</span>
          </div>
        </div>
        <p className="muted appearance-note">{t("appearance.cards.localNote")}</p>
      </SettingsSection>

      <SettingsSection title={t("appearance.workspace.title")} description={t("appearance.workspace.hint")}>
        <div className="appearance-grid">
          <div className="col appearance-field">
            <span className="label">{t("appearance.custom.density")}</span>
            <SectionTabs
              label={t("appearance.custom.density")}
              value={layout.density}
              onChange={(density) => setLayout({ density })}
              tabs={[
                { key: "simple", label: t("appearance.custom.densitySimple") },
                { key: "standard", label: t("appearance.custom.densityStandard") },
                { key: "compact", label: t("appearance.custom.densityCompact") },
              ]}
            />
          </div>
          <label className="col appearance-field">
            <span className="label">{t("appearance.custom.home")}</span>
            <select
              className="input"
              value={layout.home ?? "/"}
              onChange={(e) => setLayout({ home: e.target.value === "/" ? null : e.target.value })}
              data-testid="appearance-home"
            >
              {homeOptions.map((o) => <option key={o.to} value={o.to}>{o.label}</option>)}
            </select>
          </label>
        </div>
      </SettingsSection>

      <SettingsSection title={t("appearance.menu.section")} description={t("appearance.menu.hint")}>
        <div className="col" style={{ gap: 16 }}>
          <MenuEditor items={orderedItems} arrangement={layout.sidebar} onChange={(sidebar) => setLayout({ sidebar })} />
          {canHaveBranchShortcuts(role) && (
            <div className="col" style={{ gap: 8 }}>
              <span className="label">{t("appearance.menu.branchSections")}</span>
              <span className="muted appearance-note">{t("appearance.menu.branchSectionsHint")}</span>
              <BranchShortcuts
                role={role}
                branches={branchOptions}
                active={activeShortcuts}
                failed={ownerBranches.error !== null}
                onToggle={toggleShortcut}
              />
            </div>
          )}
          <div>
            <Button type="button" variant="secondary" onClick={() => setLayout({ sidebar: [] })}
              disabled={layout.sidebar.length === 0}>{t("appearance.menu.reset")}</Button>
          </div>
        </div>
      </SettingsSection>

      <div className="appearance-actions" data-testid="appearance-actions">
        {dirty && <span className="appearance-actions__state">{t("appearance.unsaved")}</span>}
        {saveFailed && !dirty && <span className="error">{t("appearance.saveFailed")}</span>}
        <Button type="button" variant="secondary" onClick={onDefault}
          disabled={working.interface === "standard"}>{t("appearance.reset")}</Button>
        <Button type="button" variant="secondary" onClick={discardDraft} disabled={!dirty}>{t("appearance.cancel")}</Button>
        <Button type="button" onClick={() => void onSave()} disabled={!dirty || saving}>
          {saving ? t("appearance.saving") : t("appearance.save")}
        </Button>
      </div>
      </div>
    </ScreenWithBg>
  );
};

export default Appearance;
