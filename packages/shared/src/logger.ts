export type LogLevel = "debug" | "info" | "warn" | "error";

export interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
  child(bindings: Record<string, unknown>): Logger;
}

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function formatLine(
  level: LogLevel,
  message: string,
  bindings: Record<string, unknown>,
  context?: Record<string, unknown>,
): string {
  const payload = {
    ts: new Date().toISOString(),
    level,
    message,
    ...bindings,
    ...context,
  };
  return JSON.stringify(payload);
}

export function createLogger(
  level: LogLevel = "info",
  bindings: Record<string, unknown> = {},
): Logger {
  const min = LEVEL_ORDER[level];

  const write = (lvl: LogLevel, message: string, context?: Record<string, unknown>): void => {
    if (LEVEL_ORDER[lvl] < min) return;
    const line = formatLine(lvl, message, bindings, context);
    if (lvl === "error") {
      console.error(line);
    } else if (lvl === "warn") {
      console.warn(line);
    } else {
      // Structured stdout logging for info/debug — intentional for ops.
      // eslint-disable-next-line no-console
      console.log(line);
    }
  };

  return {
    debug: (message, context) => write("debug", message, context),
    info: (message, context) => write("info", message, context),
    warn: (message, context) => write("warn", message, context),
    error: (message, context) => write("error", message, context),
    child: (childBindings) => createLogger(level, { ...bindings, ...childBindings }),
  };
}
