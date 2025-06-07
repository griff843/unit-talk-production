import 'dotenv/config';
import { BaseAgentConfig, BaseAgentDependencies, AgentStatus, HealthStatus, BaseMetrics } from '../BaseAgent/types';
import { createClient } from '@supabase/supabase-js';
import { AnalyticsAgent } from '../';
import { AnalyticsAgentConfig } from '../types';
import { Logger } from '../../../utils/logger';

const logger = new Logger('AnalyticsAgent:Activities');

// Safely load env vars, throw descriptive error if missing
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) throw new Error('Missing SUPABASE_URL in environment');
if (!supabaseKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY in environment');

const supabase = createClient(supabaseUrl, supabaseKey);

// Default agent configuration (customize as needed)
const config: AnalyticsAgentConfig = {
  agentName: 'AnalyticsAgent',
  enabled: true,
  version: '1.0.0',
  logLevel: 'info',
  metrics: { enabled: true, interval: 60 },
  retryConfig: {
    maxRetries: 3,
    backoffMs: 1000,
    maxBackoffMs: 30000,
  },
  analysisConfig: {
    minPicksForAnalysis: 10,
    roiTimeframes: [7, 30, 90],
    streakThreshold: 3,
    trendWindowDays: 30,
  },
  alertConfig: {
    roiAlertThreshold: 15,
    streakAlertThreshold: 5,
    volatilityThreshold: 0.2,
  },
  metricsConfig: {
    interval: 60000,
    prefix: 'analytics_agent',
  },
};

// Error handling config
const errorConfig = {
  maxRetries: 3,
  backoffMs: 1000,
  maxBackoffMs: 30000,
  shouldRetry: (error: Error) => {
    // Retry on network errors or Supabase timeouts
    return error.message.includes('network') || 
           error.message.includes('timeout') ||
           error.message.includes('rate limit');
  }
};

// Agent instance
const agent = new AnalyticsAgent(
  config,
  supabase,
  errorConfig
);

// Exported Temporal activity
export async function runAnalyticsAgent(): Promise<void> {
  await agent.runAnalysis();

  protected async initialize(): Promise<void> {
    // TODO: Restore business logic here after base migration (initialize)
  }

  protected async process(): Promise<void> {
    // TODO: Restore business logic here after base migration (process)
  }

  protected async cleanup(): Promise<void> {
    // TODO: Restore business logic here after base migration (cleanup)
  }

  protected async checkHealth(): Promise<HealthStatus> {
    // TODO: Restore business logic here after base migration (checkHealth)
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      details: {}
    };
  }

  protected async collectMetrics(): Promise<BaseMetrics> {
    // TODO: Restore business logic here after base migration (collectMetrics)
    return {
      successCount: 0,
      errorCount: 0,
      warningCount: 0,
      processingTimeMs: 0,
      memoryUsageMb: process.memoryUsage().heapUsed / 1024 / 1024
    };
  }

  protected async initialize(): Promise<void> {
    // TODO: Restore business logic here after base migration (initialize)
  }

  protected async process(): Promise<void> {
    // TODO: Restore business logic here after base migration (process)
  }

  protected async cleanup(): Promise<void> {
    // TODO: Restore business logic here after base migration (cleanup)
  }

  protected async checkHealth(): Promise<HealthStatus> {
    // TODO: Restore business logic here after base migration (checkHealth)
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      details: {}
    };
  }

  protected async collectMetrics(): Promise<BaseMetrics> {
    // TODO: Restore business logic here after base migration (collectMetrics)
    return {
      successCount: 0,
      errorCount: 0,
      warningCount: 0,
      processingTimeMs: 0,
      memoryUsageMb: process.memoryUsage().heapUsed / 1024 / 1024
    };
  }

  protected async initialize(): Promise<void> {
    // TODO: Restore business logic here after base migration (initialize)
  }

  protected async process(): Promise<void> {
    // TODO: Restore business logic here after base migration (process)
  }

  protected async cleanup(): Promise<void> {
    // TODO: Restore business logic here after base migration (cleanup)
  }

  protected async checkHealth(): Promise<HealthStatus> {
    // TODO: Restore business logic here after base migration (checkHealth)
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      details: {}
    };
  }

  protected async collectMetrics(): Promise<BaseMetrics> {
    // TODO: Restore business logic here after base migration (collectMetrics)
    return {
      successCount: 0,
      errorCount: 0,
      warningCount: 0,
      processingTimeMs: 0,
      memoryUsageMb: process.memoryUsage().heapUsed / 1024 / 1024
    };
  }
}