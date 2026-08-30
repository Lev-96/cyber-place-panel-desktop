import {
  apiMarkSupportRead,
  apiSupportAttachment,
  apiOpenSupportConversation,
  apiSendSupportMessage,
  apiSupportConversations,
  apiSupportThread,
  type ISupportConversation,
  type ISupportMessage,
  type ISupportThread,
} from "@/api/support";
import { friendlyMutation, orFallback } from "@/api/fallback";

/**
 * Support, through the repository layer every other screen here uses.
 *
 * Sending deliberately does NOT go through `withToast`: the Support screen
 * renders the state of each message in the thread itself — sending, sent,
 * failed with a retry — and a toast on top of that would announce twice what
 * the chat already shows.
 */
export class SupportRepository {
  async list(branchId?: number): Promise<ISupportConversation[]> {
    return orFallback(apiSupportConversations(branchId).then((r) => r.data), []);
  }
  async open(branchId: number): Promise<ISupportThread> {
    return friendlyMutation(apiOpenSupportConversation(branchId));
  }
  async thread(conversationId: number): Promise<ISupportThread> {
    return friendlyMutation(apiSupportThread(conversationId));
  }
  async send(conversationId: number, body: string, files: File[]): Promise<ISupportMessage> {
    return friendlyMutation(apiSendSupportMessage(conversationId, body, files).then((r) => r.message));
  }
  /**
   * Save an attachment to the operator's machine.
   *
   * Fetched with the session token and handed to the browser as a blob rather
   * than linked: there is no URL for these files that works without the token,
   * which is the point — the check happens on every single fetch, not once when
   * a link was made.
   */
  async downloadAttachment(attachmentId: number, fallbackName: string): Promise<void> {
    const { blob, filename } = await apiSupportAttachment(attachmentId);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename || fallbackName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Freed on the next tick: revoking before the click is processed cancels
    // the save in Chromium.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  async markRead(conversationId: number): Promise<void> {
    await apiMarkSupportRead(conversationId).catch(() => {
      /* Best effort: an unread badge that clears a moment late is not worth
         an error in front of somebody reading their support chat. */
    });
  }
}

export const supportRepository = new SupportRepository();
