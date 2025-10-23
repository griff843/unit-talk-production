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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = startWorker;
require("dotenv/config");
const worker_1 = require("@temporalio/worker");
// import { createClient } from '@supabase/supabase-js'; // Unused
// Import base activities
const healthMonitoringActivities = __importStar(require("./activities/healthMonitoring"));
const mainOperatorActivities = __importStar(require("./activities/operator"));
const backfillSGOActivities = __importStar(require("./activities/backfillSGOActivities"));
const settlementActivities = __importStar(require("./activities/settlementActivities"));
// Import agent-specific activities
const alertActivities = __importStar(require("./agents/AlertAgent/activities"));
const analyticsActivities = __importStar(require("./agents/AnalyticsAgent/activities/index"));
const auditActivities = __importStar(require("./agents/AuditAgent/activities"));
const baseActivities = __importStar(require("./agents/BaseAgent/activities"));
const campaignActivities = __importStar(require("./agents/CampaignAgent/activities"));
const contestActivities = __importStar(require("./agents/ContestAgent/activities"));
const feedActivities = __importStar(require("./agents/FeedAgent/activities"));
const gradingActivities = __importStar(require("./agents/ScoringAgent/activities"));
const notificationActivities = __importStar(require("./agents/NotificationAgent/activities"));
const operatorActivities = __importStar(require("./agents/OperatorAgent/activities"));
const playerEnrichmentActivities = __importStar(require("./agents/PlayerEnrichmentAgent/activities"));
const errorHandling_1 = require("./utils/errorHandling");
const getEnv_1 = require("./utils/getEnv");
const logger_1 = require("./utils/logger");
const start_all_workflows_1 = __importDefault(require("./scripts/start-all-workflows"));
const env = (0, getEnv_1.getEnv)();
const logger = (0, logger_1.createLogger)('Worker');
const errorHandler = new errorHandling_1.ErrorHandler();
async function startWorker() {
    try {
        logger.info(`Connecting to Temporal server at: ${env.TEMPORAL_SERVER_URL}`);
        // Create a connection to Temporal server with retry logic
        const connection = await worker_1.NativeConnection.connect({
            address: env.TEMPORAL_SERVER_URL
        });
        logger.info('Temporal connection established successfully');
        const worker = await worker_1.Worker.create({
            connection,
            workflowsPath: require.resolve('./workflows'),
            activities: {
                // Register base activities
                ...baseActivities,
                ...healthMonitoringActivities,
                ...mainOperatorActivities,
                // Register agent-specific activities
                ...analyticsActivities,
                ...notificationActivities,
                ...feedActivities,
                ...auditActivities,
                ...gradingActivities,
                ...alertActivities,
                ...campaignActivities,
                ...contestActivities,
                ...operatorActivities,
                ...playerEnrichmentActivities,
                // Register SGO backfill activities
                ...backfillSGOActivities,
                // Register settlement activities
                ...settlementActivities
            },
            taskQueue: env.TEMPORAL_TASK_QUEUE,
            // Add worker-specific configuration for stability
            maxConcurrentActivityTaskExecutions: 10,
            maxConcurrentWorkflowTaskExecutions: 10,
            // Ignore non-deterministic modules that are used in activities but not in workflows at runtime
            bundlerOptions: {
                ignoreModules: ['fs', 'path', 'os', 'crypto', 'http', 'https', 'zlib', 'stream', 'events', 'tty', 'punycode'],
                // Fix webpack issues for Node.js environment
                webpackConfigHook: (config) => {
                    config.output = config.output || {};
                    config.output.publicPath = '';
                    config.output.globalObject = 'this';
                    config.target = 'node';
                    return config;
                }
            }
        });
        // Start the worker in the background
        const workerPromise = worker.run();
        logger.info('Worker started successfully');
        // Auto-start workflows after worker is ready
        logger.info('🚀 Auto-starting Unit Talk workflows...');
        // Give worker a moment to fully initialize
        await new Promise(resolve => setTimeout(resolve, 5000));
        try {
            await (0, start_all_workflows_1.default)({ criticalOnly: false });
            logger.info('✅ All workflows started successfully');
        }
        catch (error) {
            logger.error('⚠️ Some workflows failed to start, but worker will continue:', {
                error: error instanceof Error ? error.message : String(error)
            });
            // Don't fail the worker if workflows fail to start - they can be started manually
        }
        // Handle graceful shutdown
        process.on('SIGINT', async () => {
            logger.info('Shutting down worker...');
            await worker.shutdown();
            await connection.close();
            process.exit(0);
        });
        // Wait for worker to complete
        await workerPromise;
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Failed to start worker:', { err: errorMessage });
        await errorHandler.handleError(error instanceof Error ? error : new Error(errorMessage));
        throw error;
    }
}
// If this file is run directly, start the worker
if (require.main === module) {
    startWorker().catch(async (error) => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Unhandled error:', { error: errorMessage });
        await errorHandler.handleError(error instanceof Error ? error : new Error(errorMessage));
        process.exit(1);
    });
}
