import { THEMES, type ThemeId } from "@/preferences/uiPreferences";

/**
 * Every colour theme as a choice card's words (2026-11-04), for «Интерфейс и
 * тема» and the first-run setup alike: one list (the model's `THEMES`), so the
 * two can never offer different themes.
 */
export const themeChoices = (t: (key: string) => string): Array<{ key: ThemeId; title: string; description: string }> =>
  THEMES.map((key) => ({ key, title: t(`appearance.theme.${key}`), description: t(`appearance.theme.${key}Desc`) }));
