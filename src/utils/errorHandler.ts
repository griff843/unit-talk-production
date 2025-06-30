import { logger } from '../services/logging';
import { Logger } from '../agents/BaseAgent/types';

export function handleError(error: unknown, context = '') {
  logger.error({ error, context }, `Error: ${context}`);
}

export class ErrorHandler {
  constructor(private logger: Logger) {}

  handleError(error: Error, context?: Record<string, unknown>): void {
    this.logger.error('Error occurred', { error: error.message, ...context });
  }

  async withRetry<T>(fn: () => Promise<T>, operation: string): Promise<T> {
    const maxRetries = 3;
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.logger.warn(`${operation} failed (attempt ${attempt}/${maxRetries})`, { error: lastError.message });

        if (attempt === maxRetries) {
          break;
        }

        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }

    if (!lastError) {
      lastError = new Error(`${operation} failed after ${maxRetries} attempts`);
    }

    this.handleError(lastError, { operation, attempts: maxRetries });
    throw lastError;
  }
}