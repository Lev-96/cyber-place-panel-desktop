import Button from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { useAsync } from "@/hooks/useAsync";
import { useLang } from "@/i18n/LanguageContext";
import { fmt } from "@/i18n/translations";
import { pcRepository } from "@/repositories/PcRepository";
import { sessionRepository } from "@/repositories/SessionRepository";
import { PC_STATUS } from "@/types/pc";
import type { IPcApi } from "@/types/sessions";
import { useState } from "react";

/**
 * The branch's devices that serve no place (2026-11-04, owner: "Active Places
 * shows 10, Places shows 7").
 *
 * Active Places draws DEVICES and Places draws PLACES. A device whose place is
 * gone (or that was created through the API without one) is billable on the
 * board but on no Places tile, and nowhere else either — Computers lists
 * computers only. So the two screens disagreed with nothing on either one to
 * say why. This names them, under the places, and lets the owner remove one.
 *
 * Removing goes through `DELETE /pcs/{id}`, which takes the device and every
 * session recorded on it (the confirmation says so). It is refused HERE while
 * a session runs on the device — money in progress is never deleted from this
 * notice — judged by two independent signals, the branch's running sessions
 * and the device's own status, and only once both were read: a read that
 * failed is "cannot tell", never "nothing runs".
 */
interface Props {
  branchId: number;
  /** Owner-level: the same right that lays out and deletes places. */
  canRemove: boolean;
  /** Told after a device is removed (the parent refreshes what it shows). */
  onRemoved?: () => void;
}

interface Facts {
  devices: IPcApi[];
  running: Set<number>;
}

const DevicesWithoutPlace = ({ branchId, canRemove, onRemoved }: Props) => {
  const { t } = useLang();
  const confirm = useConfirm();
  const [removing, setRemoving] = useState<number | null>(null);
  const facts = useAsync<Facts>(async () => {
    const [devices, running] = await Promise.all([
      pcRepository.listWithoutPlace(branchId),
      sessionRepository.runningPcIds(branchId),
    ]);
    return { devices, running };
  }, [branchId]);

  const devices = facts.data?.devices ?? [];
  if (devices.length === 0) return null;
  const isRunning = (d: IPcApi) => facts.data!.running.has(d.id) || d.status === PC_STATUS.InSession;
  // Only on a FRESH, successful read: `useAsync` keeps the last answer through
  // a reload and through a failed one, and neither may decide a delete.
  const settled = !facts.loading && facts.error === null;

  const remove = async (d: IPcApi) => {
    if (removing !== null || !settled || isRunning(d)) return;
    if (!(await confirm(fmt(t("places.orphans.confirmDelete"), d.label), { destructive: true }))) return;
    setRemoving(d.id);
    try {
      await pcRepository.remove(d.id);
      onRemoved?.();
    } finally {
      setRemoving(null);
      void facts.reload();
    }
  };

  return (
    <div className="card state-notice devices-without-place" role="status" data-testid="devices-without-place">
      <div className="devices-without-place__head">
        <strong>{fmt(t("places.orphans.title"), devices.length)}</strong>
        <span>{t("places.orphans.explain")}</span>
      </div>
      <ul className="devices-without-place__list">
        {devices.map((d) => {
          const running = isRunning(d);
          return (
            <li key={d.id} className="devices-without-place__row" data-testid={`orphan-device-${d.id}`}>
              <span className="devices-without-place__name">{d.label}</span>
              {running && <span className="devices-without-place__running">{t("places.orphans.running")}</span>}
              {canRemove && (
                <Button
                  type="button"
                  variant="secondary"
                  className="devices-without-place__remove"
                  disabled={running || removing !== null || !settled}
                  title={running ? t("places.orphans.runningHint") : t("places.orphans.remove")}
                  onClick={() => void remove(d)}
                  data-testid={`orphan-device-remove-${d.id}`}
                >
                  {t("places.orphans.remove")}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default DevicesWithoutPlace;
