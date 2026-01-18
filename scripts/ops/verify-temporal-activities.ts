#!/usr/bin/env tsx
/**
 * Temporal Activity Verification Script
 *
 * Verifies that all activities referenced in workflows are properly implemented
 * and exported by their respective agent activity files.
 *
 * Usage:
 *   npx tsx scripts/ops/verify-temporal-activities.ts
 *   npx tsx scripts/ops/verify-temporal-activities.ts --verbose
 */

import * as fs from 'fs';
import * as path from 'path';

const ROOT_DIR = path.join(__dirname, '../..');
const APPS_API_DIR = path.join(ROOT_DIR, 'apps/api/src');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

interface ActivityCheck {
  name: string;
  workflow: string;
  defined: boolean;
  exported: boolean;
  agent: string;
}

const results: ActivityCheck[] = [];

console.log(`${colors.cyan}============================================================================${colors.reset}`);
console.log(`${colors.cyan}TEMPORAL ACTIVITY VERIFICATION${colors.reset}`);
console.log(`${colors.cyan}============================================================================${colors.reset}\n`);

/**
 * Expected activities based on workflows and type definitions
 */
const EXPECTED_ACTIVITIES = {
  OperatorAgent: [
    'checkApiQuota',
    'updateLiveGameStatus',
    'logError',
    'handleCriticalError',
    'logUSPError',
    'monitorSystem'
  ],
  FeedAgent: [
    'fetchFeed',
    'getLiveGames',
    'ingestOptimalProps',
    'ingestUnifiedData',
    'ingestFallbackProps'
  ],
  AlertAgent: [
    'processAlert',
    'detectSteamMovement',
    'detectLineMovement',
    'detectHedgeOpportunities'
    // REMOVED DEAD CODE (verified not used in any workflow):
    // 'sendQuotaWarning' - workflows use processAlert({ type: 'quota' }) instead
    // 'sendQuotaCritical' - workflows use processAlert({ type: 'quota', severity: 'critical' }) instead
  ],
  GradingAgent: [
    'gradeNewProps',
    'scoreTopTierPicks',
    'updateUnifiedPicks'
  ],
  NotificationAgent: [
    'sendCriticalDiscordAlerts',
    'batchDiscordAlerts'
    // REMOVED DEAD CODE (verified not used in any workflow):
    // 'sendDiscordEmbed' - workflows use sendCriticalDiscordAlerts/batchDiscordAlerts instead
  ]
};

/**
 * Check if an activity is exported by an agent's activities file
 */
function checkActivityExported(agent: string, activityName: string): boolean {
  const activitiesPath = path.join(
    APPS_API_DIR,
    `agents/${agent}/activities/index.ts`
  );

  if (!fs.existsSync(activitiesPath)) {
    console.log(`${colors.yellow}⚠️  Activities file not found: ${activitiesPath}${colors.reset}`);
    return false;
  }

  const content = fs.readFileSync(activitiesPath, 'utf-8');

  // Check for export patterns:
  // - export async function activityName
  // - export function activityName
  // - export const activityName
  const exportPatterns = [
    `export async function ${activityName}`,
    `export function ${activityName}`,
    `export const ${activityName}`,
  ];

  return exportPatterns.some(pattern => content.includes(pattern));
}

/**
 * Check if an activity is defined in type definitions
 */
function checkActivityDefined(activityName: string): boolean {
  const typesPath = path.join(APPS_API_DIR, 'types/activities.ts');

  if (!fs.existsSync(typesPath)) {
    console.log(`${colors.yellow}⚠️  Types file not found: ${typesPath}${colors.reset}`);
    return false;
  }

  const content = fs.readFileSync(typesPath, 'utf-8');

  // Check if activity name appears in type definitions
  return content.includes(`${activityName}(`);
}

/**
 * Main verification logic
 */
