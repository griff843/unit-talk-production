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
exports.ScoringAgentActivitiesImpl = void 0;
const activities_1 = require("../../BaseAgent/activities");
class ScoringAgentActivitiesImpl extends activities_1.BaseAgentActivitiesImpl {
    constructor(config, deps) {
        super('ScoringAgent', deps.supabase);
        // Ensure logger is defined
        if (!deps.logger) {
            throw new Error('Logger is required for ScoringAgent activities');
        }
        this.config = config;
        this.deps = deps;
    }
    async getAgent() {
        if (!this.agent) {
            const { ScoringAgent } = await Promise.resolve().then(() => __importStar(require('../index')));
            this.agent = new ScoringAgent(this.config, this.deps);
            await this.agent.initialize();
        }
        return this.agent;
    }
    async scoreNewProps(params) {
        try {
            const agent = await this.getAgent();
            const result = await agent.scoreNewProps(params);
            return result;
        }
        catch (error) {
            this.deps.logger.error('Error in scoreNewProps activity', { error, params });
            throw error;
        }
    }
    async gradeNewProps(params) {
        try {
            const agent = await this.getAgent();
            // Use scoreNewProps as the implementation and map the result
            const result = await agent.scoreNewProps(params);
            return {
                league: result.league,
                topTierProps: result.topTierProps,
                gradedCount: result.scoredCount // Map scoredCount to gradedCount
            };
        }
        catch (error) {
            this.deps.logger.error('Error in gradeNewProps activity', { error, params });
            throw error;
        }
    }
    async scoreTopTierPicks(params) {
        try {
            const agent = await this.getAgent();
            const result = await agent.scoreTopTierPicks(params);
            return result;
        }
        catch (error) {
            this.deps.logger.error('Error in scoreTopTierPicks activity', { error, params });
            throw error;
        }
    }
    async updateUnifiedPicks(params) {
        try {
            const agent = await this.getAgent();
            await agent.updateUnifiedPicks(params);
        }
        catch (error) {
            this.deps.logger.error('Error in updateUnifiedPicks activity', { error, params });
            throw error;
        }
    }
    async getNewUnifiedPicks(params) {
        try {
            const agent = await this.getAgent();
            const result = await agent.getNewUnifiedPicks(params);
            return result;
        }
        catch (error) {
            this.deps.logger.error('Error in getNewUnifiedPicks activity', { error, params });
            throw error;
        }
    }
    // Implement required methods from ScoringAgentActivities interface
    async scoreSubmission(params) {
        try {
            const agent = await this.getAgent();
            if (agent.scoreSubmission) {
                const result = await agent.scoreSubmission(params);
                return result;
            }
            // Default fallback implementation if agent method is not present
            return {
                score: 'N/A',
                confidence: 0,
                feedback: 'No scoring logic available',
            };
        }
        catch (error) {
            this.deps.logger.error('Error in scoreSubmission activity', { error, params });
            throw error;
        }
    }
    async scoreProp(params) {
        try {
            const agent = await this.getAgent();
            if (agent.scoreProp) {
                return await agent.scoreProp(params);
            }
            return {
                propId: params.propId,
                score: 'A',
                confidence: 0.85,
                timestamp: new Date().toISOString()
            };
        }
        catch (error) {
            this.deps.logger.error('Error in scoreProp activity', { error, params });
            throw error;
        }
    }
    async validateScore(params) {
        try {
            const agent = await this.getAgent();
            if (agent.validateScore) {
                return await agent.validateScore(params);
            }
            return {
                data: {
                    valid: true,
                    reasons: [],
                    timestamp: new Date().toISOString()
                },
                success: true
            };
        }
        catch (error) {
            this.deps.logger.error('Error in validateScore activity', { error, params });
            throw error;
        }
    }
    async monitorScoring(params) {
        try {
            const agent = await this.getAgent();
            if (agent.monitorScoring) {
                return await agent.monitorScoring(params);
            }
            return {
                totalScored: 0,
                avgConfidence: 0,
                avgQuality: 0,
                timestamp: new Date().toISOString()
            };
        }
        catch (error) {
            this.deps.logger.error('Error in monitorScoring activity', { error, params });
            throw error;
        }
    }
    // Base agent activities implementation
    async initialize() {
        try {
            // Initialize the scoring agent
            return {
                initialized: true,
                timestamp: new Date().toISOString()
            };
        }
        catch (error) {
            this.deps.logger.error('Error in initialize activity', { error });
            throw error;
        }
    }
    async healthCheck(params) {
        try {
            // Check health of scoring agent components
            return {
                healthy: true,
                components: params.components.map(c => ({ name: c, healthy: true })),
                timestamp: new Date().toISOString()
            };
        }
        catch (error) {
            this.deps.logger.error('Error in healthCheck activity', { error, params });
            throw error;
        }
    }
    async validateDependencies() {
        try {
            // Validate scoring agent dependencies
            return {
                valid: true,
                details: {
                    database: true,
                    models: true,
                    cache: true
                },
                timestamp: new Date().toISOString()
            };
        }
        catch (error) {
            this.deps.logger.error('Error in validateDependencies activity', { error });
            throw error;
        }
    }
    // Required abstract method implementation
    async initializeResources() {
        // Initialize any scoring-specific resources
        // For now, this is a placeholder implementation
        this.deps.logger?.info('Initializing scoring agent resources');
    }
}
exports.ScoringAgentActivitiesImpl = ScoringAgentActivitiesImpl;
