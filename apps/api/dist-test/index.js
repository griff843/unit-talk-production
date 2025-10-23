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
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Load environment variables from root .env file
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../../../.env') });
// Set NODE_ENV to development if not set
if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = 'development';
}
const getEnv_1 = require("./utils/getEnv");
const logger_1 = require("./utils/logger");
// Optional telemetry import to avoid blocking local dev if package resolution differs
let telemetry = null;
try {
    // Use dynamic import to support ESM package from CJS transpilation
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    telemetry = require('@unit-talk/telemetry');
}
catch (_) {
    telemetry = null;
}
const logger = (0, logger_1.createLogger)('Main');
async function main() {
    try {
        logger.info('Starting Unit Talk Platform...');
        // Validate environment variables
        // Initialize OpenTelemetry (OTLP in prod, console in dev via package defaults)
        if (telemetry && typeof telemetry.initialize === 'function') {
            telemetry.initialize();
        }
        (0, getEnv_1.getEnv)();
        logger.info('Environment variables loaded successfully');
        // Start API server; start Temporal worker only if explicitly enabled
        const startWorkerEnabled = process.env.START_TEMPORAL_WORKER === 'true';
        logger.info(`Starting API server${startWorkerEnabled ? ' and Temporal worker' : ''}...`);
        const { startServer } = await Promise.resolve().then(() => __importStar(require('./api-server')));
        const serverPromise = startServer();
        let workerPromise = null;
        if (startWorkerEnabled) {
            const { default: startWorker } = await Promise.resolve().then(() => __importStar(require('./worker')));
            workerPromise = startWorker();
        }
        // Wait for services to start
        if (workerPromise) {
            await Promise.all([serverPromise, workerPromise]);
            logger.info('Unit Talk Platform started successfully - API server and Temporal worker running');
        }
        else {
            await serverPromise;
            logger.info('Unit Talk Platform started successfully - API server running (Temporal worker disabled)');
        }
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Failed to start Unit Talk Platform:', { err: errorMessage });
        process.exit(1);
    }
}
// Handle graceful shutdown
process.on('SIGINT', () => {
    logger.info('Received SIGINT, shutting down gracefully...');
    process.exit(0);
});
process.on('SIGTERM', () => {
    logger.info('Received SIGTERM, shutting down gracefully...');
    process.exit(0);
});
main().catch((error) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Unhandled error in main:', { error: errorMessage });
    process.exit(1);
});
