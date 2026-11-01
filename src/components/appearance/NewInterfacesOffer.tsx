import Button from "@/components/ui/Button";
import { useAuth } from "@/auth/AuthContext";
import { keyValueStore } from "@/infrastructure/KeyValueStore";
import { useLang } from "@/i18n/LanguageContext";
import { useUiPreferencesOptional } from "@/preferences/UiPreferencesContext";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * A soft offer for the people who already use the panel (2026-10-27, owner
 * decision): they keep the interface they know, and the dashboard mentions,
 * once, that there are others. Never a wizard, never in the way: it shows on
 * the dashboard only, to someone who never chose anything, and «Не сейчас»
 * ends it for good on this computer.
 */
export const offerDismissedKey = (userId: number) => `u${userId}:cp.ui.offerDismissed`;

const NewInterfacesOffer = () => {
  const ui = useUiPreferencesOptional();
  const { user } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [dismissed, setDismissed] = useState<boolean | null>(null);
  const userId = user?.id ?? null;

  useEffect(() => {
    setDismissed(null);
    if (userId === null) return;
    let cancelled = false;
    keyValueStore.get<boolean>(offerDismissedKey(userId))
      .then((v) => { if (!cancelled) setDismissed(v === true); })
      .catch(() => { if (!cancelled) setDismissed(false); });
    return () => { cancelled = true; };
  }, [userId]);

  if (!ui?.loaded || ui.needsOnboarding || ui.hasSaved || dismissed !== false || pathname !== "/" || userId === null) return null;

  const dismiss = () => {
    setDismissed(true);
    void keyValueStore.set(offerDismissedKey(userId), true).catch(() => {});
  };
  return (
    <div className="unsaved-notice new-interfaces-offer" role="status" data-testid="new-interfaces-offer">
      <span>{t("appearance.offer")}</span>
      <Button type="button" onClick={() => { dismiss(); navigate("/appearance"); }}>{t("appearance.offerLook")}</Button>
      <Button type="button" variant="secondary" onClick={dismiss}>{t("appearance.offerLater")}</Button>
    </div>
  );
};

export default NewInterfacesOffer;
