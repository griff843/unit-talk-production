"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContestAgentActivitiesImpl = void 0;
const activities_1 = require("../../BaseAgent/activities");
class ContestAgentActivitiesImpl extends activities_1.BaseAgentActivitiesImpl {
    constructor(config, deps) {
        super('ContestAgent', deps.supabase);
        // Ensure logger is defined
        if (!deps.logger) {
            throw new Error('Logger is required for ContestAgent activities');
        }
        this.config = config;
        this.deps = deps;
    }
    async getAgent() {
        if (!this.agent) {
            // Lazy import to avoid circular dependency
            const { ContestAgent } = await Promise.resolve().then(() => __importStar(require('../index')));
            this.agent = new ContestAgent(this.config, {
                ...this.deps,
                logger: this.deps.logger
            });
        }
        return this.agent;
    }
    async createContest(params) {
        try {
            const agent = await this.getAgent();
            await agent.handleCommand({
                type: 'CREATE_CONTEST',
                payload: params,
                timestamp: new Date().toISOString(),
                source: 'temporal-activity'
            });
        }
        catch (error) {
            throw error instanceof Error ? error : new Error(String(error));
        }
    }
    async processEntries(params) {
        try {
            const agent = await this.getAgent();
            await agent.handleCommand({
                type: 'PROCESS_ENTRIES',
                payload: params,
                timestamp: new Date().toISOString(),
                source: 'temporal-activity'
            });
            return { success: true };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error : new Error(String(error))
            };
        }
    }
    async determineWinners(params) {
        try {
            const agent = await this.getAgent();
            await agent.handleCommand({
                type: 'DETERMINE_WINNERS',
                payload: params,
                timestamp: new Date().toISOString(),
                source: 'temporal-activity'
            });
            return { success: true };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error : new Error(String(error))
            };
        }
    }
    async validateDependencies() {
        // Validate that required dependencies are available
        if (!this.supabase) {
            throw new Error('Supabase client is required');
        }
    }
    async initializeResources() {
        // Initialize the agent using the public start method
        await this.agent.start();
    }
    async cleanup() {
        try {
            const agent = await this.getAgent();
            await agent.cleanup();
        }
        catch (error) {
            this.logger.error('Failed to cleanup ContestAgent', error);
        }
    }
    async handleCommand(command) {
        try {
            const agent = await this.getAgent();
            await agent.handleCommand(command);
        }
        catch (error) {
            this.logger.error('Failed to handle command in ContestAgent', error);
            throw error;
        }
    }
}
exports.ContestAgentActivitiesImpl = ContestAgentActivitiesImpl;
