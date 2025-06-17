import { z } from 'zod';
import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import { BaseAgentConfigSchema } from '../agents/BaseAgent/types';
import { Logger } from './logger';
import { AgentConfig } from '../types/agent';
import { ValidationError } from './errorHandling';

const logger = new Logger('ConfigLoader');

const baseConfigSchema = z.object({
  name: z.string(),
  enabled: z.boolean(),
  healthCheckInterval: z.number().optional(),
  metricsConfig: z.object({
    interval: z.number(),
    prefix: z.string()
  }).optional()
});

const EnvConfigSchema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.string().default('3000'),
  DATABASE_URL: z.string(),
  SUPABASE_URL: z.string(),
  SUPABASE_ANON_KEY: z.string(),
});

export class ConfigLoader {
  private static instance: ConfigLoader;
  private envConfig!: z.infer<typeof EnvConfigSchema>;
  private agentConfigs: Map<string, any> = new Map();

  private constructor() {
    this.loadEnvConfig();
  }

  public static getInstance(): ConfigLoader {
    if (!ConfigLoader.instance) {
      ConfigLoader.instance = new ConfigLoader();
    }
    return ConfigLoader.instance;
  }

  private loadEnvConfig(): void {
    try {
      // Parse and validate environment variables
      this.envConfig = EnvConfigSchema.parse({
        NODE_ENV: process.env.NODE_ENV,
        TEMPORAL_TASK_QUEUE: process.env.TEMPORAL_TASK_QUEUE,
        SUPABASE_URL: process.env.SUPABASE_URL,
        SUPABASE_KEY: process.env.SUPABASE_KEY,
        LOG_LEVEL: process.env.LOG_LEVEL,
        METRICS_ENABLED: process.env.METRICS_ENABLED === 'true',
        HEALTH_CHECK_INTERVAL: parseInt(process.env.HEALTH_CHECK_INTERVAL || '60000')
      });

      logger.info('Environment configuration loaded successfully');
    } catch (error) {
      if (error instanceof Error) {
        logger.error('Failed to load environment configuration:', { error: error.message });
      } else {
        logger.error('Failed to load environment configuration:', { error: String(error) });
      }
      throw error;
    }
  }

  public async loadAgentConfig<T extends z.ZodType>(
    agentName: string,
    schema: T
  ): Promise<z.infer<T>> {
    try {
      // First check if config is already loaded
      if (this.agentConfigs.has(agentName)) {
        return this.agentConfigs.get(agentName);
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
    } catch (error) {
      if (error instanceof Error) {
        logger.error(`Failed to load configuration for agent ${agentName}:`, { error: error.message });
      } else {
        logger.error(`Failed to load configuration for agent ${agentName}:`, { error: String(error) });
      }
      throw error;
    }
  }

  public getEnvConfig(): z.infer<typeof EnvConfigSchema> {
    return this.envConfig;
  }

  public async reloadConfig(agentName?: string): Promise<void> {
    if (agentName) {
      this.agentConfigs.delete(agentName);
      logger.info(`Configuration cache cleared for agent: ${agentName}`);
    } else {
      this.agentConfigs.clear();
      this.loadEnvConfig();
      logger.info('All configurations reloaded');
    }
  }
}

export function validateBaseConfig(config: unknown): AgentConfig {
  try {
    return baseConfigSchema.parse(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError(
        'Invalid base configuration: ' + error.errors.map(e => e.message).join(', ')
      );
    }
    throw error;
  }
}

export function validateHealthCheckInterval(config: AgentConfig): void {
  if (config.healthCheckInterval !== undefined && 
      (typeof config.healthCheckInterval !== 'number' || config.healthCheckInterval < 0)) {
    throw new ValidationError('Health check interval must be a positive number');
  }
}

export function validateMetricsConfig(config: AgentConfig): void {
  if (config.metricsConfig) {
    if (typeof config.metricsConfig.interval !== 'number' || config.metricsConfig.interval < 0) {
      throw new ValidationError('Metrics interval must be a positive number');
    }
    if (typeof config.metricsConfig.prefix !== 'string' || !config.metricsConfig.prefix) {
      throw new ValidationError('Metrics prefix must be a non-empty string');
    }
  }
} 