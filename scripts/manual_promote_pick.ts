#!/usr/bin/env node
/**
 * Manual Pick Promotion Script
 *
 * Allows operators to manually promote approved picks to Discord publishing
 *
 * Usage:
 *   npx tsx scripts/manual_promote_pick.ts --pickId=<uuid> --channel=CANARY
 *   npx tsx scripts/manual_promote_pick.ts --pickId=<uuid> --threadId=<discord-thread-id>
 *   npx tsx scripts/manual_promote_pick.ts --pickId=<uuid> --scheduledFor="2025-12-03T20:00:00Z"
 *
 * Environment:
 *   - Set API_URL to target environment (default: http://localhost:3000)
 *   - Set ADMIN_TOKEN for authentication (default: admin-test-token)
 *
 * Examples:
 *   # Promote to production Discord
 *   API_URL=https://api.unit-talk.com npx tsx scripts/manual_promote_pick.ts --pickId=abc-123
 *
 *   # Promote to canary channel for testing
 *   npx tsx scripts/manual_promote_pick.ts --pickId=abc-123 --channel=CANARY
 *
 *   # Schedule promotion for specific time
 *   npx tsx scripts/manual_promote_pick.ts --pickId=abc-123 --scheduledFor="2025-12-03T20:00:00Z"
 */

// Load environment from repo root FIRST (before any other imports)
import { loadRootEnv } from '@unit-talk/shared-utils';
loadRootEnv();

const API_URL = process.env.API_URL || 'http://localhost:3000';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'admin-test-token';

interface PromoteOptions {
  pickId: string;
  channel?: 'DISCORD' | 'CANARY';
  threadId?: string;
  scheduledFor?: string;
  apiUrl?: string;
}

interface PromoteResult {
  success: boolean;
  pickId?: string;
  publishId?: string;
  publishMode?: string;
  channel?: string;
  status?: string;
  error?: string;
  message?: string;
  correlationId?: string;
}

/**
 * Parse command line arguments
 */
function parseArgs(): PromoteOptions | null {
  const args = process.argv.slice(2);
  const options: Partial<PromoteOptions> = {};

  for (const arg of args) {
    if (arg.startsWith('--pickId=')) {
      options.pickId = arg.split('=')[1];
    } else if (arg.startsWith('--channel=')) {
      const channel = arg.split('=')[1].toUpperCase();
      if (channel !== 'DISCORD' && channel !== 'CANARY') {
        console.error('❌ Error: channel must be DISCORD or CANARY');
        return null;
      }
      options.channel = channel as 'DISCORD' | 'CANARY';
    } else if (arg.startsWith('--threadId=')) {
      options.threadId = arg.split('=')[1];
    } else if (arg.startsWith('--scheduledFor=')) {
      options.scheduledFor = arg.split('=')[1];
    } else if (arg.startsWith('--apiUrl=')) {
      options.apiUrl = arg.split('=')[1];
    } else if (arg === '--help' || arg === '-h') {
      printUsage();
      return null;
    } else {
      console.error(`❌ Unknown argument: ${arg}`);
      printUsage();
      return null;
    }
  }

  if (!options.pickId) {
    console.error('❌ Error: --pickId is required');
    printUsage();
    return null;
  }

  return options as PromoteOptions;
}

/**
 * Print usage information
 */
function printUsage() {
  console.log(`
📝 Manual Pick Promotion Script

Usage:
  npx tsx scripts/manual_promote_pick.ts --pickId=<uuid> [options]

Required Arguments:
  --pickId=<uuid>          UUID of the pick to promote

Optional Arguments:
  --channel=<DISCORD|CANARY>    Target channel (default: DISCORD)
  --threadId=<string>          Discord thread ID for threading
  --scheduledFor=<ISO datetime> Schedule promotion for specific time

Environment Variables:
  API_URL                  Target API URL (default: http://localhost:3001)
  ADMIN_TOKEN             Admin authentication token (default: admin-test-token)

Examples:
  # Promote to production Discord
  API_URL=https://api.unit-talk.com npx tsx scripts/manual_promote_pick.ts \\
    --pickId=abc-123-def-456

  # Promote to canary channel for testing
  npx tsx scripts/manual_promote_pick.ts \\
    --pickId=abc-123-def-456 \\
    --channel=CANARY

  # Schedule promotion for game time
  npx tsx scripts/manual_promote_pick.ts \\
    --pickId=abc-123-def-456 \\
    --scheduledFor="2025-12-03T20:00:00Z"

  # Promote to specific thread
  npx tsx scripts/manual_promote_pick.ts \\
    --pickId=abc-123-def-456 \\
    --threadId=1234567890123456789
  `);
}

/**
 * Fetch pick details for verification
 */
