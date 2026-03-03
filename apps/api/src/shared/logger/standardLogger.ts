import { Logger, LogLevel, createStandardLogger } from '../../utils/logger';

export { Logger, LogLevel, createStandardLogger };

// Re-export the decorators
export function withLogging<T extends { new (...args: any[]): {} }>(constructor: T) {
  return class extends constructor {
    public logger: Logger;

    constructor(...args: any[]) {
      super(...args);
      this.logger = createStandardLogger({
        level: (process.env.LOG_LEVEL as LogLevel) || 'info',
      });
    }
  };
}

// Decorator for logging method execution
export function logMethod(operationName: string) {
  return function (_target: any, _propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]): Promise<void> {
      const logger = (this as any).logger || createStandardLogger();

      try {
        logger.info(`Starting ${operationName}`, { args });
        const result = await originalMethod.apply(this, args);
        logger.info(`Completed ${operationName}`, { result });
        return result;
      } catch (error) {
        logger.error(`Error in ${operationName}`, {
          error: error instanceof Error ? error.message : String(error),
          args,
        });
        throw error;
      }
    };

    return descriptor;
  };
}
