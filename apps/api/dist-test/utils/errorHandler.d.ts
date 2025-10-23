import { Logger } from '../agents/BaseAgent/types';
export declare function handleError(error: unknown, context?: string): void;
export declare class ErrorHandler {
    private logger;
    constructor(logger: Logger);
    handleError(error: Error, context?: Record<string, unknown>): void;
    withRetry<T>(fn: () => Promise<T>, operation: string): Promise<T>;
}
//# sourceMappingURL=errorHandler.d.ts.map