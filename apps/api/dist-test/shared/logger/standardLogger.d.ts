import { Logger, LogLevel, createStandardLogger } from '../../utils/logger';
export { Logger, LogLevel, createStandardLogger };
export declare function withLogging<T extends {
    new (...args: any[]): {};
}>(constructor: T): {
    new (...args: any[]): {
        logger: Logger;
    };
} & T;
export declare function logMethod(operationName: string): (_target: any, _propertyKey: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
//# sourceMappingURL=standardLogger.d.ts.map