import {
  apiMarkSupportRead,
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
  async markRead(conversationId: number): Promise<void> {
    await apiMarkSupportRead(conversationId).catch(() => {
      /* Best effort: an unread badge that clears a moment late is not worth
         an error in front of somebody reading their support chat. */
    });
  }
}

export const supportRepository = new SupportRepository();
