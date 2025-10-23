import { Duration } from '@temporalio/common';
export interface RetryPolicyOptions {
    maximumAttempts?: number;
    initialInterval?: Duration;
    maximumInterval?: Duration;
    backoffCoefficient?: number;
    nonRetryableErrorTypes?: string[];
}
export declare class RetryPolicy {
    private readonly maximumAttempts;
    private readonly initialInterval;
    private readonly maximumInterval;
    private readonly backoffCoefficient;
    private readonly nonRetryableErrorTypes;
    constructor(options?: RetryPolicyOptions);
    execute<T>(operation: () => Promise<T>): Promise<T>;
    getPolicy(): RetryPolicyOptions;
}
//# sourceMappingURL=retryPolicy.d.ts.map