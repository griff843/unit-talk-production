#!/usr/bin/env node

import 'dotenv/config';
import { createLogger } from '../utils/logger';
import { Worker } from '@temporalio/worker';
import { Connection, Client } from '@temporalio/client';
const logger = createLogger('TemporalTestRunner');

/**
 * TEMPORAL WORKFLOW TEST RUNNER
 * Validates that Temporal workflows can run without issues
 */
export class TemporalTestRunner {
  private connection?: Connection;
  private client?: Client;
  private worker?: Worker;

  async run(): Promise<void> {
    try {
      logger.info('🚀 Starting Temporal Test Runner');
      
      await this.setupTemporal();
      await this.testBasicWorkflows();
      await this.testSyndicateWorkflows();
      
      logger.info('✅ All Temporal tests passed');
      
    } catch (error) {
      logger.error('❌ Temporal test failed:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  private async setupTemporal(): Promise<void> {
    try {
      // Connect to Temporal server
      this.connection = await Connection.connect({
        address: process.env['TEMPORAL_ADDRESS'] || 'localhost:7233'
      });

      this.client = new Client({
        connection: this.connection,
        namespace: process.env['TEMPORAL_NAMESPACE'] || 'default'
      });

      logger.info('✅ Temporal infrastructure ready');

    } catch (error) {
      logger.error('❌ Failed to setup Temporal:', error);
      throw error;
    }
  }

  private async testBasicWorkflows(): Promise<void> {
    logger.info('🔄 Testing basic workflows...');
    
    try {
      if (!this.client) throw new Error('Temporal client not initialized');
      
      // Test analytics workflow
      const analyticsHandle = await this.client.workflow.start('analyticsWorkflow', {
        args: [{ test: true }],
        taskQueue: process.env['TEMPORAL_TASK_QUEUE'] || 'unit-talk-local',
        workflowId: `test-analytics-${Date.now()}`
      });

      await Promise.race([
        analyticsHandle.result(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Analytics workflow timeout')), 10000))
      ]);

      logger.info('✅ Analytics workflow test passed');

      // Test notification workflow
      const notificationHandle = await this.client.workflow.start('notificationWorkflow', {
        args: [{ test: true }],
        taskQueue: process.env['TEMPORAL_TASK_QUEUE'] || 'unit-talk-local',
        workflowId: `test-notification-${Date.now()}`
      });

      await Promise.race([
        notificationHandle.result(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Notification workflow timeout')), 10000))
      ]);

      logger.info('✅ Notification workflow test passed');
      
    } catch (error) {
      logger.error('❌ Basic workflow test failed:', error);
      throw error;
    }
  }

  private async testSyndicateWorkflows(): Promise<void> {
    logger.info('🔄 Testing syndicate workflows...');
    
    try {
      if (!this.client) throw new Error('Temporal client not initialized');
      
      // Test league ingestion workflow
      const ingestionHandle = await this.client.workflow.start('leagueIngestionWorkflow', {
        args: [{ league: 'MLB', isLiveMode: true, cycleCount: 1 }],
        taskQueue: process.env['TEMPORAL_TASK_QUEUE'] || 'unit-talk-local',
        workflowId: `test-ingestion-${Date.now()}`
      });

      await Promise.race([
        ingestionHandle.result(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Ingestion workflow timeout')), 15000))
      ]);

      logger.info('✅ League ingestion workflow test passed');

      // Test USP processing workflow
      const uspHandle = await this.client.workflow.start('uspProcessingWorkflow', {
        args: [{ leagues: ['MLB'], isLiveMode: true, cycleCount: 1 }],
        taskQueue: process.env['TEMPORAL_TASK_QUEUE'] || 'unit-talk-local',
        workflowId: `test-usp-${Date.now()}`
      });

      await Promise.race([
        uspHandle.result(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('USP workflow timeout')), 15000))
      ]);

      logger.info('✅ USP processing workflow test passed');

      // Test grading and scoring workflow
      const gradingHandle = await this.client.workflow.start('gradingAndScoringWorkflow', {
        args: [{ leagues: ['MLB'], isLiveMode: true, cycleCount: 1 }],
        taskQueue: process.env['TEMPORAL_TASK_QUEUE'] || 'unit-talk-local',
        workflowId: `test-grading-${Date.now()}`
      });

      await Promise.race([
        gradingHandle.result(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Grading workflow timeout')), 15000))
      ]);

      logger.info('✅ Grading and scoring workflow test passed');

      // Test Discord alert workflow
      const alertHandle = await this.client.workflow.start('discordAlertWorkflow', {
        args: [{ cycleCount: 1, isLiveMode: true }],
        taskQueue: process.env['TEMPORAL_TASK_QUEUE'] || 'unit-talk-local',
        workflowId: `test-alert-${Date.now()}`
      });

      await Promise.race([
        alertHandle.result(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Alert workflow timeout')), 10000))
      ]);

      logger.info('✅ Discord alert workflow test passed');
      
    } catch (error) {
      logger.error('❌ Syndicate workflow test failed:', error);
      throw error;
    }
  }

  private createMockActivities(): any {
    return {
      // Feed Agent Activities
      ingestOptimalProps: async () => ({
        success: true,
        batchId: `mock-batch-${Date.now()}`,
        propCount: 50,
        error: undefined
      }),

      ingestFallbackProps: async () => ({
        success: true,
        batchId: `mock-fallback-batch-${Date.now()}`,
        propCount: 30
      }),

      getLiveGames: async (params: any) => [
        {
          id: 'mock-game-1',
          league: params.league,
          homeTeam: 'Team A',
          awayTeam: 'Team B',
          startTime: new Date(),
          status: 'live' as const
        }
      ],

      deduplicateAndNormalize: async (params: any) => {
        logger.info(`Mock: Deduplicating ${params.league} batch ${params.batchId}`);
      },

      triggerGrading: async (params: any) => {
        logger.info(`Mock: Triggering grading for ${params.propCount} props`);
      },

      fetchFeed: async () => {
        logger.info('Mock: Fetching feed data');
      },

      // Alert Agent Activities
      detectSteamMovement: async () => [
        {
          propId: 'mock-prop-1',
          league: 'MLB',
          oldLine: -110,
          newLine: -120,
          movement: 10,
          timestamp: new Date()
        }
      ],

      detectLineMovement: async () => [],
      detectHedgeOpportunities: async () => [],
      detectMiddleOpportunities: async () => [],
      detectStaleLines: async () => [],
      detectInjuryImpacts: async () => [],
      detectSuspiciousActivity: async () => [],

      sendQuotaWarning: async (params: any) => {
        logger.info(`Mock: Quota warning for ${params.provider}`);
      },

      sendQuotaCritical: async (params: any) => {
        logger.info(`Mock: Critical quota alert for ${params.provider}`);
      },

      sendHealthAlert: async (params: any) => {
        logger.info(`Mock: Health alert - score: ${params.healthScore}`);
      },

      sendWeeklyReport: async () => {
        logger.info('Mock: Sending weekly report');
      },

      checkLeagueOpportunities: async (params: any) => {
        logger.info(`Mock: Checking ${params.league} opportunities`);
      },

      processAlert: async () => {
        logger.info('Mock: Processing alert');
      },

      // Grading Agent Activities
      gradeNewProps: async (params: any) => ({
        league: params.league,
        topTierProps: [
          { id: 'prop-1', tier: 'S', score: 95 },
          { id: 'prop-2', tier: 'A', score: 85 }
        ],
        gradedCount: 2
      }),
      
      scoreTopTierPicks: async (params: any) => ({
        league: params.league,
        scoredPicks: params.gradedProps,
        scoreCount: params.gradedProps.length
      }),
      
      updateFinalPicks: async (params: any) => {
        logger.info(`Mock: Updated final picks for cycle ${params.cycleCount}`);
      },
      
      getNewFinalPicks: async (params: any) => [
        {
          id: 'final-pick-1',
          league: 'MLB',
          player: 'Mock Player',
          prop: 'Over 2.5 Hits',
          tier: 'S'
        }
      ],
      
      gradeSubmission: async () => {
        logger.info('Mock: Grading submission');
      },

      // Notification Agent Activities
      sendCriticalDiscordAlerts: async (params: any) => {
        logger.info(`Mock: Sending ${params.alerts.length} critical Discord alerts`);
      },

      batchDiscordAlerts: async (params: any) => {
        logger.info(`Mock: Batching ${params.alerts.length} Discord alerts`);
      },

      buildPickEmbeds: async (params: any) => params.picks.map((pick: any) => ({
        embed: { title: `Mock Embed for ${pick.player}` },
        priority: 'high' as const
      })),

      sendDiscordEmbed: async (params: any) => {
        logger.info(`Mock: Sending Discord embed with priority ${params.priority}`);
      },

      sendNotification: async () => {
        logger.info('Mock: Sending notification');
      },

      // Operator Agent Activities
      updateLiveGameStatus: async (params: any) => {
        logger.info(`Mock: Updated live game status - ${params.totalCount} games`);
        return params.liveGames;
      },

      ensureLiveMode: async (params: any) => {
        logger.info(`Mock: Ensuring live mode - ${params.reason}`);
      },

      ensureOffPeakMode: async (params: any) => {
        logger.info(`Mock: Ensuring off-peak mode - ${params.reason}`);
      },

      checkApiQuota: async (params: any) => ({
        provider: params.provider,
        hourlyLimit: 900,
        hourlyUsed: 450,
        remainingCalls: 450,
        resetTime: new Date(Date.now() + 3600000),
        status: 'healthy' as const
      }),

      activateFallbackMode: async (params: any) => {
        logger.info(`Mock: Activating fallback from ${params.primary} to ${params.fallbacks.join(', ')}`);
      },

      logQuotaStatus: async (params: any) => {
        logger.info(`Mock: Logging quota status for ${params.providers.length} providers`);
      },

      checkDatabaseHealth: async () => ({
        connected: true,
        responseTime: 50,
        activeConnections: 10
      }),

      checkApiEndpoints: async (params: any) => params.endpoints.map((endpoint: string) => ({
        name: endpoint,
        healthy: true,
        responseTime: 100
      })),

      getWorkflowMetrics: async () => ({
        totalExecutions: 100,
        successfulExecutions: 95,
        failedExecutions: 5,
        failureRate: 0.05,
        avgExecutionTime: 2000
      }),

      getSystemMetrics: async () => ({
        memoryUsage: 0.6,
        cpuUsage: 0.4,
        diskUsage: 0.3,
        networkLatency: 20
      }),

      logHealthStatus: async (params: any) => {
        logger.info(`Mock: Logging health status - score: ${params.healthScore}`);
      },

      logError: async (params: any) => {
        logger.info(`Mock: Logging error in ${params.workflow || 'unknown'}: ${params.error}`);
      },

      logPerformanceWarning: async (params: any) => {
        logger.info(`Mock: Performance warning - cycle ${params.cycleCount} took ${params.cycleTime}ms`);
      },

      handleCriticalError: async (params: any) => {
        logger.info(`Mock: Handling critical error in cycle ${params.cycleCount}`);
      },

      logFallbackActivation: async (params: any) => {
        logger.info(`Mock: Fallback activated for ${params.league} - ${params.primaryError}`);
      },

      logUSPError: async (params: any) => {
        logger.info(`Mock: USP error for ${params.uspType} in cycle ${params.cycleCount}`);
      },

      logGradingError: async (params: any) => {
        logger.info(`Mock: Grading error for leagues ${params.leagues.join(', ')}`);
      },

      logDiscordMetrics: async (params: any) => {
        logger.info(`Mock: Discord metrics - ${params.picksCount} picks, ${params.deliveryTime}ms delivery`);
      },

      logDiscordError: async (params: any) => {
        logger.info(`Mock: Discord error in cycle ${params.cycleCount}: ${params.error}`);
      },

      updateProcessingMetrics: async (params: any) => {
        logger.info(`Mock: Processing metrics for ${params.league} - ${params.propCount} props`);
      },

      monitorSystem: async () => {
        logger.info('Mock: Monitoring system');
      },

      // Base Agent Activities
      healthCheck: async () => ({
        status: 'healthy' as const,
        checks: [
          { name: 'database', status: 'pass' as const },
          { name: 'api', status: 'pass' as const }
        ]
      }),

      collectMetrics: async () => ({
        timestamp: new Date(),
        metrics: { cpu: 0.4, memory: 0.6, requests: 100 }
      }),

      logActivity: async (params: any) => {
        logger.info(`Mock: ${params.level.toUpperCase()}: ${params.message}`);
      },

      // Other agent activities
      runAnalysis: async () => {
        logger.info('Mock: Running analysis');
      },

      runAudit: async () => {
        logger.info('Mock: Running audit');
      },

      createPromotion: async () => {
        logger.info('Mock: Creating promotion');
      },

      createContest: async () => {
        logger.info('Mock: Creating contest');
      }
    };
  }

  private async cleanup(): Promise<void> {
    try {
      if (this.worker) {
        this.worker.shutdown();
      }
      
      if (this.connection) {
        await this.connection.close();
      }
      
      logger.info('✅ Cleanup completed');
      
    } catch (error) {
      logger.error('Error during cleanup:', error);
    }
  }
}

// CLI execution
if (require.main === module) {
  const runner = new TemporalTestRunner();
  runner.run().catch((error) => {
    console.error('❌ Temporal test failed:', error);
    process.exit(1);
  });
}

export default TemporalTestRunner;