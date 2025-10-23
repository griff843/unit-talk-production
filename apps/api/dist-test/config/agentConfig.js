"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scoringAgentConfig = exports.alertAgentConfig = void 0;
exports.alertAgentConfig = {
    name: 'AlertAgent',
    version: '1.0.0',
    enabled: true,
    schedule: 'manual', // or cron: '*/5 * * * *' if you want scheduled runs
    logLevel: 'info',
    metrics: {
        enabled: true,
        interval: 60,
        port: 9003,
    },
    health: {
        enabled: true,
        interval: 30,
        timeout: 5000,
        checkDb: true,
        checkExternal: false,
    },
    retry: {
        maxRetries: 3,
        backoffMs: 2000,
        maxBackoffMs: 5000,
    },
};
exports.scoringAgentConfig = {
    name: 'ScoringAgent',
    version: '1.0.0',
    enabled: true,
    schedule: 'manual', // or cron: '*/10 * * * *' for every 10 minutes
    logLevel: 'info',
    metrics: {
        enabled: true,
        interval: 60,
        port: 9004,
    },
    health: {
        enabled: true,
        interval: 30,
        timeout: 5000,
        checkDb: true,
        checkExternal: false,
    },
    retry: {
        maxRetries: 3,
        backoffMs: 2000,
        maxBackoffMs: 5000,
    }
};
