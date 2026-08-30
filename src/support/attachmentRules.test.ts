import { describe, expect, test } from "vitest";
import {
  SUPPORT_MAX_FILES,
  SUPPORT_MAX_FILE_BYTES,
  SUPPORT_MAX_TOTAL_BYTES,
  checkAttachments,
  formatSize,
  hasProblem,
} from "./attachmentRules";

/**
 * These numbers are the server's, restated early enough to be useful. Each
 * test is a way an upload fails today — silently, because PHP discards an
 * over-sized file before Laravel can say anything about it.
 */

const file = (name: string, bytes: number): File =>
  ({ name, size: bytes, lastModified: 0 }) as File;

const MB = 1024 * 1024;

describe("checkAttachments", () => {
  test("an ordinary file is fine", () => {
    const [only] = checkAttachments([file("screenshot.png", 2 * MB)]);
    expect(only.problem).toBeNull();
    expect(hasProblem([only])).toBe(false);
  });

  test("over the per-file limit is refused, and the message names the limit", () => {
    const [big] = checkAttachments([file("video.mp4", SUPPORT_MAX_FILE_BYTES + 1)]);

    expect(big.problem).toEqual({ kind: "too_large", limitMb: 20 });
  });

  test("exactly at the limit is allowed — the rule is 'over', not 'near'", () => {
    const [edge] = checkAttachments([file("exact.bin", SUPPORT_MAX_FILE_BYTES)]);
    expect(edge.problem).toBeNull();
  });

  test("an empty file is refused: that is a failed read, not a file", () => {
    const [empty] = checkAttachments([file("broken.pdf", 0)]);
    expect(empty.problem).toEqual({ kind: "empty" });
  });

  test("the good files in a mixed selection stay good", () => {
    const checked = checkAttachments([
      file("document.pdf", MB),
      file("big-video.mp4", 30 * MB),
      file("image.png", 2 * MB),
    ]);

    expect(checked[0].problem).toBeNull();
    expect(checked[1].problem?.kind).toBe("too_large");
    expect(checked[2].problem).toBeNull();
    // One bad file is enough to stop the message.
    expect(hasProblem(checked)).toBe(true);
  });

  test("past the tenth file, the extras are the ones marked", () => {
    const many = Array.from({ length: SUPPORT_MAX_FILES + 2 }, (_, i) => file(`f${i}.png`, 1024));
    const checked = checkAttachments(many);

    expect(checked.slice(0, SUPPORT_MAX_FILES).every((c) => c.problem === null)).toBe(true);
    expect(checked[SUPPORT_MAX_FILES].problem).toEqual({ kind: "too_many", limit: SUPPORT_MAX_FILES });
  });

  test("a batch that is individually fine but too heavy together is caught", () => {
    // Three 19MB files: each under the per-file limit, 57MB in total.
    const checked = checkAttachments([
      file("a.zip", 19 * MB),
      file("b.zip", 19 * MB),
      file("c.zip", 19 * MB),
    ]);

    expect(checked[0].problem).toBeNull();
    expect(checked[1].problem).toBeNull();
    // The one that pushes it over is the one marked — so the operator knows
    // which to drop, rather than being told the whole batch is wrong.
    expect(checked[2].problem).toEqual({ kind: "total_too_large", limitMb: 50 });
  });

  test("a file refused for its own size does not push its neighbours over the total", () => {
    const checked = checkAttachments([
      file("huge.mov", 40 * MB),   // refused on its own
      file("small.png", 2 * MB),   // must remain fine
    ]);

    expect(checked[0].problem?.kind).toBe("too_large");
    expect(checked[1].problem).toBeNull();
  });

  test("the limits are the server's", () => {
    // If these drift, the panel starts promising something the server refuses.
    expect(SUPPORT_MAX_FILE_BYTES).toBe(20 * MB);   // Laravel `max:20480`
    expect(SUPPORT_MAX_FILES).toBe(10);             // Laravel `array|max:10`
    expect(SUPPORT_MAX_TOTAL_BYTES).toBe(50 * MB);  // nginx client_max_body_size
  });
});

describe("formatSize", () => {
  test("kilobytes below a megabyte, megabytes above", () => {
    expect(formatSize(400)).toBe("1 KB");
    expect(formatSize(200 * 1024)).toBe("200 KB");
    expect(formatSize(3.5 * MB)).toBe("3.5 MB");
  });
});
