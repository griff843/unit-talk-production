"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RetryPolicy = void 0;
const common_1 = require("@temporalio/common");
class RetryPolicy {
    constructor(options = {}) {
        this.maximumAttempts = options.maximumAttempts ?? 3;
        this.initialInterval = (0, common_1.msToNumber)(options.initialInterval ?? '1s');
        this.maximumInterval = (0, common_1.msToNumber)(options.maximumInterval ?? '5m');
        this.backoffCoefficient = options.backoffCoefficient ?? 2;
        this.nonRetryableErrorTypes = new Set(options.nonRetryableErrorTypes ?? []);
    }
    async execute(operation) {
        let attempts = 0;
        let lastError = null;
        let interval = this.initialInterval;
        while (attempts < this.maximumAttempts) {
            try {
                return await operation();
            }
            catch (error) {
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
    getPolicy() {
        return {
            maximumAttempts: this.maximumAttempts,
            initialInterval: this.initialInterval,
            maximumInterval: this.maximumInterval,
            backoffCoefficient: this.backoffCoefficient,
            nonRetryableErrorTypes: Array.from(this.nonRetryableErrorTypes)
        };
    }
}
exports.RetryPolicy = RetryPolicy;
