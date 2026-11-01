import log from "electron-log";

/**
 * The console watcher's record, kept in a file of its own (2026-11-02).
 *
 * The controller and the watcher print `[ps5]` lines — every command, how it
 * ended and how long it took, every state change — but only to the page's
 * console, which a packaged build shows nobody. A slow evening at a venue left
 * nothing to measure. Those lines now also go to `ps5.log` in the app's
 * user-data `logs` folder, which the owner can send.
 *
 * Bounded (electron-log rolls the file over at the size below and keeps one
 * old copy), and fed only lines that were already being printed: none of them
 * carries a key or a token.
 */
export const PS5_LOG_PREFIX = "[ps5]";
export const PS5_LOG_MAX_BYTES = 5 * 1024 * 1024;
/** One line is a few hundred characters; anything far longer is not one of ours. */
export const PS5_LOG_MAX_LINE = 2_000;

export const isPs5Line = (message: unknown): message is string =>
  typeof message === "string" && message.startsWith(PS5_LOG_PREFIX);

let ps5Logger: ReturnType<typeof log.create> | null = null;

const logger = () => {
  if (ps5Logger) return ps5Logger;
  ps5Logger = log.create({ logId: "ps5" });
  ps5Logger.transports.file.fileName = "ps5.log";
  ps5Logger.transports.file.maxSize = PS5_LOG_MAX_BYTES;
  ps5Logger.transports.file.level = "info";
  ps5Logger.transports.console.level = false;
  return ps5Logger;
};

/** Never throws: a log that cannot be written must not touch the console it describes. */
export const writePs5Line = (line: string): void => {
  try {
    logger().info(line.slice(0, PS5_LOG_MAX_LINE));
  } catch {
    // Disk full, folder gone: the line is dropped, nothing else happens.
  }
};
