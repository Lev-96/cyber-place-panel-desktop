type Level = "debug" | "info" | "warn" | "error";

interface ILogger {
  debug(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

const noop = () => {};

class SilentLogger implements ILogger {
  debug = noop;
  info = noop;
  warn = noop;
  error = noop;
}

class ConsoleLogger implements ILogger {
  private write(level: Level, args: unknown[]) {
    const fn = console[level] ?? console.log;
    fn.call(console, "[cyberplace]", ...args);
  }
  debug(...args: unknown[]) { this.write("debug", args); }
  info(...args: unknown[])  { this.write("info", args); }
  warn(...args: unknown[])  { this.write("warn", args); }
  error(...args: unknown[]) { this.write("error", args); }
}

const isDev = import.meta.env.DEV === true;

export const logger: ILogger = isDev ? new ConsoleLogger() : new SilentLogger();
