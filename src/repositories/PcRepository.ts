import {
  apiBindConsole,
  apiCreatePc,
  apiDeletePc,
  apiListPcsForBranch,
  apiRotatePcToken,
  apiUnbindConsole,
  apiUpdatePc,
  CreatePcBody,
  UpdatePcBody,
} from "@/api/pcs";
import { friendlyMutation, orFallback } from "@/api/fallback";
import { withToast } from "@/ui/notify";
import { IPcApi } from "@/types/sessions";
import { PC_KIND } from "@/types/pc";
import { platformGroup } from "@/utils/platform";
import { apiStartMaintenance, apiStopMaintenance } from "@/api/ps5";

export class PcRepository {
  /**
   * The Computers section's list: agent-backed machines only.
   *
   * A console place owns a device too — it has to, sessions cannot exist
   * without one — but it is not a computer and never belongs on this screen.
   * The sessions board fetches its own, unfiltered list (SessionRepository),
   * so narrowing here cannot hide a console from billing.
   */
  async listByBranch(branchId: number): Promise<IPcApi[]> {
    return orFallback(apiListPcsForBranch(branchId, PC_KIND.Pc).then((r) => r.data), []);
  }
  async create(body: CreatePcBody): Promise<IPcApi> {
    return withToast("pc", "created", () => friendlyMutation(apiCreatePc(body).then((r) => r.pc)));
  }
  async update(id: number, body: UpdatePcBody): Promise<IPcApi> {
    return withToast("pc", "updated", () => friendlyMutation(apiUpdatePc(id, body).then((r) => r.pc)));
  }
  async remove(id: number): Promise<void> {
    await withToast("pc", "deleted", () => friendlyMutation(apiDeletePc(id)));
  }
  async rotateToken(id: number): Promise<IPcApi> {
    return friendlyMutation(apiRotatePcToken(id).then((r) => r.pc));
  }

  /**
   * The devices a physical PlayStation can be attached to.
   *
   * Two filters, because `pcs.kind` alone answers the wrong question. It says
   * `ps` for every device with no agent — which is a PS5, and equally a
   * ping-pong table and a poker table. What the device actually IS lives on the
   * platform of the place it serves, so the list is narrowed again by that.
   *
   * The backend refuses a non-PlayStation place outright; this filter is what
   * stops the operator being offered the mistake in the first place.
   */
  async listConsoleDevices(branchId: number): Promise<IPcApi[]> {
    const devices = await orFallback(apiListPcsForBranch(branchId, PC_KIND.Ps).then((r) => r.data), []);

    return devices.filter((d) => d.place && platformGroup(d.place.platform) === "ps");
  }

  async bindConsole(id: number, hostId: string, address?: string | null): Promise<IPcApi> {
    return withToast("pc", "updated", () =>
      friendlyMutation(apiBindConsole(id, hostId, address).then((r) => r.pc)));
  }

  async unbindConsole(id: number): Promise<IPcApi> {
    return withToast("pc", "updated", () =>
      friendlyMutation(apiUnbindConsole(id).then((r) => r.pc)));
  }

  /**
   * Suspend the "a console with no session must be asleep" rule for a while.
   *
   * Owner-level on the backend. The window is minutes, not a switch: a flag is
   * what somebody forgets to turn off, and a console permanently exempt is the
   * protection quietly disabled.
   */
  async startMaintenance(id: number, minutes: number): Promise<IPcApi> {
    return withToast("pc", "updated", () =>
      friendlyMutation(apiStartMaintenance(id, minutes).then((r) => r.pc)));
  }

  async stopMaintenance(id: number): Promise<IPcApi> {
    return withToast("pc", "updated", () =>
      friendlyMutation(apiStopMaintenance(id).then((r) => r.pc)));
  }

  /**
   * Remember a console's new address without telling the operator anything.
   *
   * A console that reappears on a new DHCP lease is not news — it is the
   * watcher doing its job — so this is the one binding call that raises no
   * toast and swallows its failure: the address is a cache, and a panel that
   * fails to write it back simply sweeps again next time.
   */
  async rememberConsoleAddress(id: number, hostId: string, address: string): Promise<void> {
    try {
      await apiBindConsole(id, hostId, address);
    } catch {
      // Deliberately silent — see above.
    }
  }
}

export const pcRepository = new PcRepository();
