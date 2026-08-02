import LanguagePickerModal from "@/components/ui/LanguagePickerModal";
import Spinner from "@/components/ui/Spinner";
import { useAuth } from "@/auth/AuthContext";
import { useLang } from "@/i18n/LanguageContext";
import { Lang } from "@/i18n/translations";
import { rememberPanelLang, shouldPromptPanelLanguage } from "@/i18n/languagePreference";
import { ReactNode, useEffect, useState } from "react";

/**
 * The two language steps of the startup flow.
 *
 * Flow, end to end:
 *
 *   launch → [FirstRunLanguageGate] → login → (owner/manager)
 *          → [PanelLanguageGate] → cabinet
 *
 * Both gates are *render* gates, not routes. Making them routes would mean the
 * app can be deep-linked past them (the panel uses HashRouter, and a restored
 * window reopens its last hash), and it would put a navigation in the middle of
 * a decision that is not a place in the app.
 *
 * A note on "load all data in the chosen language without a reload": no reload
 * is needed and none is performed. Every auto-translated entity ships all
 * locales in its `i18n` bag and the client resolves them at render time, so
 * changing the language re-renders instantly — offline, from data already in
 * memory. Refetching on language change would be pure waste; the gate exists to
 * confirm a preference, not to trigger a load.
 */

/**
 * Blocks the app until a language is chosen on a fresh install.
 *
 * Rendered ABOVE the auth flow, so the very first thing a new install shows is
 * this screen and not a login form in a language the user may not read. Once
 * chosen it never appears again — Settings owns changes from then on.
 */
export const FirstRunLanguageGate = ({ children }: { children: ReactNode }) => {
  const { lang, setLang, ready, chosen } = useLang();

  // Storage is async. Until it has been read we cannot tell "never chosen" from
  // "not loaded yet", and guessing wrong means re-prompting a returning user.
  if (!ready) return <Spinner />;

  if (!chosen) {
    return (
      <LanguagePickerModal
        open
        variant="firstRun"
        initial={lang}
        // No onDismiss: there is deliberately no way past this screen without
        // making a choice. A dismissable first-run picker just becomes a
        // dialog everyone closes, and then the app is in a language nobody
        // picked.
        onConfirm={(l: Lang) => setLang(l)}
      />
    );
  }

  return <>{children}</>;
};

/**
 * Workspace language step for owner / manager, shown before their cabinet.
 *
 * Scoped to the session rather than to navigation: it appears once when the
 * authenticated session starts and never again while that session lives, so
 * moving between screens inside the cabinet is never interrupted. Whether it
 * appears at all on subsequent launches is the `PANEL_LANGUAGE_PROMPT` policy.
 *
 * Admin is excluded by policy — admins run the network-wide console and were
 * not part of this requirement.
 */
export const PanelLanguageGate = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const { lang, setLang, ready } = useLang();
  const [decided, setDecided] = useState(false);
  const [prompt, setPrompt] = useState(false);

  const userId = user?.id;
  const role = user?.role;

  useEffect(() => {
    let cancelled = false;

    if (!ready || userId == null) return;

    void (async () => {
      const needed = await shouldPromptPanelLanguage(role, userId);
      // The account can change under us (sign out, account switch) while the
      // storage read is in flight; committing a stale answer would prompt the
      // wrong user or skip the right one.
      if (cancelled) return;
      setPrompt(needed);
      setDecided(true);
    })();

    return () => { cancelled = true; };
    // Re-runs on account switch, which is what re-arms the gate for the next
    // user on a shared front-desk machine.
  }, [ready, role, userId]);

  // Render children while the (fast, local) check runs rather than a spinner:
  // the overwhelming case is "no prompt needed", and flashing a spinner on
  // every launch to answer a key-value lookup is a worse trade than the modal
  // appearing a frame later.
  if (!decided || !prompt || userId == null) return <>{children}</>;

  const commit = (l: Lang) => {
    setLang(l);
    void rememberPanelLang(userId, l);
    setPrompt(false);
  };

  return (
    <>
      {children}
      <LanguagePickerModal
        open
        variant="workspace"
        initial={lang}
        onConfirm={commit}
        // Dismissing keeps the current language — it is a confirmation step,
        // not a required field, and trapping someone in it after they have
        // already authenticated would be hostile.
        onDismiss={() => commit(lang)}
      />
    </>
  );
};
