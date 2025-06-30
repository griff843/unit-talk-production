import * as winston from 'winston';
export declare const logger: winston.Logger;
type LogContext = Record<string, any>;
export declare const logWithContext: {
    error: (message: string, error?: any, context?: LogContext) => void;
    warn: (message: string, context?: LogContext) => void;
    info: (message: string, context?: LogContext) => void;
    debug: (message: string, context?: LogContext) => void;
    discordEvent: (event: string, data: any, context?: LogContext) => void;
    commandUsage: (command: string, userId: string, guildId: string, success: boolean) => void;
    apiCall: (endpoint: string, method: string, statusCode: number, responseTime: number) => void;
    dbOperation: (operation: string, table: string, success: boolean, duration?: number) => void;
    security: (event: string, userId?: string, details?: any) => void;
};
export declare const redactSensitiveInfo: (obj: any) => any;
export default logger;
//# sourceMappingURL=logger.d.ts.map