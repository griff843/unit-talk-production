"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const errorHandling_1 = require("../../utils/errorHandling");
const logger_1 = require("../../utils/logger");
const index_1 = require("./index");
(0, globals_1.describe)('MarketingAgent', () => {
    let marketingAgent;
    (0, globals_1.beforeEach)(() => {
        // Initialize MarketingAgent for testing
        const mockLogger = (0, logger_1.makeLogger)('TestMarketingAgent');
        const mockErrorHandler = new errorHandling_1.ErrorHandler('TestMarketingAgent', {});
        const mockDependencies = {
            supabase: {},
            logger: mockLogger,
            errorHandler: mockErrorHandler
        };
        marketingAgent = new index_1.MarketingAgent({
            name: 'TestMarketingAgent',
            version: '1.0.0',
            enabled: true,
            logLevel: 'info',
            metrics: {
                enabled: true,
                interval: 60000
            }
        }, mockDependencies);
    });
    (0, globals_1.it)('should initialize correctly', () => {
        (0, globals_1.expect)(marketingAgent).toBeDefined();
        (0, globals_1.expect)(marketingAgent.getConfig().name).toBe('TestMarketingAgent');
    });
});
