import { useAuth } from "@/auth/AuthContext";
import { keyValueStore } from "@/infrastructure/KeyValueStore";
import { preferencesRepository } from "@/repositories/PreferencesRepository";
import { setDeviceSound as setEngineDeviceSound, setSoundPreferences, type DeviceSound } from "@/sound/soundEngine";
import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_PREFERENCES, NEW_PERSON_PREFERENCES, ONBOARDING_VERSION, SCHEMA_VERSION,
  effectiveLayout, parsePreferences, toDocument, type Layout, type UiPreferences,
} from "./uiPreferences";

/**
 * The person's interface, applied (2026-10-27).
 *
 * One provider for the whole authed tree: it reads the person's preferences
 * (a local copy first, for the first frame; the server's next) and writes the
 * theme and layout onto `<html>` as data attributes the stylesheet keys off.
 * Screens never branch on the interface for BEHAVIOUR: the same components,
 * the same handlers, the same permissions — only how they are laid out.
 *
 * A preview applies a candidate without saving it (the constructor, the
 * first-run setup); leaving without saving puts the saved one back. Nothing
 * here sends a request other than reading and saving the document itself.
 */
export interface UiPreferencesState {
  /** The saved preferences (or the defaults until they are known). */
  prefs: UiPreferences;
  /** What is on screen: the preview if one is up, else the saved. */
  shown: UiPreferences;
  layout: Layout;
  /** The server has answered at least once for this person. */
  loaded: boolean;
  /** The first-run setup is due: the server said so, and only the server. */
  needsOnboarding: boolean;
  /** The person has saved preferences of their own (the server holds a document). */
  hasSaved: boolean;
  /** The last save did not reach the server (kept here and retried on the next). */
  saveFailed: boolean;
  save: (next: UiPreferences) => Promise<void>;
  finishOnboarding: (next: UiPreferences) => Promise<void>;
  preview: (candidate: UiPreferences | null) => void;
  /**
   * Unsaved edits on the interface screen (2026-10-27). Kept here, not on the
   * screen, so leaving it loses nothing: the panel goes back to the saved
   * look and a notice offers to return to the edits or drop them.
   */
  draft: UiPreferences | null;
  editDraft: (next: UiPreferences) => void;
  discardDraft: () => void;
  /** This machine's volume and mute for this person (never on the server). */
  deviceSound: DeviceSound;
  setDeviceSound: (next: DeviceSound) => void;
}

const Ctx = createContext<UiPreferencesState | null>(null);

export const cacheKey = (userId: number) => `u${userId}:cp.ui.prefs`;
export const deviceSoundKey = (userId: number) => `u${userId}:cp.sound.device`;
/**
 * The first-run setup finished on THIS computer (2026-10-27), kept until the
 * server has it too: a finish whose save failed offline is not asked again,
 * and is sent with the next save or the next sign-in.
 */
export const onboardedKey = (userId: number) => `u${userId}:cp.ui.onboarded`;
const DEVICE_DEFAULT: DeviceSound = { volume: 100, muted: false };

/** Put the interface on `<html>`; the stylesheet does the rest. */
export const applyToDocument = (p: UiPreferences, root: HTMLElement = document.documentElement) => {
  const l = effectiveLayout(p);
  root.dataset.theme = p.theme;
  root.dataset.density = l.density;
  root.dataset.cardSize = l.card_size;
  root.dataset.boardView = l.board_view;
  root.dataset.secondary = l.show_secondary ? "on" : "off";
  root.dataset.quickActions = l.quick_actions;
};

