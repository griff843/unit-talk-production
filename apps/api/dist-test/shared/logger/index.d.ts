import { LogLevel, LogMethod } from './types';
export declare const usedLogLevels: {
    readonly debug: 20;
    readonly info: 30;
    readonly warn: 40;
    readonly error: 50;
};
export declare class Logger {
    private readonly context;
    private logger;
    constructor(context: string, level?: LogLevel);
    debug(msgOrObj: string | object, msgOrArgs?: string | unknown, ...args: unknown[]): void;
    info(msgOrObj: string | object, msgOrArgs?: string | unknown, ...args: unknown[]): void;
    warn(msgOrObj: string | object, msgOrArgs?: string | unknown, ...args: unknown[]): void;
    error(msgOrObj: string | object, msgOrArgs?: string | unknown, ...args: unknown[]): void;
    logExecution<T>(methodName: string, operation: () => Promise<T>): Promise<T>;
    child(bindings: Record<string, unknown>): Logger;
    setLevel(level: LogLevel): void;
}
export declare const logger: Logger;
export * from './types';
export interface LoggerInterface {
    debug: LogMethod;
    info: LogMethod;
    warn: LogMethod;
    error: LogMethod;
    child(bindings: Record<string, unknown>): LoggerInterface;
    setLevel?(level: LogLevel): void;
}
//# sourceMappingURL=index.d.ts.map