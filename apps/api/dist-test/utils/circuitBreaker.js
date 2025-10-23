"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CircuitBreaker = void 0;
class CircuitBreaker {
    constructor(config = {}) {
        this.config = {
            failureThreshold: config.failureThreshold || 5,
            resetTimeout: config.resetTimeout || 60000
        };
        this.states = new Map();
    }
    getOrCreateState(activityName) {
        if (!this.states.has(activityName)) {
            this.states.set(activityName, {
                failures: 0,
                lastFailure: null,
                isOpen: false
            });
        }
        return this.states.get(activityName);
    }
    isOpen(activityName) {
        const state = this.getOrCreateState(activityName);
        if (!state.isOpen) {
            return false;
        }
        // Check if enough time has passed to attempt reset
        if (state.lastFailure && Date.now() - state.lastFailure >= this.config.resetTimeout) {
            state.isOpen = false;
            state.failures = 0;
            state.lastFailure = null;
            return false;
        }
        return true;
    }
    recordSuccess(activityName) {
        const state = this.getOrCreateState(activityName);
        state.failures = 0;
        state.lastFailure = null;
        state.isOpen = false;
    }
    recordFailure(activityName) {
        const state = this.getOrCreateState(activityName);
        state.failures++;
        state.lastFailure = Date.now();
        if (state.failures >= this.config.failureThreshold) {
            state.isOpen = true;
        }
    }
    reset(activityName) {
        this.states.set(activityName, {
            failures: 0,
            lastFailure: null,
            isOpen: false
        });
    }
    getState(activityName) {
        return { ...this.getOrCreateState(activityName) };
    }
}
exports.CircuitBreaker = CircuitBreaker;
