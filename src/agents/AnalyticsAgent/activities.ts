// src/agents/AnalyticsAgent/activities.ts

import { AnalyticsAgentActivities, ActivityParams, ActivityResult } from '../../types/activities';
import { AnalyticsAgent, AnalyticsAgentConfig } from './index';
import { createSupabaseClient } from '../../utils/supabase';
import { ErrorHandler } from '../../utils/errorHandling';
import { Logger } from '../../utils/logger';
import { HealthCheckResult, BaseAgentDependencies } from '../../types/agent';
import { Metrics } from '../../types/shared';

export class AnalyticsAgentActivitiesImpl implements AnalyticsAgentActivities {
  private agent: AnalyticsAgent;

  constructor() {
    const supabase = createSupabaseClient();
    const config: AnalyticsAgentConfig = {
      name: 'AnalyticsAgent',
      enabled: true,
      healthCheckIntervalMs: 60000,
      metricsIntervalMs: 30000,
      analysisWindowDays: 30,
      minPicksForAnalysis: 10,
      updateFrequencyMs: 3600000,
      batchSize: 100
    };

    const logger = new Logger('AnalyticsAgent');
    const errorHandler = ErrorHandler.getInstance(supabase, {
      enableLogging: true,
      enableMetrics: true
    });

    const dependencies: BaseAgentDependencies = {
      supabase,
      config,
      errorHandler,
      logger
    };

    this.agent = new AnalyticsAgent(dependencies);
  }

  async initialize(): Promise<void> {
    await this.agent.start();
  }

  async cleanup(): Promise<void> {
    await this.agent.stop();
  }

  async checkHealth(): Promise<HealthCheckResult> {
    return await this.agent['checkHealth']();
  }

  async collectMetrics(): Promise<Metrics> {
    const metrics = await this.agent['collectMetrics']();
    return {
      errorCount: metrics.errorCount,
      warningCount: metrics.warningCount,
      successCount: metrics.successCount,
      ...metrics
    };
  }

  async handleCommand(command: any): Promise<void> {
    await this.agent.handleCommand(command);
  }

  async runAnalysis(params: ActivityParams): Promise<ActivityResult> {
    try {
      await this.agent.handleCommand({
        type: 'RUN_ANALYSIS',
        payload: params
      });
      return {
        success: true
      };
    } catch (error) {
      return {
        success: false,
        error: error as Error
      };
    }
  }

  async generateReport(params: ActivityParams): Promise<ActivityResult> {
    // Implement report generation logic
    return {
      success: true,
      data: {
        message: 'Report generation not yet implemented'
      }
    };
  }

  async exportData(params: ActivityParams): Promise<ActivityResult> {
    // Implement data export logic
    return {
      success: true,
      data: {
        message: 'Data export not yet implemented'
      }
    };
  }
}
