import { request } from "./client";

/**
 * In-app support: the venue's side of a conversation whose other side is a
 * support admin reading it in Telegram.
 *
 * The panel never talks to Telegram — it talks to our backend, which owns the
 * history and the delivery. That is why a message has a `delivery` of its own:
 * it exists here the moment it is written, and whether it reached support yet
 * is a separate fact the screen can show honestly.
 */

export type SupportSender = "staff" | "support";

/** Whether the backend has managed to hand this to Telegram. */
export type SupportDelivery = "queued" | "sent" | "failed" | "not_applicable";

export interface ISupportAttachment {
  id: number;
  original_name: string;
  mime: string | null;
  size: number;
  /** Path on the public disk — render it through `storageUri()`. */
  path: string;
}

export interface ISupportMessage {
  id: number;
  conversation_id: number;
  sender: SupportSender;
  sender_name: string | null;
  sender_role: string | null;
  body: string | null;
  delivery: SupportDelivery;
  delivery_error: string | null;
  read_at: string | null;
  created_at: string | null;
  attachments: ISupportAttachment[];
}

export interface ISupportConversation {
  id: number;
  reference: string;
  status: "open" | "closed";
  branch_id: number;
  company_id: number | null;
  branch_address: string | null;
  branch_city: string | null;
  company_name: string | null;
  logo_path: string | null;
  unread: number;
  last_message_at: string | null;
}

export interface ISupportThread {
  conversation: ISupportConversation;
  messages: ISupportMessage[];
}

export const apiSupportConversations = (branchId?: number) =>
  request<{ data: ISupportConversation[] }>("/support/conversations", {
    params: branchId ? { branch_id: branchId } : undefined,
  });

/**
 * Open the branch's thread, creating it on first use.
 *
 * POST rather than GET because the first call for a branch WRITES — a GET that
 * creates a row is a GET something will eventually prefetch.
 */
export const apiOpenSupportConversation = (branchId: number) =>
  request<ISupportThread>("/support/conversations", {
    method: "POST",
    body: { branch_id: branchId },
  });

export const apiSupportThread = (conversationId: number) =>
  request<ISupportThread>(`/support/conversations/${conversationId}`);

/**
 * Say something, with or without files.
 *
 * Multipart always: a message may carry attachments, and one shape for both
 * cases is one code path to get wrong instead of two.
 */
export const apiSendSupportMessage = (
  conversationId: number,
  body: string,
  files: File[],
) => {
  const form = new FormData();
  if (body) form.append("body", body);
  for (const file of files) form.append("attachments[]", file);

  return request<{ message: ISupportMessage }>(
    `/support/conversations/${conversationId}/messages`,
    { method: "POST", body: form },
  );
};

export const apiMarkSupportRead = (conversationId: number) =>
  request<{ ok: boolean }>(`/support/conversations/${conversationId}/read`, { method: "POST" });
