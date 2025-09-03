#!/usr/bin/env node

import { createLogger } from '../utils/logger';

// import { Connection } from '@temporalio/client'; // Not used in current implementation
// import { Logger } from '../utils/logger'; // Unused
// import { env } from '../config/env'; // Not used
import { SyndicateScheduleManager } from '../workflows/schedule-manager';

const logger = createLogger('SyndicateScheduler');

async function initializeSyndicateScheduling(): Promise<void> {
  try {
    // Connect to Temporal
    // Connection setup placeholder for future implementation
    // const connection = await Connection.connect({
    //   address: process.env.TEMPORAL_ADDRESS || 'localhost:7233'
    // });

    // const client = new Client({
    //   connection,
    //   namespace: process.env.TEMPORAL_NAMESPACE || 'default'
    // }); // Not used

    // Create schedule manager
    const scheduleManager = new SyndicateScheduleManager() as any;

    // Set up syndicate schedules
    await setupLeagueSchedules(scheduleManager);
    await setupMonitoringSchedules(scheduleManager);
    await setupMaintenanceSchedules(scheduleManager);

    logger.info('Syndicate scheduling initialized successfully', {});
  } catch (error) {
    logger.error('Failed to initialize syndicate scheduling', {
      err: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

async function setupLeagueSchedules(scheduleManager: any): Promise<void> {
  // League ingestion schedule - every 5 minutes
  await scheduleManager.createSchedule({
    scheduleId: 'league-ingestion',
    workflowType: 'leagueIngestionWorkflow',
    workflowArgs: [],
    cronSchedule: '*/5 * * * *'
  });

  // USP processing schedule - every minute
  await scheduleManager.createSchedule({
    scheduleId: 'usp-processing',
    workflowType: 'uspProcessingWorkflow',
    workflowArgs: [],
    cronSchedule: '* * * * *'
  });

  // Grading and scoring schedule - every 2 minutes
  await scheduleManager.createSchedule({
    scheduleId: 'grading-scoring',
    workflowType: 'gradingAndScoringWorkflow',
    workflowArgs: [],
    cronSchedule: '*/2 * * * *'
  });
}

async function setupMonitoringSchedules(scheduleManager: any): Promise<void> {
  // Live game monitoring - every minute
  await scheduleManager.createSchedule({
    scheduleId: 'live-game-monitor',
    workflowType: 'liveGameMonitorWorkflow',
    workflowArgs: [],
    cronSchedule: '* * * * *'
  });

  // API quota monitoring - every 5 minutes
  await scheduleManager.createSchedule({
    scheduleId: 'api-quota-monitor',
    workflowType: 'apiQuotaMonitorWorkflow',
    workflowArgs: [],
    cronSchedule: '*/5 * * * *'
  });

  // System health monitoring - every minute
  await scheduleManager.createSchedule({
    scheduleId: 'system-health-monitor',
    workflowType: 'systemHealthMonitorWorkflow',
    workflowArgs: [],
    cronSchedule: '* * * * *'
  });
}

async function setupMaintenanceSchedules(scheduleManager: any): Promise<void> {
  // Daily maintenance - run at 3 AM
  await scheduleManager.createSchedule({
    scheduleId: 'daily-maintenance',
    workflowType: 'maintenanceWorkflow',
    workflowArgs: [{ type: 'daily' }],
    cronSchedule: '0 3 * * *'
  });

  // Weekly maintenance - run at 2 AM on Sundays
  await scheduleManager.createSchedule({
    scheduleId: 'weekly-maintenance',
    workflowType: 'maintenanceWorkflow',
    workflowArgs: [{ type: 'weekly' }],
    cronSchedule: '0 2 * * 0'
  });
}

if (require.main === module) {
  initializeSyndicateScheduling().catch((error) => {
    logger.error('Failed to start syndicate scheduling', {
      error: error instanceof Error ? error.message : String(error)
    });
    process.exit(1);
  });
}

export { initializeSyndicateScheduling };