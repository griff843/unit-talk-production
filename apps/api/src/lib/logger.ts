// Stub logger for type-checking
// TODO: Implement proper logger or use shared logger package

export interface Logger {
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  debug(message: string, ...args: any[]): void;
}

export const logger: Logger = {
  info: (message: string, ...args: any[]) => console.log(message, ...args),
  warn: (message: string, ...args: any[]) => console.warn(message, ...args),
  error: (message: string, ...args: any[]) => console.error(message, ...args),
  debug: (message: string, ...args: any[]) => console.debug(message, ...args),
};

export default logger;
