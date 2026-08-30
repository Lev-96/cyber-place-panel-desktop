import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { useAsync } from "@/hooks/useAsync";
import { tr } from "@/i18n/translated";
import { useLang } from "@/i18n/LanguageContext";
import { pcRepository } from "@/repositories/PcRepository";
import { PS5_STATE_LOOK } from "@/ps5/stateLook";
import { ps5DiscoveryAvailable, usePs5Discovery, type Ps5Console } from "@/ps5/usePs5Discovery";
import { IPcApi } from "@/types/sessions";
import { useEffect, useState } from "react";

interface Props {
  branchId: number;
  onClose: () => void;
}

/**
 * Find the PlayStations on this club's network, and say which place each one is.
 *
 * The finding half runs on this machine — the manager's computer is in the room
 * with the consoles and the backend is in a datacentre, so nothing on the
 * server could answer the question. The saying-which-place half is the
 * opposite: it has to be remembered centrally, or every panel of the branch
 * would act on whatever its own last sweep happened to see first.
 *
 * Only PlayStation places are offered. `pcs.kind` says `ps` for every device
 * without a kiosk agent — a console, and equally a ping-pong table — so the
 * list is narrowed by the platform of the place each device serves
 * (`PcRepository.listConsoleDevices`). The backend refuses the mistake too;
 * this is what keeps it from being offered.
 *
 * Binding is owner-level, and the backend says so as well (`places.manage`).
 * This dialog is only reachable by a role that holds it, but a button is not
 * what enforces a permission.
 */