export const UiPreferencesProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [prefs, setPrefs] = useState<UiPreferences>(DEFAULT_PREFERENCES);
  const [candidate, setCandidate] = useState<UiPreferences | null>(null);
  const [draft, setDraft] = useState<UiPreferences | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [onboardingVersion, setOnboardingVersion] = useState<number | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const [deviceSound, setDeviceSoundState] = useState<DeviceSound>(DEVICE_DEFAULT);
  // The person whose preferences are on screen: a late answer for the
  // previous person (account switch) is dropped.
  const owner = useRef<number | null>(null);
  // A finished setup the server has not confirmed yet (see onboardedKey).
  const pendingOnboarding = useRef<number | null>(null);

  useEffect(() => {
    owner.current = userId;
    pendingOnboarding.current = null;
    setCandidate(null);
    setDraft(null);
    setHasSaved(false);
    setLoaded(false);
    setOnboardingVersion(null);
    setSaveFailed(false);
    setPrefs(DEFAULT_PREFERENCES);
    setDeviceSoundState(DEVICE_DEFAULT);
    if (userId === null) return;

    let cancelled = false;
    void (async () => {
      try {
        const local = await keyValueStore.get<Partial<DeviceSound>>(deviceSoundKey(userId));
        if (!cancelled && local) {
          setDeviceSoundState({
            volume: typeof local.volume === "number" ? Math.max(0, Math.min(100, local.volume)) : 100,
            muted: local.muted === true,
          });
        }
      } catch { /* full volume, not muted */ }
      try {
        const cached = await keyValueStore.get<unknown>(cacheKey(userId));
        if (!cancelled && cached) setPrefs(parsePreferences(cached));
      } catch { /* no copy on this machine: the defaults stand until the server answers */ }
      let finishedHere = 0;
      try {
        finishedHere = Number(await keyValueStore.get<number>(onboardedKey(userId))) || 0;
      } catch { /* nothing finished here */ }
      try {
        const doc = await preferencesRepository.get();
        if (cancelled || owner.current !== userId) return;
        // Finished here while the server could not be told: not asked again,
        // and told now, with the document exactly as the server has it.
        if (doc.onboarding_version < ONBOARDING_VERSION && finishedHere >= ONBOARDING_VERSION) {
          pendingOnboarding.current = ONBOARDING_VERSION;
          doc.onboarding_version = ONBOARDING_VERSION;
          void preferencesRepository
            .put({ schema_version: SCHEMA_VERSION, data: doc.data ?? null, onboarding_version: ONBOARDING_VERSION })
            .then(() => { if (owner.current === userId) pendingOnboarding.current = null; })
            .catch(() => { /* sent again with the next save */ });
        }
        // Nobody chose anything yet: a person still to be set up starts from
        // the new-person defaults, everybody else from what they know.
        const base = doc.onboarding_version < ONBOARDING_VERSION ? NEW_PERSON_PREFERENCES : DEFAULT_PREFERENCES;
        const next = doc.data == null ? base : parsePreferences(doc.data, base);
        setPrefs(next);
        setOnboardingVersion(doc.onboarding_version);
        setHasSaved(doc.data != null);
        setLoaded(true);
        void keyValueStore.set(cacheKey(userId), toDocument(next)).catch(() => {});
      } catch {
        // Offline or refused: keep the local copy (or the defaults) and never
        // hold the till behind a setup screen nobody can save.
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const shown = candidate ?? prefs;
  useEffect(() => { applyToDocument(userId === null ? DEFAULT_PREFERENCES : shown); }, [shown, userId]);
  // The sound engine hears what is SAVED (a sound preview is its own call),
  // and this machine's volume.
  useEffect(() => { setSoundPreferences(prefs.sound); }, [prefs.sound]);
  useEffect(() => { setEngineDeviceSound(deviceSound); }, [deviceSound]);

  const persist = useCallback(async (next: UiPreferences, onboarding?: number) => {
    const id = owner.current;
    if (id === null) return;
    setPrefs(next);
    setCandidate(null);
    setDraft(null);
    void keyValueStore.set(cacheKey(id), toDocument(next)).catch(() => {});
    try {
      const reported = onboarding ?? pendingOnboarding.current ?? undefined;
      const doc = await preferencesRepository.put({
        schema_version: SCHEMA_VERSION,
        data: toDocument(next),
        ...(reported !== undefined ? { onboarding_version: reported } : {}),
      });
      if (owner.current !== id) return;
      if (doc.onboarding_version >= ONBOARDING_VERSION) pendingOnboarding.current = null;
      setOnboardingVersion(Math.max(doc.onboarding_version, pendingOnboarding.current ?? 0));
      setHasSaved(true);
      setSaveFailed(false);
    } catch (e) {
      if (owner.current === id) setSaveFailed(true);
      throw e;
    }
  }, []);

  const value = useMemo<UiPreferencesState>(() => ({
    prefs,
    shown,
    layout: effectiveLayout(shown),
    loaded,
    needsOnboarding: loaded && onboardingVersion !== null && onboardingVersion < ONBOARDING_VERSION,
    hasSaved,
    saveFailed,
    save: (next) => persist(next),
    finishOnboarding: async (next) => {
      // Finished on screen at once, whatever the network does: the wizard is
      // never shown twice in one sitting because a save was slow.
      setOnboardingVersion(ONBOARDING_VERSION);
      pendingOnboarding.current = ONBOARDING_VERSION;
      const id = owner.current;
      if (id !== null) void keyValueStore.set(onboardedKey(id), ONBOARDING_VERSION).catch(() => {});
      await persist(next, ONBOARDING_VERSION);
    },
    preview: setCandidate,
    draft,
    editDraft: (next) => { setDraft(next); setCandidate(next); },
    discardDraft: () => { setDraft(null); setCandidate(null); },
    deviceSound,
    setDeviceSound: (next) => {
      setDeviceSoundState(next);
      const id = owner.current;
      if (id !== null) void keyValueStore.set(deviceSoundKey(id), next).catch(() => {});
    },
  }), [prefs, shown, loaded, onboardingVersion, hasSaved, saveFailed, persist, draft, deviceSound]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export const useUiPreferences = (): UiPreferencesState => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useUiPreferences must be used within UiPreferencesProvider");
  return ctx;
};

/** For components that may render outside the provider (tests, the login screen). */
export const useUiPreferencesOptional = (): UiPreferencesState | null => useContext(Ctx);
