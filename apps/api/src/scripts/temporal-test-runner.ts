#!/usr/bin/env node

// import { Logger } from '../../utils/logger'; // Unused

import 'dotenv/config';
import { Connection, Client } from '@temporalio/client';
import { Worker } from '@temporalio/worker';

import { ErrorHandler } from '../utils/errorHandling';
import { StandardLogger } from '../utils/logger';
// import { supabase } from '../clients/supabase'; // Not available
// import { BaseAgentConfig } from '../agents/BaseAgent/types'; // Not used

const logger = new StandardLogger({ level: 'info' });
// const baseAgentConfig: BaseAgentConfig = {
//   name: 'TemporalTestRunner',
//   version: '1.0.0',
//   logLevel: 'info',
//   metrics: { enabled: true, interval: 60000 },
//   health: { enabled: true, interval: 60000 },
//   retry: { enabled: true, maxRetries: 3, backoffMs: 1000 },
// };

const errorHandlerInstance = new ErrorHandler('TemporalTestRunner');

// Dependencies removed - not needed in current implementation

/**
 * TEMPORAL WORKFLOW TEST RUNNER
 * Validates that Temporal workflows can run without issues
 */
export class TemporalTestRunner {
  private connection: Connection | null = null;
  private client: Client | null = null;
  private worker: Worker | null = null;

  async run(): Promise<void> {
    try {
      logger.info('🚀 Starting Temporal Test Runner', {});

      await this.setupTemporal();
      await this.testBasicWorkflows();
      await this.testSyndicateWorkflows();

      logger.info('✅ All Temporal tests passed', {});

      return;
} catch (_error) {
      errorHandlerInstance.handleError(_error as Error);
      throw _error;
    } finally {
      await this.cleanup();
    }
  }

  private async setupTemporal(): Promise<void> {
    try {
      this.connection = await Connection.connect({
        address: process.env.TEMPORAL_ADDRESS || 'localhost:7233'
      });

      this.client = new Client({
        connection: this.connection,
        namespace: process.env.TEMPORAL_NAMESPACE || 'default'
      });

      logger.info('✅ Temporal infrastructure ready', {});
    } catch (_error) {
      errorHandlerInstance.handleError(_error as Error);
      throw _error;
    }
  }

  private async testBasicWorkflows(): Promise<void> {
    logger.info('🔄 Testing basic workflows...', {});
    
    try {
      if (!this.client) {throw new Error('Temporal client not initialized');}
      
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

      logger.info('✅ Analytics workflow test passed', {});

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

      logger.info('✅ Notification workflow test passed', {});
      
    } catch (_error) {
      logger.error('❌ Basic workflow test failed:', _error);
      throw _error;
    }
  }

  private async testSyndicateWorkflows(): Promise<void> {
    logger.info('🔄 Testing syndicate workflows...', {});
    
    try {
      if (!this.client) {throw new Error('Temporal client not initialized');}
      
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

      logger.info('✅ League ingestion workflow test passed', {});

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

      logger.info('✅ USP processing workflow test passed', {});

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

      logger.info('✅ Grading and scoring workflow test passed', {});

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

      logger.info('✅ Discord alert workflow test passed', {});
      
    } catch (_error) {
      logger.error('❌ Syndicate workflow test failed:', _error);
      throw _error;
    }
  }


  private async cleanup(): Promise<void> {
    try {
      if (this.worker) {
        await this.worker.shutdown();
        return;
}

      if (this.connection) {
        await this.connection.close();
      }

      logger.info('✅ Cleanup completed', {});
    } catch (_error) {
      errorHandlerInstance.handleError(_error as Error);
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