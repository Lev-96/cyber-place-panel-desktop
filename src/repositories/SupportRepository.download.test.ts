// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { supportRepository } from "./SupportRepository";

/**
 * Support attachments have no URL that works without the session token — that
 * is the whole point of moving them off the public disk. So the panel cannot
 * link to one; it has to fetch the bytes with the token and hand them to the
 * browser itself, and this pins that it does.
 */

const api = vi.hoisted(() => ({ attachment: vi.fn() }));
vi.mock("@/api/support", () => ({
  apiSupportAttachment: (...a: unknown[]) => api.attachment(...a),
  apiSupportConversations: vi.fn(),
  apiOpenSupportConversation: vi.fn(),
  apiSupportThread: vi.fn(),
  apiSendSupportMessage: vi.fn(),
  apiMarkSupportRead: vi.fn(),
}));

afterEach(() => { vi.restoreAllMocks(); api.attachment.mockReset(); });

describe("SupportRepository.downloadAttachment", () => {
  test("fetches through the API and saves, never through a URL", async () => {
    api.attachment.mockResolvedValue({ blob: new Blob(["x"]), filename: "screenshot.png" });
    const createUrl = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:fake");
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const clicked: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push(`${this.href}|${this.download}`);
    });

    await supportRepository.downloadAttachment(41, "fallback.bin");

    // The id is what travels — no path, no storage host.
    expect(api.attachment).toHaveBeenCalledWith(41);
    expect(createUrl).toHaveBeenCalled();
    expect(clicked).toEqual(["blob:fake|screenshot.png"]);
    // And the anchor does not outlive the save.
    expect(document.querySelector("a")).toBeNull();

    await new Promise((r) => setTimeout(r, 1));
    expect(revoke).toHaveBeenCalledWith("blob:fake");
  });

  test("falls back to the name we know when the server sends none", async () => {
    api.attachment.mockResolvedValue({ blob: new Blob(["x"]), filename: null });
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:fake");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    let saved = "";
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      saved = this.download;
    });

    await supportRepository.downloadAttachment(41, "fallback.bin");

    expect(saved).toBe("fallback.bin");
  });

  test("a refusal reaches the caller rather than saving an error page", async () => {
    api.attachment.mockRejectedValue(Object.assign(new Error("Forbidden"), { status: 403 }));

    await expect(supportRepository.downloadAttachment(41, "x.png")).rejects.toThrow("Forbidden");
  });
});
