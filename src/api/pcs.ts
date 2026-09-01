import { IPcApi } from "@/types/sessions";
import { Lang } from "@/i18n/translations";
import { PcKind } from "@/types/pc";
import { request } from "./client";

/**
 * `source_locale` on both bodies is the language the staff member typed `label`
 * in. The backend treats that locale as the source of truth and
 * machine-translates the others — it never writes back into it. Omitted by
 * older panel builds, which the backend falls back to its configured default
 * for.
 */
export interface CreatePcBody {
  branch_id: number;
  place_id?: number | null;
  label: string;
  kind?: PcKind;
  hourly_rate?: number | null;
  mac_address?: string | null;
  source_locale?: Lang;
}

export interface UpdatePcBody {
  place_id?: number | null;
  label?: string;
  kind?: PcKind;
  hourly_rate?: number | null;
  mac_address?: string | null;
  source_locale?: Lang;
}

/**
 * Devices of a branch, optionally narrowed to one kind.
 *
 * The Computers section passes `kind: "pc"`. Every place owns a device —
 * `gaming_sessions.pc_id` is NOT NULL, so a place without one could not be
 * billed at all — but a console's device is not a computer: no agent, no
 * pairing token, no MAC, nothing an operator ever does with it. Listing it
 * under Computers only invited someone to "fix" a row working exactly as
 * intended.
 *
 * The sessions board deliberately asks WITHOUT a kind (see `api/sessions.ts`):
 * it needs every device, consoles included, or they could not be billed.
 */
export const apiListPcsForBranch = (branchId: number, kind?: PcKind) =>
  request<{ data: IPcApi[] }>("/pcs", {
    params: { branch_id: branchId, ...(kind ? { kind } : {}) },
  });

/**
 * Every device of a kind across the venues this account may see.
 *
 * Same reasoning as the sessions listing: `branch_id` is optional and the scope
 * is the server's, so this is the caller's own branches and nothing else. The
 * console watcher needs it because a console can be switched on in a venue
 * nobody is currently looking at.
 */
export const apiListPcsEverywhere = (kind?: PcKind) =>
  request<{ data: IPcApi[] }>("/pcs", { params: { ...(kind ? { kind } : {}) } });

export const apiCreatePc = (body: CreatePcBody) =>
  request<{ pc: IPcApi }>("/pcs", { method: "POST", body });

export const apiUpdatePc = (id: number, body: UpdatePcBody) =>
  request<{ pc: IPcApi }>(`/pcs/${id}`, { method: "PUT", body });

export const apiDeletePc = (id: number) =>
  request<{ message: string }>(`/pcs/${id}`, { method: "DELETE" });

export const apiRotatePcToken = (id: number) =>
  request<{ pc: IPcApi }>(`/pcs/${id}/rotate-token`, { method: "POST" });

/**
 * Turn a console on, or send it to rest, without touching its session.
 *
 * Rest mode is the only "off" a PlayStation has over the network — the protocol
 * carries no shutdown — so this is honest about being a rest, not a promise of
 * a dark console.
 *
 * The endpoint records the venue's intent; the datagram itself leaves from this
 * machine, because only a panel on the venue's own LAN can reach a console.
 * Branch-scoped on the backend for both staff roles: a device of another branch
 * is refused whatever id is sent.
 */
export const apiSetConsolePower = (id: number, state: "on" | "off") =>
  request<{ pc: IPcApi }>(`/pcs/${id}/power`, { method: "POST", body: { state } });

/**
 * Point a place's console device at a physical PlayStation found on the LAN.
 *
 * The identity is the console's own `host-id`; the address is a hint for the
 * next probe and may be omitted. Owner-level on the backend (`places.manage`)
 * and branch-scoped — a manager gets 403, and so does an owner reaching into
 * another company's branch.
 */
export const apiBindConsole = (id: number, console_host_id: string, console_address?: string | null) =>
  request<{ pc: IPcApi }>(`/pcs/${id}/console`, {
    method: "POST",
    body: { console_host_id, ...(console_address ? { console_address } : {}) },
  });

/** Forget the console. Leaves the device, its place and its history alone. */
export const apiUnbindConsole = (id: number) =>
  request<{ pc: IPcApi }>(`/pcs/${id}/console`, { method: "DELETE" });

export interface WakeResult {
  message: string;
  mac?: string;
  sent_packets?: number;
  errors?: string[];
  note?: string;
}

export const apiWakePc = (id: number) =>
  request<WakeResult>(`/pcs/${id}/wake`, { method: "POST" });

/** Persist the sessions-board drag order — `order` is device ids, front to back. */
export const apiReorderPcs = (branch_id: number, order: number[]) =>
  request<{ ok: boolean }>("/pcs/reorder", { method: "POST", body: { branch_id, order } });
