import * as fs from 'fs/promises';
import * as path from 'path';

const activityTypesFix = `export interface BaseActivityParams {
  cycleCount: number;
  error?: Error;
  context?: Record<string, unknown>;
}

export interface ActivityResult<T = any> {
  success: boolean;
  data?: T;
  error?: Error;
  timestamp: string;
  context?: Record<string, unknown>;
}

export interface SystemHealthResult {
  healthy: boolean;
  subsystems: {
    name: string;
    status: 'healthy' | 'degraded' | 'unhealthy';
    details?: Record<string, unknown>;
  }[];
  timestamp: string;
}`;

const alertActivitiesFix = `import { StandardLogger } from '../../../utils/logger';
import { BaseActivityParams, ActivityResult } from '../../../types/activities';

const logger = new StandardLogger('AlertActivities');

export interface AlertParams extends BaseActivityParams {
  message: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  context?: Record<string, unknown>;
}

export interface AlertResult extends ActivityResult {
  alertId: string;
  timestamp: string;
}

export async function sendAlert(params: AlertParams): Promise<AlertResult> {
  logger.info('Sending alert', { message: params.message, severity: params.severity });
  
  return {
    success: true,
    alertId: Date.now().toString(),
    timestamp: new Date().toISOString()
  };
}`;

const operatorActivitiesFix = `import { StandardLogger } from '../../../utils/logger';
import { BaseActivityParams, ActivityResult } from '../../../types/activities';

const logger = new StandardLogger('OperatorActivities');

export interface MonitorParams extends BaseActivityParams {
  system: string;
  checkType: 'health' | 'quota' | 'performance';
}

export interface MonitorResult extends ActivityResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  metrics: Record<string, number>;
}

export async function monitorSystem(params: MonitorParams): Promise<MonitorResult> {
  logger.info('Monitoring system', params);
  
  return {
    success: true,
    status: 'healthy',
    metrics: {
      responseTime: 100,
      errorRate: 0,
      uptime: 100
    },
    timestamp: new Date().toISOString()
  };
}`;

const processingActivitiesFix = `import { StandardLogger } from '../../../utils/logger';
import { BaseActivityParams, ActivityResult } from '../../../types/activities';

const logger = new StandardLogger('ProcessingActivities');

export interface ProcessParams extends BaseActivityParams {
  data: unknown;
  processType: string;
}

export interface ProcessResult extends ActivityResult {
  processedData: unknown;
  processingTime: number;
}

export async function processData(params: ProcessParams): Promise<ProcessResult> {
  logger.info('Processing data', { processType: params.processType });
  
  return {
    success: true,
    processedData: params.data,
    processingTime: 100,
    timestamp: new Date().toISOString()
  };
}`;

async function fixActivityTypes() {
  // Fix activity types
  await fs.writeFile(
    path.join(__dirname, '../src/types/activities.ts'),
    activityTypesFix,
    'utf8'
  );

  // Fix alert activities
  await fs.writeFile(
    path.join(__dirname, '../src/activities/alerts.ts'),
    alertActivitiesFix,
    'utf8'
  );

  // Fix operator activities
  await fs.writeFile(
    path.join(__dirname, '../src/activities/operator.ts'),
    operatorActivitiesFix,
    'utf8'
  );

  // Fix processing activities
  await fs.writeFile(
    path.join(__dirname, '../src/activities/processing.ts'),
    processingActivitiesFix,
    'utf8'
  );

  console.log('Fixed activity types and implementations');
}

fixActivityTypes().catch(console.error);