const ConsolePicker = ({ branchId, onClose }: Props) => {
  const { t, lang } = useLang();
  const { consoles, searching, error, probed, scan } = usePs5Discovery();
  const available = ps5DiscoveryAvailable();
  const devices = useAsync(() => pcRepository.listConsoleDevices(branchId), [branchId]);
  const [busyHostId, setBusyHostId] = useState<string | null>(null);
  /** Per-console choice of place, before the operator presses attach. */
  const [choice, setChoice] = useState<Record<string, number>>({});

  useEffect(() => { if (available) void scan(); }, [available, scan]);

  const boundTo = (hostId: string): IPcApi | undefined =>
    (devices.data ?? []).find((d) => d.console_host_id === hostId);

  const placeLabel = (device: IPcApi): string => {
    const name = tr(device, "label", lang) || device.label;
    return device.place ? `№${device.place.number} · ${name}` : name;
  };

  const attach = async (console_: Ps5Console, deviceId: number) => {
    setBusyHostId(console_.hostId);
    try {
      await pcRepository.bindConsole(deviceId, console_.hostId, console_.address);
      await devices.reload();
    } finally {
      setBusyHostId(null);
    }
  };

  /** Is the protection currently suspended for this device? */
  const maintenanceActive = (device: IPcApi): boolean =>
    Boolean(device.maintenance_until) && Date.parse(device.maintenance_until as string) > Date.now();

  const maintenanceUntilText = (device: IPcApi): string =>
    new Date(device.maintenance_until as string).toLocaleTimeString(undefined, {
      hour: "2-digit", minute: "2-digit", hour12: false,
    });

  const toggleMaintenance = async (device: IPcApi, hostId: string) => {
    setBusyHostId(hostId);
    try {
      // An hour: long enough to update a game, short enough that forgetting is
      // not a hole. The backend caps it at four.
      await (maintenanceActive(device)
        ? pcRepository.stopMaintenance(device.id)
        : pcRepository.startMaintenance(device.id, 60));
      await devices.reload();
    } finally {
      setBusyHostId(null);
    }
  };

  const detach = async (device: IPcApi, hostId: string) => {
    setBusyHostId(hostId);
    try {
      await pcRepository.unbindConsole(device.id);
      await devices.reload();
    } finally {
      setBusyHostId(null);
    }
  };

  /** PlayStation places that have no console yet — the only ones worth offering. */
  const free = (devices.data ?? []).filter((d) => !d.console_host_id);

  /**
   * The attach control, and the three things that can be true instead of it.
   *
   * Loading, empty and failed are different situations with different actions,
   * and collapsing them into one greyed-out dropdown is how an operator ends up
   * waiting for a list that is never coming.
   */
  const attachControl = (console_: Ps5Console) => {
    const busy = busyHostId === console_.hostId;

    if (devices.loading && devices.data === null) {
      return <div className="ps5-row__note"><span className="muted">{t("ps5.bind.loadingPlaces")}</span></div>;
    }

    if (devices.error) {
      return (
        <div className="ps5-row__note">
          <span className="ps5-row__error">{t("ps5.bind.placesFailed")}</span>
          <Button variant="secondary" onClick={() => void devices.reload()}>{t("ps5.bind.retry")}</Button>
        </div>
      );
    }

    if (free.length === 0) {
      // Two ways this happens, and they send the owner to different screens:
      // "they are all taken" means unbind one, "there is no PlayStation place"
      // means create one. One sentence for both would send half of them looking
      // for a place that does not exist.
      return (
        <div className="ps5-row__note">
          <span className="muted">
            {t((devices.data ?? []).length === 0 ? "ps5.bind.noConsolePlaces" : "ps5.bind.noFreePlaces")}
          </span>
        </div>
      );
    }

    return (
      <div className="ps5-attach">
        {/* A native select on purpose. Its popup is drawn by the operating
            system, so it cannot be clipped by this modal's scroll container,
            it scrolls and keyboard-navigates the way the OS does, and it looks
            right on Windows and on Linux without us reimplementing either. The
            closed control is ours: fixed width, one line, ellipsis. */}
        <div className="ps5-select">
          <select
            aria-label={t("ps5.bind.choosePlace")}
            value={choice[console_.hostId] ?? ""}
            disabled={busy}
            onChange={(e) => setChoice((c) => ({ ...c, [console_.hostId]: Number(e.target.value) }))}
          >
            <option value="">{t("ps5.bind.choosePlace")}</option>
            {free.map((d) => (
              <option key={d.id} value={d.id}>{placeLabel(d)}</option>
            ))}
          </select>
          <span className="ps5-select__chevron" aria-hidden>▾</span>
        </div>
        <Button
          disabled={busy || !choice[console_.hostId]}
          onClick={() => void attach(console_, choice[console_.hostId])}
        >
          {t("ps5.bind.attach")}
        </Button>
      </div>
    );
  };

  return (
    <Modal open onClose={onClose}>
      <div className="card col ps5-dialog">
        <div>
          <h2 style={{ margin: 0 }}>{t("ps5.discover.title")}</h2>
          <span className="muted" style={{ fontSize: 12 }}>{t("ps5.discover.hint")}</span>
        </div>

        {/* In a browser, or against an older desktop build, the bridge is not
            there. Saying so beats a button that silently does nothing. */}
        {!available ? (
          <div className="error">{t("ps5.discover.desktopOnly")}</div>
        ) : (
          <>
            {searching && consoles === null && <ListSkeleton rows={3} />}

            {consoles !== null && consoles.length === 0 && !searching && (
              <div className="col" style={{ gap: 8 }}>
                <div className="muted" style={{ fontSize: 13 }}>{t("ps5.discover.none")}</div>
                <div className="muted" style={{ fontSize: 11 }}>
                  {t("ps5.discover.probed")}: <span className="mono">{probed.join(", ")}</span>
                </div>
              </div>
            )}

            {consoles !== null && consoles.length > 0 && (
              <div className="ps5-list">
                {consoles.map((console_) => {
                  const look = PS5_STATE_LOOK[console_.state];
                  const bound = boundTo(console_.hostId);
                  const busy = busyHostId === console_.hostId;
                  return (
                    <div key={console_.hostId} className="ps5-row">
                      {/* Identity on its own line, the control underneath.
                          Side by side, a console named by its owner and a place
                          named by its owner fight for the same row and both end
                          up unreadable. */}
                      <div className="ps5-row__head">
                        <span className="ps5-row__dot" style={{ background: look.dot }} aria-hidden />
                        <span className="ps5-row__name" title={console_.name}>{console_.name}</span>
                        <span className="ps5-row__state muted">{t(look.key)}</span>
                      </div>
                      <div className="ps5-row__meta muted">
                        {console_.type} · {console_.address}
                        {console_.systemVersion ? ` · ${console_.systemVersion}` : ""}
                        {" · "}
                        {/* The identity a place is bound to — shown so two
                            identical consoles can be told apart. */}
                        <span className="mono">{console_.hostId}</span>
                      </div>

                      {bound ? (
                        <>
                          <div className="ps5-attach">
                            <span className="ps5-bound" title={placeLabel(bound)}>{placeLabel(bound)}</span>
                            <Button variant="secondary" disabled={busy} onClick={() => void detach(bound, console_.hostId)}>
                              {t("ps5.bind.detach")}
                            </Button>
                          </div>
                          {/* Maintenance sits with the binding rather than on
                              the board: it is something the owner sets up once
                              before working on a console, not a control the
                              shift reaches for. */}
                          <div className="ps5-attach">
                            <span className="muted" style={{ fontSize: 11, flex: "1 1 160px", minWidth: 0 }}>
                              {maintenanceActive(bound)
                                ? t("ps5.maintenance.until").replace("{t}", maintenanceUntilText(bound))
                                : t("ps5.maintenance.hint")}
                            </span>
                            <Button
                              variant="secondary"
                              disabled={busy}
                              onClick={() => void toggleMaintenance(bound, console_.hostId)}
                            >
                              {maintenanceActive(bound) ? t("ps5.maintenance.stop") : t("ps5.maintenance.start")}
                            </Button>
                          </div>
                        </>
                      ) : attachControl(console_)}
                    </div>
                  );
                })}
              </div>
            )}

            {error && error !== "unavailable" && <div className="error">{error}</div>}
          </>
        )}

        <div className="row-between">
          <Button variant="secondary" onClick={onClose}>{t("action.close")}</Button>
          {available && (
            <Button onClick={() => void scan()} disabled={searching}>
              {searching ? t("ps5.discover.scanning") : t("ps5.discover.rescan")}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default ConsolePicker;
