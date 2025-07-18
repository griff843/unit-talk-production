import { Logger } from '../../utils/logger';
import { LogLevel } from '../logger/types';

export { Logger, LogLevel };

// Re-export the decorators
export function withLogging<T extends { new (...args: any[]): {} }>(constructor: T) {
  return class extends constructor {
    public logger: Logger;

    constructor(...args: any[]) {
      super(...args);
      this.logger = new Logger('StandardLogger', {
        level: process.env.LOG_LEVEL as LogLevel || 'info'
      });
    }
  };
}

// Decorator for logging method execution
export function logMethod(operationName: string) {
  return function (_target: any, _propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function(...args: any[]): Promise<void> {
      const instanceLogger = (this as { logger?: Logger }).logger || new Logger('StandardLogger', { level: "info" });

      try {
        instanceLogger.info(`Starting ${operationName}`, { args });
        const result = await originalMethod.apply(this, args);
        instanceLogger.info(`Completed ${operationName}`, { result });
        return result;
      } catch (error) {
        instanceLogger.error(`Error in ${operationName}`, {
          error: error instanceof Error ? error.message : String(error),
          args
        });
        throw error;
      }
    };

    return descriptor;
  };
}