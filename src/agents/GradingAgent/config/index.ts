import { HealthStatus, BaseMetrics } from '../../BaseAgent/types';
import { SupabaseClient } from '@supabase/supabase-js';
import { GradingAgentConfig } from '../types';
import { logger } from '../../../services/logging';

export class ConfigManager {
  private static instance: ConfigManager;
  private config!: GradingAgentConfig; // Using definite assignment assertion since it's initialized in setupConfigSync
  private lastUpdate!: Date; // Using definite assignment assertion since it's initialized in setupConfigSync
  private readonly updateInterval: number = 5 * 60 * 1000; // 5 minutes

  private constructor(private supabase: SupabaseClient) {
    this.setupConfigSync();
  }

  public static getInstance(supabase: SupabaseClient): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager(supabase);
    }
    return ConfigManager.instance;
  }

  private async setupConfigSync(): Promise<void> {
    await this.refreshConfig();
    
    this.supabase
      .channel('grading_config_changes')
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'grading_config' 
      }, () => this.refreshConfig())
      .subscribe();

    setInterval(() => this.refreshConfig(), this.updateInterval);
  }

  private async refreshConfig(): Promise<void> {
    try {
      const { data, error } = await this.supabase
        .from('grading_config')
        .select('*')
        .single();

      if (error) throw error;

      this.config = {
        supabase: this.supabase,
        metricsPort: data.metrics_port || 9002,
        retryAttempts: data.retry_attempts || 3,
        gradingThresholds: {
          S: data.s_tier_threshold || 85,
          A: data.a_tier_threshold || 75,
          B: data.b_tier_threshold || 65,
          C: data.c_tier_threshold || 55,
          D: data.d_tier_threshold || 45
        }
      };

      this.lastUpdate = new Date();
      logger.info('Grading config refreshed successfully');
    } catch (error) {
      logger.error('Failed to refresh grading config:', error);
      throw error;
    }
  }

  public getConfig(): GradingAgentConfig {
    return this.config;
  }

  public getLastUpdate(): Date {
    return this.lastUpdate;
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
      agentName: 'GradingAgent',
      successCount: 0,
      errorCount: 0,
      warningCount: 0,
      processingTimeMs: 0,
      memoryUsageMb: process.memoryUsage().heapUsed / 1024 / 1024
    };
  }
}