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
exports.default = startAllAgents;
require("dotenv/config");
const worker_1 = require("@temporalio/worker");
// import { getEnv } from '../utils/getEnv';
// Import base activities
const alertActivities = __importStar(require("../agents/AlertAgent/activities"));
const analyticsActivities = __importStar(require("../agents/AnalyticsAgent/activities"));
const auditActivities = __importStar(require("../agents/AuditAgent/activities"));
const automatedOnboardingActivities = __importStar(require("../agents/AutomatedOnboardingAgent/activities"));
const baseActivities = __importStar(require("../agents/BaseAgent/activities"));
// Import all agent-specific activities
const campaignActivities = __importStar(require("../agents/CampaignAgent/activities"));
const contestActivities = __importStar(require("../agents/ContestAgent/activities"));
const feedActivities = __importStar(require("../agents/FeedAgent/activities"));
const scoringActivities = __importStar(require("../agents/ScoringAgent/activities"));
const notificationActivities = __importStar(require("../agents/NotificationAgent/activities"));
const operatorActivities = __importStar(require("../agents/OperatorAgent/activities"));
const performanceOptimizationActivities = __importStar(require("../agents/PerformanceOptimizationAgent/activities"));
const playerEnrichmentActivities = __importStar(require("../agents/PlayerEnrichmentAgent/activities"));
// Import intelligent agent activities
const predictiveAnalyticsActivities = __importStar(require("../agents/PredictiveAnalyticsAgent/activities"));
const riskManagementActivities = __importStar(require("../agents/RiskManagementAgent/activities"));
const userRetentionActivities = __importStar(require("../agents/UserRetentionAgent/activities"));
const errorHandling_1 = require("../utils/errorHandling");
const logger_1 = require("../utils/logger");
// Import additional agent activities (mock imports for agents without activities yet)
// These agents will need activity implementations for full Temporal integration
// import * as dataActivities from '../agents/DataAgent/activities';
// FinalizerAgent removed - obsolete v2.0 tables
// import * as ingestionActivities from '../agents/IngestionAgent/activities';
// import * as marketingActivities from '../agents/MarketingAgent/activities';
// import * as recapActivities from '../agents/RecapAgent/activities';
// import * as scoringActivities from '../agents/ScoringAgent/activities';
// const env = getEnv();
const logger = (0, logger_1.createLogger)('MasterWorker');
const errorHandler = new errorHandling_1.ErrorHandler();
async function startAllAgents() {
    try {
        logger.info('Starting master Temporal worker with all agents...');
        // Log optimized agent system (27→13 agents, 52% reduction)
        logger.info('Loading optimized agent system:', {
            totalAgents: 13,
            reductionPercentage: '52%',
            businessAgents: [
                'ScoringAgent', // Professional pick scoring with ML ensemble
                'AnalyticsAgent', // Performance insights and data analysis
                'AlertAgent', // Real-time notifications and Discord alerts
                'FeedAgent', // Optimal dual-API data ingestion
                'RecapAgent' // Daily/weekly performance summaries
            ],
            operationalAgents: [
                'NotificationAgent', // Multi-channel user communications
                'ContestAgent', // Contest management and leaderboards
                'PlayerEnrichmentAgent', // Multi-league player data enrichment
                'AuditAgent' // Compliance and audit trail tracking
            ],
            intelligenceAgents: [
                'AutomatedOnboardingAgent', // ML-powered Discord onboarding (ENHANCED)
                'PredictiveAnalyticsAgent', // Market forecasting and predictions
                'RiskManagementAgent', // Portfolio optimization and risk analysis
                'UserRetentionAgent' // Churn prediction and engagement analysis
            ],
            removedAgents: [
                'FinalizerAgent (obsolete v2.0 tables)',
                'OnboardingAgent (replaced by AutomatedOnboardingAgent)'
            ]
        });
        const worker = await worker_1.Worker.create({
            workflowsPath: require.resolve('../workflows'),
            activities: {
                // Register base activities
                ...baseActivities,
                // Register all agent-specific activities
                ...alertActivities,
                ...analyticsActivities,
                ...auditActivities,
                ...contestActivities,
                ...feedActivities,
                ...scoringActivities,
                ...notificationActivities,
                ...operatorActivities,
                ...playerEnrichmentActivities,
                ...campaignActivities,
                // Register intelligent agent activities
                ...automatedOnboardingActivities,
                ...userRetentionActivities,
                ...riskManagementActivities,
                ...predictiveAnalyticsActivities,
                ...performanceOptimizationActivities,
            },
            taskQueue: 'unit-talk-main',
            // Enhanced configuration for production use
            maxConcurrentActivityTaskExecutions: 100,
            maxConcurrentWorkflowTaskExecutions: 100,
            maxConcurrentLocalActivityExecutions: 100,
            maxTaskQueueActivitiesPerSecond: 200,
            maxActivitiesPerSecond: 200,
        });
        logger.info('Master worker created successfully, starting to process tasks...');
        // Handle graceful shutdown
        const shutdown = async (signal) => {
            logger.info(`Received ${signal}, initiating graceful shutdown...`);
            try {
                await worker.shutdown();
                logger.info('Worker shutdown completed');
                process.exit(0);
            }
            catch (error) {
                logger.error('Error during worker shutdown:', { error });
                process.exit(1);
            }
        };
        // Register shutdown handlers
        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGUSR2', () => shutdown('SIGUSR2'));
        // Handle uncaught exceptions
        process.on('uncaughtException', async (error) => {
            logger.error('Uncaught exception:', { error: error.message, stack: error.stack });
            await errorHandler.handleError(error);
            await worker.shutdown();
            process.exit(1);
        });
        process.on('unhandledRejection', async (reason, promise) => {
            logger.error('Unhandled rejection at:', { promise, reason });
            const error = reason instanceof Error ? reason : new Error(String(reason));
            await errorHandler.handleError(error);
            await worker.shutdown();
            process.exit(1);
        });
        // Start the worker
        await worker.run();
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Failed to start master worker:', {
            error: errorMessage,
            stack: error instanceof Error ? error.stack : undefined
        });
        await errorHandler.handleError(error instanceof Error ? error : new Error(errorMessage));
        // Attempt graceful shutdown
        process.exit(1);
    }
}
// If this file is run directly, start the worker
if (require.main === module) {
    logger.info('Starting Unit Talk Master Worker...');
    logger.info('Task Queue: unit-talk-main');
    logger.info('Environment:', {
        nodeEnv: process.env.NODE_ENV,
        temporalAddress: process.env.TEMPORAL_ADDRESS,
        logLevel: process.env.LOG_LEVEL
    });
    startAllAgents().catch(async (error) => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Unhandled error in master worker:', {
            error: errorMessage,
            stack: error instanceof Error ? error.stack : undefined
        });
        await errorHandler.handleError(error instanceof Error ? error : new Error(errorMessage));
        process.exit(1);
    });
}
