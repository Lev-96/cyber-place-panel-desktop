import { useAuth } from "@/auth/AuthContext";
import AppearancePreview from "@/components/appearance/AppearancePreview";
import PresetPicture from "@/components/appearance/PresetPicture";
import ChoiceCards from "@/components/appearance/ChoiceCards";
import MenuEditor from "@/components/appearance/MenuEditor";
import SoundSettings from "@/components/appearance/SoundSettings";
import { menuSpecsFor } from "@/components/Sidebar";
import { applyPersonalMenu, sortedNavItems, withStaffMenu } from "@/components/sidebarNav";
import Button from "@/components/ui/Button";
import Checkbox from "@/components/ui/Checkbox";
import ScreenWithBg from "@/components/ui/ScreenWithBg";
import SectionTabs from "@/components/ui/SectionTabs";
import SettingsSection from "@/components/ui/SettingsSection";
import { useLang } from "@/i18n/LanguageContext";
import { useUiPreferences } from "@/preferences/UiPreferencesContext";
import {
  PRESETS, effectiveLayout, toDocument,
  type InterfaceId, type Layout, type ThemeId, type UiPreferences,
} from "@/preferences/uiPreferences";
import { notify } from "@/ui/notify";
import { useEffect, useMemo, useState } from "react";

/**
 * «Интерфейс и тема» (2026-10-27): the person's ready-made interface, theme,
 * own layout and notification sounds, in plain words.
 *
 * Every change is tried on at once — the whole panel shows it — and nothing
 * is kept until «Сохранить». «Отменить изменения» puts the saved look back;
 * leaving the screen with edits keeps them aside and the panel says so
 * (UnsavedInterfaceNotice), so nothing is lost without a word. Only display
 * changes here: permissions, data and every action stay as they are.
 */
const same = (a: UiPreferences, b: UiPreferences) => JSON.stringify(toDocument(a)) === JSON.stringify(toDocument(b));

const Appearance = () => {
  const { t, lang } = useLang();
  const { user } = useAuth();
  const { prefs, draft, editDraft, discardDraft, save, preview, saveFailed } = useUiPreferences();
  const working = draft ?? prefs;
  const dirty = draft !== null && !same(draft, prefs);
  const layout = effectiveLayout(working);
  const [saving, setSaving] = useState(false);

  // Back on the screen with edits: show them again; leaving: the saved look.
  useEffect(() => {
    if (draft) preview(draft);
    return () => preview(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dash = user?.dashboard;
  const myBranchId = typeof dash?.branch_id === "number" ? dash.branch_id : null;
  const myCompanyId = typeof dash?.company_id === "number" ? dash.company_id : null;
  // The role's own menu, built by the same function the side menu uses.
  const roleItems = useMemo(
    () => sortedNavItems(withStaffMenu(menuSpecsFor(user?.role, myBranchId, myCompanyId), user?.role), t, lang),
    [user?.role, myBranchId, myCompanyId, t, lang],
  );
  const orderedItems = useMemo(
    () => applyPersonalMenu(roleItems, layout.sidebar.map((e) => ({ id: e.id, hidden: false }))),
    [roleItems, layout.sidebar],
  );
  const homeOptions = useMemo(() => {
    const options = roleItems.map((i) => ({ to: i.to, label: i.label }));
    if (myBranchId !== null) options.splice(1, 0, { to: `/branches/${myBranchId}/sessions`, label: t("hub.tile.sessions") });
    return options.filter((o) => /^\/[a-z0-9/_-]{0,80}$/.test(o.to));
  }, [roleItems, myBranchId, t]);

  const setInterface = (id: InterfaceId) => {
    // «Мой интерфейс» is the person's OWN layout, kept while a ready-made
    // one is on (it starts as Standard), so choosing it shows that layout —
    // not a copy of whatever was on screen. Editing any control below while
    // a ready-made one is on still starts from what is on screen (setLayout).
    editDraft({ ...working, interface: id });
  };
  const setLayout = (patch: Partial<Layout>) =>
    editDraft({ ...working, interface: "custom", layout: { ...layout, ...patch } });

  const onSave = async () => {
    setSaving(true);
    try {
      await save(working);
      notify.message("success", t("appearance.saved"));
    } catch {
      notify.message("error", t("appearance.saveFailed"));
    } finally {
      setSaving(false);
    }
  };
  const onReset = () => editDraft({ ...working, interface: "standard", layout: { ...PRESETS.standard } });

  const interfaces: Array<{ key: InterfaceId; title: string; description: string }> = [
    { key: "simple", title: t("appearance.ui.simple"), description: t("appearance.ui.simpleDesc") },
    { key: "standard", title: t("appearance.ui.standard"), description: t("appearance.ui.standardDesc") },
    { key: "compact", title: t("appearance.ui.compact"), description: t("appearance.ui.compactDesc") },
    { key: "custom", title: t("appearance.ui.custom"), description: t("appearance.ui.customDesc") },
  ];
  const themes: Array<{ key: ThemeId; title: string; description: string }> = [
    { key: "dark", title: t("appearance.theme.dark"), description: t("appearance.theme.darkDesc") },
    { key: "light", title: t("appearance.theme.light"), description: t("appearance.theme.lightDesc") },
    { key: "contrast", title: t("appearance.theme.contrast"), description: t("appearance.theme.contrastDesc") },
  ];

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
          choices={interfaces.map((c) => ({ ...c, picture: <PresetPicture id={c.key} /> }))}
        />
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

      <SettingsSection title={t("appearance.preview")} description={t("appearance.previewHint")}>
        <AppearancePreview quick={layout.quick_actions} />
      </SettingsSection>

      <SettingsSection title={t("appearance.custom.title")} description={t("appearance.custom.hint")}>
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
            <Checkbox
              checked={layout.show_secondary}
              onChange={(show_secondary) => setLayout({ show_secondary })}
              label={t("appearance.custom.secondary")}
            />
            <span className="muted appearance-note">{t("appearance.custom.secondaryHint")}</span>
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
        <div className="col" style={{ gap: 8, marginTop: 16 }}>
          <span className="label">{t("appearance.menu.title")}</span>
          <span className="muted appearance-note">{t("appearance.menu.hint")}</span>
          <MenuEditor items={orderedItems} arrangement={layout.sidebar} onChange={(sidebar) => setLayout({ sidebar })} />
        </div>
      </SettingsSection>

      <SoundSettings value={working.sound} onChange={(sound) => editDraft({ ...working, sound })} />

      <div className="appearance-actions" data-testid="appearance-actions">
        {dirty && <span className="appearance-actions__state">{t("appearance.unsaved")}</span>}
        {saveFailed && !dirty && <span className="error">{t("appearance.saveFailed")}</span>}
        <Button type="button" variant="secondary" onClick={onReset}
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
