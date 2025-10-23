"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseAdapter = void 0;
class BaseAdapter {
    constructor() {
        this.rateLimit = 4; // Default 4 RPS
        this.maxRetries = 3;
        this.retryDelay = 1000; // Start with 1 second
    }
    getRateLimit() {
        return this.rateLimit;
    }
    async retryWithBackoff(fn, attempt = 1) {
        try {
            return await fn();
        }
        catch (error) {
            if (attempt >= this.maxRetries) {
                throw error;
            }
            const delay = this.retryDelay * Math.pow(2, attempt - 1);
            await this.sleep(delay);
            return this.retryWithBackoff(fn, attempt + 1);
        }
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    normalizePlayerName(name) {
        return name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    }
}
exports.BaseAdapter = BaseAdapter;