async function fetchPickDetails(pickId: string, apiUrl: string): Promise<any> {
  const url = `${apiUrl}/api/ops/picks/${pickId}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || `HTTP ${response.status}: ${response.statusText}`
      );
    }

    return await response.json();
  } catch (error) {
    throw new Error(
      `Failed to fetch pick details: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Promote pick via API
 */
async function promotePick(options: PromoteOptions, apiUrl: string): Promise<PromoteResult> {
  const { pickId, channel, threadId, scheduledFor } = options;
  const url = `${apiUrl}/api/ops/picks/${pickId}/promote`;

  const body: any = {};
  if (channel) body.channel = channel;
  if (threadId) body.threadId = threadId;
  if (scheduledFor) body.scheduledFor = scheduledFor;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || 'Promotion failed',
        message: data.message,
        correlationId: data.correlationId,
      };
    }

    return data;
  } catch (error) {
    return {
      success: false,
      error: 'Network error',
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Manual Pick Promotion Script\n');

  const options = parseArgs();
  if (!options) {
    process.exit(1);
  }

  // Resolve final API URL (CLI override > env > default)
  const resolvedApiUrl = options.apiUrl || API_URL;
  const resolvedChannel = options.channel || 'DISCORD';
  const channelId = resolvedChannel === 'CANARY' ? '1296531122234327100' : 'production';

  console.log('Configuration:');
  console.log(`  API URL: ${resolvedApiUrl}`);
  console.log(`  Pick ID: ${options.pickId}`);
  console.log(`  Channel: ${resolvedChannel} (ID: ${channelId})`);
  if (options.threadId) console.log(`  Thread ID: ${options.threadId}`);
  if (options.scheduledFor) console.log(`  Scheduled For: ${options.scheduledFor}`);
  console.log('');

  // Step 1: Fetch pick details for verification
  console.log('📥 Step 1/3: Fetching pick details...');
  let pickDetails: any;
  try {
    const response = await fetchPickDetails(options.pickId, resolvedApiUrl);
    pickDetails = response.pick;

    if (!pickDetails) {
      console.error('❌ Pick not found');
      process.exit(1);
    }

    console.log('✅ Pick found:');
    console.log(`  Selection: ${pickDetails.selection}`);
    console.log(`  Odds: ${pickDetails.odds}`);
    console.log(`  Workflow Stage: ${pickDetails.workflow_stage}`);
    console.log(`  Status: ${pickDetails.status}`);

    const user = Array.isArray(pickDetails.users) ? pickDetails.users[0] : pickDetails.users;
    if (user) {
      console.log(`  Capper: ${user.username} (Tier ${user.tier || 'Unknown'})`);
    }

    const prop = Array.isArray(pickDetails.props) ? pickDetails.props[0] : pickDetails.props;
    if (prop) {
      console.log(`  Sport: ${prop.sport || 'Unknown'}`);
      console.log(`  Player: ${prop.player_name || 'Unknown'}`);
      console.log(`  Market: ${prop.stat_type || 'Unknown'}`);
      console.log(`  Line: ${prop.line || 'Unknown'}`);
    }

    console.log('');

    // Verify pick is approved
    if (pickDetails.workflow_stage !== 'approved') {
      console.error(`❌ Pick is not approved (current stage: ${pickDetails.workflow_stage})`);
      console.error('   Picks must be in "approved" workflow stage before promotion');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Failed to fetch pick details:');
    console.error(`   ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }

  // Step 2: Confirm promotion
  console.log('⚠️  Step 2/3: Confirmation required');
  console.log(`   This will promote pick ${options.pickId} to ${options.channel || 'DISCORD'}`);
  console.log(`   The pick will be queued for Discord publishing`);
  console.log('');

  // In non-interactive mode, auto-confirm
  // For interactive mode, you could add readline confirmation here

  // Step 3: Promote pick
  console.log('📤 Step 3/3: Promoting pick...');
  const result = await promotePick(options, resolvedApiUrl);

  if (result.success) {
    console.log('');
    console.log('✅ Pick promoted successfully!');
    console.log('');
    console.log('Details:');
    console.log(`  Pick ID: ${result.pickId}`);
    console.log(`  Publish ID: ${result.publishId}`);
    console.log(`  Publish Mode: ${result.publishMode}`);
    console.log(`  Channel: ${result.channel}`);
    console.log(`  Status: ${result.status}`);
    console.log('');
    console.log('Next Steps:');
    console.log(`  1. Monitor pick_publish table for status='pending'`);
    console.log(`  2. DiscordPublishingWorker will process within 5-10 seconds`);
    console.log(`  3. Check Discord channel for published message`);
    console.log(`  4. Verify status changes to 'sent' with external_message_id`);
    console.log('');
    process.exit(0);
  } else {
    console.log('');
    console.error('❌ Pick promotion failed');
    console.error('');
    console.error('Error Details:');
    console.error(`  Error: ${result.error}`);
    if (result.message) {
      console.error(`  Message: ${result.message}`);
    }
    if (result.correlationId) {
      console.error(`  Correlation ID: ${result.correlationId}`);
    }
    console.error('');
    console.error('Troubleshooting:');
    console.error('  1. Verify pick is in "approved" workflow stage');
    console.error('  2. Check API server logs for detailed error messages');
    console.error('  3. Verify ADMIN_TOKEN has correct permissions');
    console.error('  4. Ensure API_URL points to correct environment');
    console.error('');
    process.exit(1);
  }
}

// Run main function
main().catch((error) => {
  console.error('');
  console.error('💥 Unexpected error:');
  console.error(error);
  console.error('');
  process.exit(1);
});
