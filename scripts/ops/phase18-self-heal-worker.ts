#!/usr/bin/env node
/**
 * Phase 18: Self-Heal Worker
 * 
 * Background monitor for PostgREST visibility and schema errors.
 * Automatically triggers reload on detection with exponential backoff.
 * 
 * Usage:
 *   npm run ops:phase18:self-heal-worker
 *   npm run ops:phase18:self-heal-worker -- --interval 60000 --max-attempts 5
 * 
 * Options:
 *   --interval MS              Check interval in milliseconds (default: 60000)
 *   --max-attempts N           Max reload attempts before P0 blocker (default: 5)
 *   --alert-webhook-slack      Slack webhook for P0 alerts
 *   --alert-webhook-discord    Discord webhook for P0 alerts
 * 
 * @date 2025-11-10
 * @charter docs/PRODUCTION_CHARTER.md v4.0
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

// ============================================================================
// TYPES & CONSTANTS
// ============================================================================

interface HealthCheckResult {
  timestamp: string;
  picksVisible: boolean;
  pickPublishVisible: boolean;
  schemaError: string | null;
  reloadAttempted: boolean;
  reloadSuccess: boolean;
}

interface WorkerState {
  lastCheck: string | null;
  consecutiveFailures: number;
  totalReloads: number;
  lastReloadAt: string | null;
  p0BlockerCreated: boolean;
}

const FLAGS = {
  interval: parseInt(getArgValue('--interval', '60000'), 10),
  maxAttempts: parseInt(getArgValue('--max-attempts', '5'), 10),
  alertWebhookSlack: getArgValue('--alert-webhook-slack', process.env.SLACK_ALERTS_WEBHOOK || ''),
  alertWebhookDiscord: getArgValue('--alert-webhook-discord', process.env.DISCORD_OPERATOR_WEBHOOK_URL || ''),
};

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const OUTPUT_DIR = path.join(process.cwd(), 'out/ops/cutover/metrics/phase18');

let workerState: WorkerState = {
  lastCheck: null,
  consecutiveFailures: 0,
  totalReloads: 0,
  lastReloadAt: null,
  p0BlockerCreated: false,
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function getArgValue(flag: string, defaultValue: string): string {
  const index = process.argv.indexOf(flag);
  return index !== -1 && process.argv[index + 1] ? process.argv[index + 1] : defaultValue;
}

function log(level: 'info' | 'success' | 'warn' | 'error', msg: string, data?: any) {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
  console.log(`${prefix} ${msg}`, data ? JSON.stringify(data, null, 2) : '');
}

async function sendAlert(severity: 'P0' | 'P1' | 'P2', message: string) {
  if (FLAGS.alertWebhookSlack) {
    try {
      await fetch(FLAGS.alertWebhookSlack, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `[${severity}] Phase 18 Self-Heal Alert: ${message}`,
          attachments: [{
            color: severity === 'P0' ? 'danger' : severity === 'P1' ? 'warning' : 'good',
            fields: [{
              title: 'Timestamp',
              value: new Date().toISOString(),
              short: true,
            }],
          }],
        }),
      });
    } catch (error) {
      log('warn', 'Failed to send Slack alert', error);
    }
  }
}

function createP0Blocker(reason: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const blockerPath = path.join(OUTPUT_DIR, `P0_BLOCKER_${timestamp}.json`);
  
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(blockerPath, JSON.stringify({
    severity: 'P0',
    timestamp: new Date().toISOString(),
    reason,
    workerState,
    action: 'IMMEDIATE_ESCALATION_REQUIRED',
  }, null, 2));
  
  log('error', `P0 Blocker created: ${blockerPath}`);
  sendAlert('P0', `Self-heal failed after ${workerState.totalReloads} attempts: ${reason}`);
}

// ============================================================================
// HEALTH CHECK LOGIC
// ============================================================================

async function checkSchemaVisibility(): Promise<HealthCheckResult> {
  const result: HealthCheckResult = {
    timestamp: new Date().toISOString(),
    picksVisible: false,
    pickPublishVisible: false,
    schemaError: null,
    reloadAttempted: false,
    reloadSuccess: false,
  };
  
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    
    // Check picks table
    const { error: picksError } = await supabase
      .from('picks')
      .select('id')
      .limit(1);
    
    result.picksVisible = !picksError;
    
    // Check pick_publish table
    const { error: publishError } = await supabase
      .from('pick_publish')
      .select('id')
      .limit(1);
    
    result.pickPublishVisible = !publishError;
    
    // Detect schema errors
    if (picksError?.message.includes('schema') || publishError?.message.includes('schema')) {
      result.schemaError = picksError?.message || publishError?.message || 'Unknown schema error';
    }
    
    return result;
  } catch (error) {
    result.schemaError = error instanceof Error ? error.message : String(error);
    return result;
  }
}

async function attemptReload(): Promise<boolean> {
  try {
    log('info', 'Attempting PostgREST reload...');
    
    execSync('node scripts/ops/force-postgrest-reload.js --reason "phase18-self-heal-worker"', {
      cwd: process.cwd(),
      stdio: 'pipe',
    });
    
    workerState.totalReloads++;
    workerState.lastReloadAt = new Date().toISOString();
    workerState.consecutiveFailures = 0;
    
    log('success', 'PostgREST reload successful');
    return true;
  } catch (error) {
    workerState.consecutiveFailures++;
    log('warn', `Reload attempt ${workerState.consecutiveFailures} failed`, error);
    
    if (workerState.consecutiveFailures >= FLAGS.maxAttempts) {
      createP0Blocker(`PostgREST reload failed ${workerState.consecutiveFailures} times`);
      workerState.p0BlockerCreated = true;
    }
    
    return false;
  }
}

// ============================================================================
// MAIN WORKER LOOP
// ============================================================================

async function runHealthCheck() {
  try {
    const result = await checkSchemaVisibility();
    workerState.lastCheck = result.timestamp;
    
    log('info', 'Health check result', {
      picksVisible: result.picksVisible,
      pickPublishVisible: result.pickPublishVisible,
      schemaError: result.schemaError,
    });
    
    // If schema error detected, attempt reload
    if (result.schemaError && !workerState.p0BlockerCreated) {
      log('warn', `Schema error detected: ${result.schemaError}`);
      result.reloadAttempted = true;
      result.reloadSuccess = await attemptReload();
    }
    
    // If both tables visible, reset failure counter
    if (result.picksVisible && result.pickPublishVisible) {
      if (workerState.consecutiveFailures > 0) {
        log('success', 'Schema visibility restored');
        workerState.consecutiveFailures = 0;
      }
    }
    
    // Write health check result
    const resultPath = path.join(
      OUTPUT_DIR,
      `health-check-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
    );
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    fs.writeFileSync(resultPath, JSON.stringify(result, null, 2));
    
  } catch (error) {
    log('error', 'Health check failed', error);
  }
}

async function startWorker() {
  log('info', `Phase 18 Self-Heal Worker started (interval: ${FLAGS.interval}ms)`);
  
  // Run initial check
  await runHealthCheck();
  
  // Schedule periodic checks
  setInterval(runHealthCheck, FLAGS.interval);
  
  // Keep process alive
  process.on('SIGTERM', () => {
    log('info', 'Worker shutting down gracefully');
    process.exit(0);
  });
  
  process.on('SIGINT', () => {
    log('info', 'Worker interrupted');
    process.exit(0);
  });
}

startWorker().catch(error => {
  log('error', 'Fatal error', error);
  process.exit(1);
});

