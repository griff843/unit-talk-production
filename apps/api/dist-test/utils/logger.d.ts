export type LogLevel = 'error' | 'warn' | 'info' | 'debug';
export interface LogMethod {
    (msg: string, ...args: unknown[]): void;
    (obj: object, msg?: string, ...args: unknown[]): void;
}
export interface Logger {
    error: LogMethod;
    warn: LogMethod;
    info: LogMethod;
    debug: LogMethod;
    log(level: LogLevel, message: string, context?: Record<string, unknown>): void;
    setLevel(level: LogLevel): void;
    activity(activityId: string, status: string, context?: Record<string, unknown>): void;
    child(context: Record<string, unknown>): Logger;
}
export interface LoggerOptions {
    level?: LogLevel;
    filename?: string;
    console?: boolean;
}
export declare class StandardLogger implements Logger {
    private level;
    private filename?;
    private consoleEnabled;
    private logLevels;
    constructor(options?: LoggerOptions);
    private shouldLog;
    private formatMessage;
    private writeLog;
    error: LogMethod;
    warn: LogMethod;
    info: LogMethod;
    debug: LogMethod;
    log(level: LogLevel, message: string, context?: Record<string, unknown>): void;
    setLevel(level: LogLevel): void;
    activity(activityId: string, status: string, context?: Record<string, unknown>): void;
    child(_context: Record<string, unknown>): Logger;
}
export declare function createStandardLogger(options?: LoggerOptions): Logger;
export declare function makeLogger(context?: string): Logger;
export declare function createLogger(context?: string | LoggerOptions): Logger;
export declare const logger: {
    readonly instance: Logger;
    error: (msg: string | object, ...args: unknown[]) => void;
    warn: (msg: string | object, ...args: unknown[]) => void;
    info: (msg: string | object, ...args: unknown[]) => void;
    debug: (msg: string | object, ...args: unknown[]) => void;
    log: (level: LogLevel, message: string, context?: Record<string, unknown>) => void;
    child: (context: Record<string, unknown>) => Logger;
};
//# sourceMappingURL=logger.d.ts.map