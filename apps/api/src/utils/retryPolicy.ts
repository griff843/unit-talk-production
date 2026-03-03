import { Duration, msToNumber } from '@temporalio/common';

export interface RetryPolicyOptions {
  maximumAttempts?: number;
  initialInterval?: Duration;
  maximumInterval?: Duration;
  backoffCoefficient?: number;
  nonRetryableErrorTypes?: string[];
}

export class RetryPolicy {
  private readonly maximumAttempts: number;
  private readonly initialInterval: number;
  private readonly maximumInterval: number;
  private readonly backoffCoefficient: number;
  private readonly nonRetryableErrorTypes: Set<string>;

  constructor(options: RetryPolicyOptions = {}) {
    this.maximumAttempts = options.maximumAttempts ?? 3;
    this.initialInterval = msToNumber(options.initialInterval ?? '1s');
    this.maximumInterval = msToNumber(options.maximumInterval ?? '5m');
    this.backoffCoefficient = options.backoffCoefficient ?? 2;
    this.nonRetryableErrorTypes = new Set(options.nonRetryableErrorTypes ?? []);
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    let attempts = 0;
    let lastError: Error | null = null;
    let interval = this.initialInterval;

    while (attempts < this.maximumAttempts) {
      try {
        return await operation();
      } catch (error) {
        if (error instanceof Error && this.nonRetryableErrorTypes.has(error.constructor.name)) {
          throw error;
        }

        lastError = error instanceof Error ? error : new Error(String(error));
        attempts++;
        if (attempts === this.maximumAttempts) {
          break;
        }

        await new Promise(resolve => setTimeout(resolve, interval));
        interval = Math.min(interval * this.backoffCoefficient, this.maximumInterval);
      }
    }

    throw lastError ?? new Error('Maximum retry attempts reached');
  }

  getPolicy(): RetryPolicyOptions {
    return {
      maximumAttempts: this.maximumAttempts,
      initialInterval: this.initialInterval,
      maximumInterval: this.maximumInterval,
      backoffCoefficient: this.backoffCoefficient,
      nonRetryableErrorTypes: Array.from(this.nonRetryableErrorTypes),
    };
  }
}
