/**
 * What the support desk will accept, decided before anything is uploaded.
 *
 * Every number here is one the SERVER already enforces — this is the same
 * answer, given early enough to be useful:
 *
 *   - 20 MB per file: `attachments.*` is validated `max:20480` by
 *     `SupportController`, PHP's `upload_max_filesize` is set to match, and it
 *     is also Telegram's own ceiling for a document.
 *   - 10 files per message: the controller's `array|max:10`, and PHP's
 *     `max_file_uploads`.
 *   - 50 MB for the whole message: nginx's `client_max_body_size` and PHP's
 *     `post_max_size`. A batch that clears the per-file rule can still exceed
 *     it, and the failure that produces is the ugliest of the three — the
 *     request is cut off before any PHP runs, so there is no sentence from the
 *     server to show.
 *
 * There is deliberately NO format rule: the backend accepts any file, Telegram
 * forwards any file, and inventing a whitelist here would refuse things the
 * product allows. An EMPTY file is refused, because a zero-byte attachment is
 * a failed read on the operator's side rather than a file they meant to send.
 *
 * Kept apart from the screen so the rules can be tested as rules, and so there
 * is one place to change when a limit moves on the server.
 */

export const SUPPORT_MAX_FILE_BYTES = 20 * 1024 * 1024;
export const SUPPORT_MAX_FILES = 10;
export const SUPPORT_MAX_TOTAL_BYTES = 50 * 1024 * 1024;

export type AttachmentProblem =
  | { kind: "too_large"; limitMb: number }
  | { kind: "empty" }
  | { kind: "too_many"; limit: number }
  | { kind: "total_too_large"; limitMb: number };

export interface CheckedFile {
  file: File;
  /** Null when the file is fine. */
  problem: AttachmentProblem | null;
}

const mb = (bytes: number) => Math.round(bytes / (1024 * 1024));

/**
 * Check a whole selection at once.
 *
 * Per-file problems are decided per file; the two collective limits (how many,
 * how much altogether) are reported on the files that push the selection past
 * them, so the operator can see WHICH ones to drop rather than being told the
 * batch is wrong.
 */
export const checkAttachments = (files: File[]): CheckedFile[] => {
  let runningTotal = 0;

  return files.map((file, index) => {
    let problem: AttachmentProblem | null = null;

    if (file.size === 0) {
      problem = { kind: "empty" };
    } else if (file.size > SUPPORT_MAX_FILE_BYTES) {
      problem = { kind: "too_large", limitMb: mb(SUPPORT_MAX_FILE_BYTES) };
    } else if (index >= SUPPORT_MAX_FILES) {
      problem = { kind: "too_many", limit: SUPPORT_MAX_FILES };
    } else {
      // Only files that are otherwise fine count toward the total — a file
      // already refused for its own size must not also push its neighbours
      // over the collective limit.
      runningTotal += file.size;
      if (runningTotal > SUPPORT_MAX_TOTAL_BYTES) {
        problem = { kind: "total_too_large", limitMb: mb(SUPPORT_MAX_TOTAL_BYTES) };
      }
    }

    return { file, problem };
  });
};

export const hasProblem = (checked: CheckedFile[]): boolean =>
  checked.some((c) => c.problem !== null);

/** Human size for a chip: KB under a megabyte, MB above it. */
export const formatSize = (bytes: number): string =>
  bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
