import LanguagePickerModal from "@/components/ui/LanguagePickerModal";
import Spinner from "@/components/ui/Spinner";
import { useAuth } from "@/auth/AuthContext";
import { useLang } from "@/i18n/LanguageContext";
import { Lang } from "@/i18n/translations";
import {
  notePreLoginChoice,
  readAccountLang,
  setActiveAccount,
  takePreLoginChoice,
} from "@/i18n/languagePreference";
import { ReactNode, useEffect, useState } from "react";

/**
 * The language steps of the startup flow.
 *
 *   launch ─ never chosen on this machine? ─→ [FirstRunLanguageGate] ─┐
 *          └─ already chosen ────────────────────────────────────────┤
 *                                                                    ▼
 *                                                                  login
 *                                                                    │
 *                              ┌─────────────────────────────────────┘
 *                              ▼
 *              [AccountLanguageGate] ─ account has a language? ─→ apply it, no dialog
 *                                    └ first login for it?      ─→ ask once, store it
 *
 * The account is the source of truth. The device-level preference exists only
 * so the LOGIN screen — where there is no account to read from — has a language
 * to render in.
 *
 * Both gates are *render* gates, not routes. Making them routes would let a
 * restored deep link skip them (the panel uses HashRouter and reopens its last
 * hash on launch), and would put a navigation in the middle of a decision that
 * is not a place in the app.
 *
 * A note on "open the cabinet already in the chosen language": no refetch
 * happens and none is needed. Every auto-translated entity ships all locales in
 * its `i18n` bag and the client resolves them at render time, so applying a
 * language is an instant re-render from data already in memory.
 */

/**
 * Pre-login picker, shown over the login screen on a machine where nobody has
 * ever chosen a language.
 *
 * Rendered ABOVE the auth flow so a fresh install does not present a sign-in
 * form in a language the user may not read. The choice is remembered on the
 * device AND handed to the first account that signs in, so that account is not
 * asked the same question again seconds later.
 */
export const FirstRunLanguageGate = ({ children }: { children: ReactNode }) => {
  const { lang, setLang, ready, chosen } = useLang();

  // Storage is async. Until it has been read we cannot tell "never chosen" from
  // "not loaded yet", and guessing wrong means re-prompting a returning user.
  if (!ready) return <Spinner />;

  if (!chosen) {
    const confirm = (l: Lang) => {
      // Recorded before setLang so the account gate, which may mount in the
      // very next commit, already sees the hand-off.
      notePreLoginChoice(l);
      setLang(l);
    };

    return (
      <>
        {/* The login screen renders behind the picker, blurred and inert. It
            gives the dialog somewhere to sit — a modal floating over an empty
            void reads as an error state — and it shows what comes next without
            letting anyone get there first.

            Safe only because Modal portals to <body>: `filter` on this wrapper
            establishes a containing block, so a dialog nested inside it would
            have its `position: fixed` resolve against the blurred layer rather
            than the viewport. Portaled out, the dialog is unaffected. */}
        <InertBackdrop>{children}</InertBackdrop>
        <LanguagePickerModal
          open
          variant="firstRun"
          initial={lang}
          // No onDismiss: there is deliberately no way past this screen without
          // making a choice. A dismissable first-run picker just becomes a
          // dialog everyone closes, and then the app is in a language nobody
          // picked.
          onConfirm={confirm}
        />
      </>
    );
  }

  return <>{children}</>;
};

/**
 * Per-account language step, shown once for each account that has never chosen.
 *
 * Three outcomes, decided from storage on every sign-in and account switch:
 *
 *   • the account has a language  → apply it silently, no dialog. This is what
 *     makes "sign out and back in" and "same account on another machine" quiet.
 *   • it inherits the pre-login choice from this app run → adopt it silently.
 *     The user picked a language moments ago on the login screen; asking again
 *     immediately would read as a bug.
 *   • neither → ask, once, and store it against the account.
 *
 * Applies to every role. Language is a property of the person, and an admin is
 * as entitled to their own as anyone else.
 */
export const AccountLanguageGate = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const { lang, setLang, ready } = useLang();
  const [decided, setDecided] = useState(false);
  const [prompt, setPrompt] = useState(false);

  const userId = user?.id;

  useEffect(() => {
    let cancelled = false;

    if (!ready || userId == null) return;

    // Every language write from here on — this gate, Settings, anywhere —
    // is attributed to this account. Cleared on sign-out below so a write
    // can never land on the account that just left.
    setActiveAccount(userId);

    void (async () => {
      const stored = await readAccountLang(userId);
      // The account can change under us (sign-out, account switch) while the
      // storage read is in flight; committing a stale answer would prompt the
      // wrong person or skip the right one.
      if (cancelled) return;

      if (stored) {
        // The account's language wins over whatever the device booted in.
        setLang(stored);
        setPrompt(false);
        setDecided(true);
        return;
      }

      const inherited = takePreLoginChoice();
      if (inherited) {
        // Persists against the account, because setActiveAccount ran above.
        setLang(inherited);
        setPrompt(false);
        setDecided(true);
        return;
      }

      setPrompt(true);
      setDecided(true);
    })();

    return () => {
      cancelled = true;
      setActiveAccount(null);
    };
    // Re-runs on account switch, which is what re-arms the gate for the next
    // person on a shared front-desk machine.
  }, [ready, userId, setLang]);

  // A signed-out render must never hold the app: the gate lives inside the
  // authed tree, so this is the unmount path.
  if (userId == null) return <>{children}</>;

  // Until the account's preference has been read we cannot render the app in a
  // language we might be about to change — that would flash the device language
  // and then snap to the account's. The read is a local key-value lookup.
  if (!decided) return <Spinner />;

  if (!prompt) return <>{children}</>;

  const confirm = (l: Lang) => {
    // setLang persists to both scopes; the account write is what stops this
    // dialog ever appearing for them again.
    setLang(l);
    setPrompt(false);
  };

  return (
    <>
      {/* Same treatment as the pre-login step: the cabinet sits behind the
          dialog, blurred and inert. Consistency matters — two language dialogs
          that look like different products would read as a bug. The tree stays
          MOUNTED, so nothing refetches once the choice is made. */}
      <InertBackdrop>{children}</InertBackdrop>
      <LanguagePickerModal
        open
        variant="account"
        initial={lang}
        onConfirm={confirm}
        // No onDismiss: this is the account's one and only prompt, so it has to
        // produce an answer. Dismissing would either re-ask forever or silently
        // pick for them.
      />
    </>
  );
};

/**
 * Decorative, non-interactive backdrop for a blocking dialog.
 *
 * Three mechanisms, because each closes a different way in:
 *   - `pointer-events: none` (CSS) — the mouse;
 *   - `inert` — keyboard focus and every programmatic focus call;
 *   - `aria-hidden` — screen readers, which would otherwise announce a login
 *     form the user has no way to reach.
 *
 * The first two are not belt-and-braces for its own sake: they keep the
 * behaviour correct on a runtime that ignores `inert`.
 */
const InertBackdrop = ({ children }: { children: ReactNode }) => (
  <div className="cp-inert-backdrop" aria-hidden="true" inert data-testid="lang-backdrop">
    {children}
  </div>
);
