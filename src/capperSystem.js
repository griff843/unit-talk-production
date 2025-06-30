"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CapperSystem = void 0;
exports.createCapperSystem = createCapperSystem;
exports.getCapperSystem = getCapperSystem;
const capperService_1 = require("./services/capperService");
const dailyPickPublisher_1 = require("./services/dailyPickPublisher");
const logger_1 = require("./shared/logger");
class CapperSystem {
    constructor(config) {
        this.initialized = false;
        this.config = config;
        this.publisher = new dailyPickPublisher_1.DailyPickPublisher(config.discordClient, config.publishingChannelId);
    }
    async initialize() {
        try {
            logger_1.logger.info('Initializing Capper System');
            if (!this.config.enabled) {
                logger_1.logger.info('Capper System is disabled');
                return;
            }
            const dbConnected = await capperService_1.capperService.testConnection();
            if (!dbConnected) {
                throw new Error('Database connection failed');
            }
            this.initialized = true;
            logger_1.logger.info('Capper System initialized successfully');
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize Capper System', {
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined
            });
            throw error;
        }
    }
    async publishDailyPicks() {
        if (!this.initialized) {
            throw new Error('Capper System not initialized');
        }
        await this.publisher.publishDailyPicks();
    }
    getStatus() {
        if (!this.initialized) {
            return {
                initialized: false,
                error: 'System not initialized'
            };
        }
        return {
            initialized: true,
            client: {
                ready: this.config.discordClient.isReady(),
                user: this.config.discordClient.user?.tag || null,
                guilds: this.config.discordClient.guilds.cache.size,
                uptime: this.config.discordClient.uptime
            },
            database: {
                connected: true
            },
            publisher: this.publisher.getStatus(),
            config: {
                enabled: this.config.enabled,
                publishingChannelId: this.config.publishingChannelId
            }
        };
    }
    isInitialized() {
        return this.initialized;
    }
}
exports.CapperSystem = CapperSystem;
let capperSystemInstance = null;
function createCapperSystem(config) {
    capperSystemInstance = new CapperSystem(config);
    return capperSystemInstance;
}
function getCapperSystem() {
    if (!capperSystemInstance) {
        throw new Error('Capper System not created. Call createCapperSystem first.');
    }
    return capperSystemInstance;
}
//# sourceMappingURL=capperSystem.js.map