function verifyActivities() {
  let totalChecks = 0;
  let passedChecks = 0;
  let failedChecks = 0;

  Object.entries(EXPECTED_ACTIVITIES).forEach(([agent, activities]) => {
    console.log(`${colors.cyan}[${agent}]${colors.reset}`);
    console.log(`${colors.white}${'─'.repeat(60)}${colors.reset}`);

    activities.forEach(activityName => {
      totalChecks++;
      const defined = checkActivityDefined(activityName);
      const exported = checkActivityExported(agent, activityName);

      results.push({
        name: activityName,
        workflow: 'support-workflows',
        defined,
        exported,
        agent
      });

      if (defined && exported) {
        console.log(`${colors.green}✅ ${activityName}${colors.reset} - Type defined ✓ | Exported ✓`);
        passedChecks++;
      } else if (defined && !exported) {
        console.log(`${colors.red}❌ ${activityName}${colors.reset} - Type defined ✓ | ${colors.red}Exported ✗${colors.reset}`);
        console.log(`   ${colors.yellow}⚠️  Activity is defined in types but NOT exported by ${agent}/activities/index.ts${colors.reset}`);
        failedChecks++;
      } else if (!defined && exported) {
        console.log(`${colors.yellow}⚠️  ${activityName}${colors.reset} - ${colors.yellow}Type defined ✗${colors.reset} | Exported ✓`);
        console.log(`   ${colors.yellow}Activity is exported but missing type definition${colors.reset}`);
        failedChecks++;
      } else {
        console.log(`${colors.red}❌ ${activityName}${colors.reset} - Type defined ✗ | Exported ✗`);
        console.log(`   ${colors.red}Activity is completely missing${colors.reset}`);
        failedChecks++;
      }
    });

    console.log('');
  });

  return { totalChecks, passedChecks, failedChecks };
}

/**
 * Print summary report
 */
function printSummary(stats: { totalChecks: number; passedChecks: number; failedChecks: number }) {
  console.log(`${colors.cyan}============================================================================${colors.reset}`);
  console.log(`${colors.cyan}VERIFICATION SUMMARY${colors.reset}`);
  console.log(`${colors.cyan}============================================================================${colors.reset}\n`);

  console.log(`Total Checks:  ${stats.totalChecks}`);
  console.log(`${colors.green}Passed:        ${stats.passedChecks}${colors.reset}`);
  console.log(`${colors.red}Failed:        ${stats.failedChecks}${colors.reset}`);
  console.log(`Success Rate:  ${((stats.passedChecks / stats.totalChecks) * 100).toFixed(1)}%\n`);

  if (stats.failedChecks > 0) {
    console.log(`${colors.yellow}FAILED CHECKS:${colors.reset}\n`);

    results
      .filter(r => !r.defined || !r.exported)
      .forEach(result => {
        console.log(`${colors.red}❌ ${result.name}${colors.reset}`);
        console.log(`   Agent: ${result.agent}`);
        console.log(`   Type Defined: ${result.defined ? '✓' : '✗'}`);
        console.log(`   Exported: ${result.exported ? '✓' : '✗'}`);

        if (result.defined && !result.exported) {
          console.log(`   ${colors.yellow}Fix: Add export to apps/api/src/agents/${result.agent}/activities/index.ts${colors.reset}`);
        } else if (!result.defined && result.exported) {
          console.log(`   ${colors.yellow}Fix: Add type definition to apps/api/src/types/activities.ts${colors.reset}`);
        } else {
          console.log(`   ${colors.yellow}Fix: Implement activity in ${result.agent} and add type definition${colors.reset}`);
        }
        console.log('');
      });
  }

  if (stats.failedChecks === 0) {
    console.log(`${colors.green}✅ ALL ACTIVITIES VERIFIED - Worker should register successfully${colors.reset}\n`);
  } else {
    console.log(`${colors.red}❌ VERIFICATION FAILED - Fix missing activities before starting worker${colors.reset}\n`);
  }

  console.log(`${colors.cyan}============================================================================${colors.reset}`);
}

/**
 * Main execution
 */
function main() {
  const verbose = process.argv.includes('--verbose');

  if (verbose) {
    console.log(`Working directory: ${ROOT_DIR}`);
    console.log(`API source: ${APPS_API_DIR}\n`);
  }

  const stats = verifyActivities();
  printSummary(stats);

  // Exit with error code if verification failed
  process.exit(stats.failedChecks > 0 ? 1 : 0);
}

main();
