export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  context: string;
  level: LogLevel;
  [key: string]: any;
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
  args?: any[];
  [key: string]: any;
}

export interface LoggerOptions {
  level?: LogLevel;
  context?: string;
  formatters?: {
    level?: (label: string) => Record<string, any>;
    [key: string]: any;
  };
  redact?: {
    paths: string[];
    remove: boolean;
  };
  transport?: {
    target: string;
    options: Record<string, any>;
  };
}

export interface LogMethod {
  (msg: string, ...args: any[]): void;
  (obj: object, msg?: string, ...args: any[]): void;
}

export interface Logger {
  debug: LogMethod;
  info: LogMethod;
  warn: LogMethod;
  error: LogMethod;
  child(bindings: Record<string, any>): Logger;
  setLevel(level: LogLevel): void;
  logExecution<T>(methodName: string, operation: () => Promise<T>): Promise<T>;
} 