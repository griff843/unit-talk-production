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
exports.ConfigLoader = void 0;
exports.validateBaseConfig = validateBaseConfig;
exports.validateHealthCheckInterval = validateHealthCheckInterval;
exports.validateMetricsConfig = validateMetricsConfig;
const zod_1 = require("zod");
require("dotenv/config");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const env_1 = require("../config/env");
const errorHandling_1 = require("./errorHandling");
const logger_1 = require("./logger");
const logger = (0, logger_1.createLogger)('ConfigLoader');
const BaseAgentConfigSchema = zod_1.z.object({
    name: zod_1.z.string(),
    enabled: zod_1.z.boolean(),
    healthCheckInterval: zod_1.z.number().optional(),
    metricsConfig: zod_1.z.object({
        interval: zod_1.z.number(),
        prefix: zod_1.z.string()
    }).optional()
});
const EnvConfigSchema = zod_1.z.object({
    NODE_ENV: zod_1.z.string().default('development'),
    PORT: zod_1.z.string().default('3000'),
    DATABASE_URL: zod_1.z.string(),
    SUPABASE_URL: zod_1.z.string(),
    SUPABASE_ANON_KEY: zod_1.z.string(),
});
class ConfigLoader {
    constructor() {
        this.agentConfigs = new Map();
        this.loadEnvConfig();
    }
    static getInstance() {
        if (!ConfigLoader.instance) {
            ConfigLoader.instance = new ConfigLoader();
        }
        return ConfigLoader.instance;
    }
    loadEnvConfig() {
        try {
            // Parse and validate environment variables
            this.envConfig = EnvConfigSchema.parse({
                NODE_ENV: env_1.env['NODE_ENV'],
                TEMPORAL_TASK_QUEUE: env_1.env['TEMPORAL_TASK_QUEUE'],
                SUPABASE_URL: env_1.env['SUPABASE_URL'],
                SUPABASE_KEY: env_1.env['SUPABASE_KEY'],
                LOG_LEVEL: env_1.env['LOG_LEVEL'],
                METRICS_ENABLED: env_1.env['METRICS_ENABLED'],
                HEALTH_CHECK_INTERVAL: env_1.env['HEALTH_CHECK_INTERVAL']
            });
            logger.info('Environment configuration loaded successfully');
        }
        catch (error) {
            if (error instanceof Error) {
                logger.error('Failed to load environment configuration:', { err: error.message });
            }
            else {
                logger.error('Failed to load environment configuration:', { error: String(error) });
            }
            throw error;
        }
    }
    async loadAgentConfig(agentName, schema) {
        try {
            // First check if config is already loaded
            if (this.agentConfigs.has(agentName)) {
                const cachedConfig = this.agentConfigs.get(agentName);
                return schema.parse(cachedConfig);
            }
            // Load agent config from file
            const configPath = path.join(process.cwd(), 'config', 'agents', `${agentName}.json`);
            const configExists = fs.existsSync(configPath);
            if (!configExists) {
                throw new Error(`Configuration file not found for agent: ${agentName}`);
            }
            const configFile = fs.readFileSync(configPath, 'utf-8');
            const configData = JSON.parse(configFile);
            // Validate against base schema first
            const baseConfig = BaseAgentConfigSchema.parse(configData);
            // Then validate against specific agent schema
            const agentConfig = schema.parse({
                ...baseConfig,
                ...configData
            });
            // Cache the config
            this.agentConfigs.set(agentName, agentConfig);
            logger.info(`Configuration loaded for agent: ${agentName}`);
            return agentConfig;
        }
        catch (error) {
            if (error instanceof Error) {
                logger.error(`Failed to load configuration for agent ${agentName}:`, { error: error.message });
            }
            else {
                logger.error(`Failed to load configuration for agent ${agentName}:`, { error: String(error) });
            }
            throw error;
        }
    }
    getEnvConfig() {
        return this.envConfig;
    }
    async reloadConfig(agentName) {
        if (agentName) {
            this.agentConfigs.delete(agentName);
            logger.info(`Configuration cache cleared for agent: ${agentName}`);
        }
        else {
            this.agentConfigs.clear();
            this.loadEnvConfig();
            logger.info('All configurations reloaded');
        }
    }
}
exports.ConfigLoader = ConfigLoader;
function validateBaseConfig(config) {
    try {
        return BaseAgentConfigSchema.parse(config);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            throw new errorHandling_1.ValidationError('Invalid base configuration: ' + error.issues.map(e => e.message).join(', '));
        }
        throw error;
    }
}
function validateHealthCheckInterval(config) {
    if (config.healthCheckInterval !== undefined &&
        (typeof config.healthCheckInterval !== 'number' || config.healthCheckInterval < 0)) {
        throw new errorHandling_1.ValidationError('Health check interval must be a positive number');
    }
}
function validateMetricsConfig(config) {
    if (config.metricsConfig) {
        if (typeof config.metricsConfig.interval !== 'number' || config.metricsConfig.interval < 0) {
            throw new errorHandling_1.ValidationError('Metrics interval must be a positive number');
        }
        if (typeof config.metricsConfig.prefix !== 'string' || !config.metricsConfig.prefix) {
            throw new errorHandling_1.ValidationError('Metrics prefix must be a non-empty string');
        }
    }
}
