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

export const apiCreatePc = (body: CreatePcBody) =>
  request<{ pc: IPcApi }>("/pcs", { method: "POST", body });

export const apiUpdatePc = (id: number, body: UpdatePcBody) =>
  request<{ pc: IPcApi }>(`/pcs/${id}`, { method: "PUT", body });

export const apiDeletePc = (id: number) =>
  request<{ message: string }>(`/pcs/${id}`, { method: "DELETE" });

export const apiRotatePcToken = (id: number) =>
  request<{ pc: IPcApi }>(`/pcs/${id}/rotate-token`, { method: "POST" });

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
