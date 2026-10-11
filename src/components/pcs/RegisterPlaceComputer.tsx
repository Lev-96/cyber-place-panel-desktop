import PairingTokenModal from "@/components/pcs/PairingTokenModal";
import PcForm from "@/components/pcs/PcForm";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { useAsync } from "@/hooks/useAsync";
import { useLang } from "@/i18n/LanguageContext";
import { pcRepository } from "@/repositories/PcRepository";
import { IPcApi } from "@/types/sessions";
import { useState } from "react";

interface Props {
  branchId: number;
  /** The PC place just created. */
  placeId: number;
  /** Closed: "Not now", or done. The place exists either way. */
  onClose: () => void;
}

/**
 * Register the computer of a PC place right after creating it (2026-10-11).
 *
 * The server provisions the place's device with the place
 * (`EnsureBillingDeviceService`): one `kind = pc` row per place, holding the
 * pairing token. So this is the existing "Register computer" form on THAT
 * device: saving updates it, a second device is never created (the server
 * would refuse it), and the place is never touched. The rest is the Computers
 * screen's normal flow: the form, then the pairing token for the kiosk app.
 */
const RegisterPlaceComputer = ({ branchId, placeId, onClose }: Props) => {
  const { t } = useLang();
  const pcs = useAsync(() => pcRepository.listByBranch(branchId), [branchId]);
  const [token, setToken] = useState<IPcApi | null>(null);
  const [tokenErr, setTokenErr] = useState<string | null>(null);

  if (token) return <PairingTokenModal pc={token} onClose={onClose} />;
  if (tokenErr) {
    // The computer is saved; only its token did not come. The place and the
    // device both stand — "Get token" under Computers gives it any time.
    return (
      <Modal open onClose={onClose}>
        <div className="card" style={{ width: 420, maxWidth: "90vw", display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="error">{tokenErr}</div>
          <div className="row-between">
            <Button type="button" variant="secondary" onClick={onClose}>{t("pcs.notNow")}</Button>
          </div>
        </div>
      </Modal>
    );
  }

  const device = (pcs.data ?? []).find((pc) => pc.place_id === placeId) ?? null;

  if (!device) {
    // Loading, a failed read, or a device not there yet: say so and let the
    // operator retry or move on. Never a second device from here.
    return (
      <Modal open onClose={onClose}>
        <div className="card" style={{ width: 460, maxWidth: "90vw", display: "flex", flexDirection: "column", gap: 14 }}>
          <h2 style={{ margin: 0 }}>{t("pcs.newDevice")}</h2>
          {pcs.loading ? <ListSkeleton rows={2} /> : <div className="muted">{t("pcs.registerPlace.missing")}</div>}
          <div className="row-between">
            <Button type="button" variant="secondary" onClick={onClose}>{t("pcs.notNow")}</Button>
            {!pcs.loading && <Button type="button" onClick={() => void pcs.reload()}>{t("action.retry")}</Button>}
          </div>
        </div>
      </Modal>
    );
  }

  // Other places' devices, so the form's place list offers only free ones.
  const takenPlaceIds = (pcs.data ?? [])
    .filter((pc) => pc.id !== device.id)
    .map((pc) => pc.place_id)
    .filter((id): id is number => typeof id === "number");

  return (
    <PcForm
      branchId={branchId}
      initial={device}
      takenPlaceIds={takenPlaceIds}
      registering
      onClose={onClose}
      onSaved={async (saved) => {
        // An agent already paired keeps its token: rotating it would cut that
        // machine off. A fresh one gets the token the kiosk app pairs with,
        // exactly as "Get token" on the Computers screen hands it out.
        if (saved.last_seen_at) return onClose();
        try {
          setToken(await pcRepository.rotateToken(saved.id));
        } catch (e) {
          setTokenErr(e instanceof Error ? e.message : t("action.failed"));
        }
      }}
    />
  );
};

export default RegisterPlaceComputer;
