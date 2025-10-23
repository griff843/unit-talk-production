"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LLMCircuitBreaker = void 0;
const logger_1 = require("../shared/logger");
class LLMCircuitBreaker {
    constructor(config = {}) {
        this.requestQueue = [];
        this.processingQueue = false;
        this.state = {
            state: 'CLOSED',
            metrics: {
                failures: 0,
                lastFailure: 0,
                dailyTokens: 0,
                lastReset: Date.now(),
                concurrentRequests: 0,
                totalRequests: 0,
                successfulRequests: 0,
                failedRequests: 0,
                averageLatency: 0
            },
            config: {
                failureThreshold: config.failureThreshold || 5,
                resetTimeout: config.resetTimeout || 60000, // 1 minute
                dailyTokenQuota: config.dailyTokenQuota || 1000000, // 1M tokens
                maxConcurrentRequests: config.maxConcurrentRequests || 50,
                timeoutMs: config.timeoutMs || 30000 // 30 seconds
            },
            lastStateChange: Date.now()
        };
    }
    static getInstance(config) {
        if (!LLMCircuitBreaker.instance) {
            LLMCircuitBreaker.instance = new LLMCircuitBreaker(config);
        }
        return LLMCircuitBreaker.instance;
    }
    getState() {
        return { ...this.state };
    }
    async executeRequest(request, tokenEstimate, fallback) {
        // Check circuit state
        if (this.state.state === 'OPEN') {
            logger_1.logger.warn('Circuit breaker is OPEN, using fallback');
            return fallback ? fallback() : this.handleOpenCircuit();
        }
        // Check token quota
        if (this.state.metrics.dailyTokens + tokenEstimate > this.state.config.dailyTokenQuota) {
            logger_1.logger.warn('Daily token quota exceeded');
            return fallback ? fallback() : this.handleQuotaExceeded();
        }
        // Check concurrent requests
        if (this.state.metrics.concurrentRequests >= this.state.config.maxConcurrentRequests) {
            return this.queueRequest(request, fallback);
        }
        // Execute request with timeout
        try {
            this.state.metrics.concurrentRequests++;
            this.state.metrics.totalRequests++;
            const startTime = Date.now();
            const result = await Promise.race([
                request(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Request timeout')), this.state.config.timeoutMs))
            ]);
            // Update metrics on success
            this.state.metrics.successfulRequests++;
            this.state.metrics.dailyTokens += tokenEstimate;
            this.state.metrics.averageLatency =
                (this.state.metrics.averageLatency * (this.state.metrics.successfulRequests - 1) +
                    (Date.now() - startTime)) / this.state.metrics.successfulRequests;
            // Reset failures in HALF_OPEN state
            if (this.state.state === 'HALF_OPEN') {
                this.closeCircuit();
            }
            return result;
        }
        catch (error) {
            this.handleFailure(error);
            if (fallback) {
                return fallback();
            }
            throw error;
        }
        finally {
            this.state.metrics.concurrentRequests--;
            this.processQueue();
        }
    }
    async queueRequest(request, fallback) {
        return new Promise((resolve, reject) => {
            this.requestQueue.push(async () => {
                try {
                    const result = await this.executeRequest(request, 0, fallback);
                    resolve(result);
                }
                catch (error) {
                    reject(error);
                }
            });
        });
    }
    async processQueue() {
        if (this.processingQueue || this.requestQueue.length === 0) {
            return;
        }
        this.processingQueue = true;
        while (this.requestQueue.length > 0) {
            if (this.state.metrics.concurrentRequests < this.state.config.maxConcurrentRequests) {
                const request = this.requestQueue.shift();
                if (request) {
                    try {
                        await request();
                    }
                    catch (error) {
                        logger_1.logger.error('Error processing queued request:', error);
                    }
                }
            }
            else {
                break;
            }
        }
        this.processingQueue = false;
    }
    handleFailure(error) {
        this.state.metrics.failures++;
        this.state.metrics.failedRequests++;
        this.state.metrics.lastFailure = Date.now();
        logger_1.logger.error('LLM request failed:', error);
        if (this.state.metrics.failures >= this.state.config.failureThreshold) {
            this.openCircuit();
        }
    }
    openCircuit() {
        this.state.state = 'OPEN';
        this.state.lastStateChange = Date.now();
        logger_1.logger.warn('Circuit breaker opened');
        // Schedule transition to HALF_OPEN
        setTimeout(() => {
            this.state.state = 'HALF_OPEN';
            this.state.lastStateChange = Date.now();
            this.state.metrics.failures = 0;
            logger_1.logger.info('Circuit breaker half-opened');
        }, this.state.config.resetTimeout);
    }
    closeCircuit() {
        this.state.state = 'CLOSED';
        this.state.lastStateChange = Date.now();
        this.state.metrics.failures = 0;
        logger_1.logger.info('Circuit breaker closed');
    }
    handleOpenCircuit() {
        throw new Error('Circuit breaker is open');
    }
    handleQuotaExceeded() {
        throw new Error('Daily token quota exceeded');
    }
    // Reset daily token count at midnight
    resetDailyTokens() {
        const now = Date.now();
        const midnight = new Date();
        midnight.setHours(24, 0, 0, 0);
        setTimeout(() => {
            this.state.metrics.dailyTokens = 0;
            this.state.metrics.lastReset = now;
            this.resetDailyTokens(); // Schedule next reset
        }, midnight.getTime() - now);
    }
}
exports.LLMCircuitBreaker = LLMCircuitBreaker;
