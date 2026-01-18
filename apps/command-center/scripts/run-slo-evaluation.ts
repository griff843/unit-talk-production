#!/usr/bin/env tsx

/**
 * SLO Evaluation Background Job - Phase 3
 *
 * Standalone script to evaluate all SLOs and emit alerts.
 * Can be run manually or scheduled via cron/task scheduler.
 *
 * Usage:
 *   npx tsx scripts/run-slo-evaluation.ts
 *   node --loader ts-node/esm scripts/run-slo-evaluation.ts
 *
 * Environment variables required:
 *   DATABASE_URL - Local Postgres connection string
 *   NEXT_PUBLIC_SUPABASE_URL - Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY - Supabase service role key
 *   ALERTING_ENABLED - Enable/disable alerting (default: true)
 *   ALERTING_CHANNEL - discord|db|log (default: log)
 *   DISCORD_ALERT_WEBHOOK - Discord webhook URL (if channel=discord)
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.join(__dirname, '../.env.local') });

// Now import our modules after env is loaded
import { evaluateAndGenerateAlerts } from '../src/lib/slo/evaluator';
import { emitAlerts, getAlertingConfig } from '../src/lib/alerts/emitter';
import { closeConnections } from '../src/lib/slo/datasources';

async function main() {
  console.log('================================================================================');
  console.log('[SLO Evaluation Job] Starting...');
  console.log(`[SLO Evaluation Job] Timestamp: ${new Date().toISOString()}`);
  console.log('================================================================================');

  const startTime = Date.now();

  try {
    // Check required environment variables
    const requiredEnvVars = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    if (missingVars.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missingVars.join(', ')}`
      );
    }

    // Log configuration (redacted)
    const config = getAlertingConfig();
    console.log('[Config] Alerting enabled:', config.enabled);
    console.log('[Config] Alert channel:', config.channel);
    console.log('[Config] Rate limit:', config.rateLimitMinutes, 'minutes');
    if (config.discordWebhookUrl) {
      console.log('[Config] Discord webhook: CONFIGURED (redacted)');
    }

    if (!process.env.DATABASE_URL) {
      console.warn('[Warning] DATABASE_URL not set - local postgres metrics unavailable');
    }

    console.log('\n[Step 1] Evaluating all SLOs...');
    const { status, alerts } = await evaluateAndGenerateAlerts();

    console.log(`[Step 1] Evaluation complete - Overall status: ${status.overall_status}`);
    console.log(`[Step 1] ${alerts.length} alerts generated`);
    console.log('\nSLO Status Summary:');
    console.log('--------------------------------------------------');
    for (const slo of status.slos) {
      const statusSymbol =
        slo.status === 'PASS'
          ? '✓'
          : slo.status === 'WARN'
            ? '⚠'
            : slo.status === 'FAIL'
              ? '✗'
              : '?';
      console.log(
        `${statusSymbol} ${slo.slo_name.padEnd(25)} ${slo.status.padEnd(8)} ${slo.current_value !== null ? slo.current_value : 'N/A'} / ${slo.threshold}`
      );
    }
    console.log('--------------------------------------------------\n');

    if (alerts.length > 0) {
      console.log('[Step 2] Emitting alerts...');
      await emitAlerts(alerts);
      console.log(`[Step 2] ${alerts.length} alerts emitted successfully`);

      console.log('\nGenerated Alerts:');
      console.log('--------------------------------------------------');
      for (const alert of alerts) {
        console.log(
          `[${alert.severity.toUpperCase()}] ${alert.slo_name}: ${alert.message}`
        );
      }
      console.log('--------------------------------------------------\n');
    } else {
      console.log('[Step 2] No alerts to emit - all SLOs passing\n');
    }

    const executionTime = Date.now() - startTime;

    console.log('================================================================================');
    console.log('[SLO Evaluation Job] Completed successfully');
    console.log(`[SLO Evaluation Job] Execution time: ${executionTime}ms`);
    console.log(`[SLO Evaluation Job] Timestamp: ${new Date().toISOString()}`);
    console.log('================================================================================');

    // Clean up connections
    await closeConnections();

    process.exit(0);
  } catch (error) {
    const executionTime = Date.now() - startTime;

    console.error('================================================================================');
    console.error('[SLO Evaluation Job] FAILED');
    console.error(`[SLO Evaluation Job] Execution time: ${executionTime}ms`);
    console.error(`[SLO Evaluation Job] Error:`, error);
    console.error('================================================================================');

    // Clean up connections
    await closeConnections();

    process.exit(1);
  }
}

// Run the job
main();
