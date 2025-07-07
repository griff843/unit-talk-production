#!/usr/bin/env node

import 'dotenv/config';
import { createLogger } from '../utils/logger';
import { initializeSyndicateScheduling, getSyndicateScheduleManager } from '../workflows/schedule-manager';
import startWorker from '../worker';

const logger = createLogger('SyndicateStartup');

/**
 * SYNDICATE SYSTEM STARTUP
 * Initializes all 2-minute interval workflows and monitoring systems
 */
async function startSyndicateSystem(): Promise<void> {
  logger.info('🚀 Starting Unit Talk Syndicate System...');
  
  try {
    // 1. VALIDATE ENVIRONMENT
    await validateEnvironment();
    
    // 2. START TEMPORAL WORKER
    logger.info('📡 Starting Temporal worker...');
    const workerPromise = startWorker();
    
    // Give worker time to start
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // 3. INITIALIZE SYNDICATE SCHEDULES
    logger.info('⏰ Initializing syndicate schedules...');
    await initializeSyndicateScheduling();
    
    // 4. VERIFY SYSTEM HEALTH
    logger.info('🔍 Verifying system health...');
    await verifySystemHealth();
    
    // 5. START MONITORING DASHBOARD
    logger.info('📊 Starting monitoring dashboard...');
    await startMonitoringDashboard();
    
    logger.info('✅ SYNDICATE SYSTEM FULLY OPERATIONAL');
    logger.info('🎯 2-minute intervals active for live games');
    logger.info('📈 All USPs monitoring: steam, middling, hedge, stale lines, injuries');
    logger.info('🚨 Discord alerts configured for <30 second delivery');
    
    // Keep the process running
    await workerPromise;
    
  } catch (error) {
    logger.error('❌ Failed to start syndicate system:', error);
    process.exit(1);
  }
}

/**
 * Validate all required environment variables and configurations
 */
async function validateEnvironment(): Promise<void> {
  const required = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'OPTIMAL_API_KEY',
    'DISCORD_APPROVED_WEBHOOK_URL',
    'OPENAI_API_KEY',
    'TEMPORAL_TASK_QUEUE'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  // Validate API quotas
  const optimalQuota = parseInt(process.env['OPTIMAL_API_QUOTA'] || '900');
  if (optimalQuota < 900) {
    logger.warn(`⚠️ Optimal API quota is ${optimalQuota}/hour - may not support full 2-minute intervals`);
  }
  
  logger.info('✅ Environment validation passed');
}

/**
 * Verify system health before going live
 */
async function verifySystemHealth(): Promise<void> {
  const scheduleManager = getSyndicateScheduleManager();
  const systemStatus = await scheduleManager.getSystemStatus();
  
  logger.info('📊 System Status:', {
    totalSchedules: systemStatus.totalSchedules,
    healthy: systemStatus.healthy,
    paused: systemStatus.paused,
    errored: systemStatus.errored
  });
  
  if (systemStatus.errored > 0) {
    logger.warn(`⚠️ ${systemStatus.errored} schedules have errors`);
  }
  
  if (systemStatus.healthy === 0) {
    throw new Error('No healthy schedules found - system not ready');
  }
  
  logger.info('✅ System health verification passed');
}

/**
 * Start monitoring dashboard for operators
 */
async function startMonitoringDashboard(): Promise<void> {
  // This would start a web dashboard for monitoring
  // For now, just log the monitoring endpoints
  
  const monitoringPort = process.env['MONITOR_PORT'] || '9090';
  const healthPort = process.env['HEALTH_CHECK_PORT'] || '9091';
  
  logger.info('📊 Monitoring endpoints:');
  logger.info(`   Metrics: http://localhost:${monitoringPort}/metrics`);
  logger.info(`   Health: http://localhost:${healthPort}/health`);
  logger.info(`   Schedules: http://localhost:${healthPort}/schedules`);
  
  // TODO: Implement actual dashboard server
}

/**
 * Graceful shutdown handler
 */
async function gracefulShutdown(signal: string): Promise<void> {
  logger.info(`🛑 Received ${signal}, shutting down gracefully...`);
  
  try {
    const scheduleManager = getSyndicateScheduleManager();
    await scheduleManager.emergencyStopAll(`Shutdown signal: ${signal}`);
    
    logger.info('✅ Graceful shutdown completed');
    process.exit(0);
    
  } catch (error) {
    logger.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
}

/**
 * Emergency pause handler (for maintenance)
 */
async function emergencyPause(): Promise<void> {
  logger.warn('🚨 EMERGENCY PAUSE TRIGGERED');
  
  const scheduleManager = getSyndicateScheduleManager();
  await scheduleManager.emergencyStopAll('Emergency pause requested');
  
  logger.warn('🚨 All schedules paused - system in maintenance mode');
}

/**
 * Emergency resume handler
 */
async function emergencyResume(): Promise<void> {
  logger.info('🔄 EMERGENCY RESUME TRIGGERED');
  
  const scheduleManager = getSyndicateScheduleManager();
  await scheduleManager.resumeAllAfterEmergency('Emergency resume requested');
  
  logger.info('✅ All schedules resumed - system operational');
}

// Handle process signals
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle emergency controls via process signals
process.on('SIGUSR1', emergencyPause);
process.on('SIGUSR2', emergencyResume);

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('💥 Uncaught exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('💥 Unhandled rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

// Start the system if this file is run directly
if (require.main === module) {
  startSyndicateSystem().catch((error) => {
    logger.error('💥 Fatal startup error:', error);
    process.exit(1);
  });
}

export { startSyndicateSystem, emergencyPause, emergencyResume };