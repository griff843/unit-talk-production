import * as fs from 'fs/promises';
import * as path from 'path';

const baseAgentConfigFix = `import { Logger } from "../../utils/logger";
import { ErrorHandler } from "../../utils/errorHandler";

export interface BaseAgentConfig {
  version: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  schedule?: 'enabled' | 'disabled';
  health?: {
    enabled: boolean;
    interval: number; // in seconds
    timeout?: number; // in milliseconds
    checkExternal?: boolean;
  };
  retry?: {
    maxAttempts: number;
    initialInterval: number;
    maxInterval: number;
  };
}

export interface BaseAgentDependencies {
  logger: Logger;
  errorHandler: ErrorHandler;
  config: BaseAgentConfig;
}

export interface BaseMetrics {
  agentName: string;
  successCount: number;
  errorCount: number;
  warningCount: number;
  processingTimeMs: number;
  memoryUsageMb: number;
  status: 'healthy' | 'unhealthy' | 'warning';
  customMetrics?: Record<string, number>;
}

export interface HealthCheckResult {
  healthy: boolean;
  details: {
    uptime: number;
    memoryUsage: number;
    errorRate: number;
    lastError?: string;
    customChecks?: Record<string, boolean>;
  };
}`;

const baseAgentFix = `import { BaseAgentConfig, BaseAgentDependencies, BaseMetrics, HealthCheckResult } from './types';
import { Logger } from "../../utils/logger";

export abstract class BaseAgent {
  protected config: BaseAgentConfig;
  protected logger: Logger;
  protected errorHandler: ErrorHandler;
  protected startTime: number;
  protected metrics: BaseMetrics;

  constructor(config: BaseAgentConfig, deps: BaseAgentDependencies) {
    this.config = config;
    this.logger = deps.logger;
    this.errorHandler = deps.errorHandler;
    this.startTime = Date.now();
    this.metrics = {
      agentName: this.constructor.name,
      successCount: 0,
      errorCount: 0,
      warningCount: 0,
      processingTimeMs: 0,
      memoryUsageMb: 0,
      status: 'healthy',
      customMetrics: {}
    };
  }

  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;
  abstract run(): Promise<void>;

  protected async collectMetrics(): Promise<BaseMetrics> {
    const memoryUsage = process.memoryUsage();
    this.metrics.memoryUsageMb = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    return this.metrics;
  }

  protected async checkHealth(): Promise<HealthCheckResult> {
    const uptime = Date.now() - this.startTime;
    const errorRate = this.metrics.errorCount / (this.metrics.successCount + this.metrics.errorCount || 1);
    
    return {
      healthy: errorRate < 0.1,
      details: {
        uptime,
        memoryUsage: this.metrics.memoryUsageMb,
        errorRate,
        lastError: this.metrics.lastError
      }
    };
  }

  protected async initialize(): Promise<void> {
    this.logger.info('Initializing agent');
  }

  protected async cleanup(): Promise<void> {
    this.logger.info('Cleaning up agent');
  }
}`;

async function fixBaseAgentTypes() {
  const baseAgentDir = path.join(__dirname, '../src/agents/BaseAgent');
  
  // Fix types
  await fs.writeFile(
    path.join(baseAgentDir, 'types.ts'),
    baseAgentConfigFix,
    'utf8'
  );

  // Fix BaseAgent class
  await fs.writeFile(
    path.join(baseAgentDir, 'index.ts'),
    baseAgentFix,
    'utf8'
  );

  console.log('Fixed BaseAgent types and implementation');
}

fixBaseAgentTypes().catch(console.error);
