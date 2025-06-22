export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  context: string;
  level: LogLevel;
  [key: string]: string | number | boolean | LogLevel | undefined;
}

export interface LogEntry {
  level: LogLevel;
  time: string;
  msg: string;
  context: string;
  error?: {
    message: string;
    stack?: string;
    name: string;
  };
  args?: unknown[];
  [key: string]: string | number | boolean | LogLevel | unknown[] | { message: string; stack?: string; name: string } | undefined;
}

export interface LoggerOptions {
  level?: LogLevel;
  context?: string;
  formatters?: {
    level?: (label: string) => Record<string, unknown>;
    [key: string]: ((label: string) => Record<string, unknown>) | undefined;
  };
  redact?: {
    paths: string[];
    remove: boolean;
  };
  transport?: {
    target: string;
    options: Record<string, unknown>;
  };
}

export interface LogMethod {
  (msg: string, ...args: unknown[]): void;
  (obj: object, msg?: string, ...args: unknown[]): void;
}

export interface Logger {
  debug: LogMethod;
  info: LogMethod;
  warn: LogMethod;
  error: LogMethod;
  child(bindings: Record<string, unknown>): Logger;
  setLevel(level: LogLevel): void;
}