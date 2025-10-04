/**
 * verify-all.ts - Comprehensive System Verification
 *
 * Checks:
 * - v_daily_board has rows
 * - raw_props has recent data (last hour)
 * - scored_props has recent scoring (last 30 min)
 * - No stale approved picks in promotion_queue
 * - All agents healthy (pinged within last 2 min)
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface Check {
  status: 'pass' | 'fail' | 'warn';
  message: string;
  details?: any;
}

interface VerificationResult {
  allGreen: boolean;
  checks: Record<string, Check>;
  timestamp: string;
  summary: {
    pass: number;
    fail: number;
    warn: number;
  };
}

async function checkBoardRows(): Promise<Check> {
  try {
    const { data, error } = await supabase
      .from('v_daily_board')
      .select('id')
      .limit(10);

    if (error) {
      return {
        status: 'fail',
        message: `Board query failed: ${error.message}`
      };
    }

    if (!data || data.length === 0) {
      return {
        status: 'warn',
        message: 'Board has no rows (may be expected if no games today)'
      };
    }

    return {
      status: 'pass',
      message: `Board has ${data.length} rows`,
      details: { count: data.length }
    };
  } catch (error) {
    return {
      status: 'fail',
      message: `Board check error: ${error}`
    };
  }
}

async function checkRecentFeed(): Promise<Check> {
  try {
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();

    const { data, error } = await supabase
      .from('raw_props')
      .select('id')
      .gte('ingested_at', oneHourAgo);

    if (error) {
      return {
        status: 'fail',
        message: `Feed query failed: ${error.message}`
      };
    }

    if (!data || data.length === 0) {
      return {
        status: 'fail',
        message: 'No raw props ingested in last hour - FeedAgent may be down'
      };
    }

    return {
      status: 'pass',
      message: `${data.length} props ingested in last hour`,
      details: { count: data.length }
    };
  } catch (error) {
    return {
      status: 'fail',
      message: `Feed check error: ${error}`
    };
  }
}

async function checkRecentScoring(): Promise<Check> {
  try {
    const thirtyMinAgo = new Date(Date.now() - 1800000).toISOString();

    const { data, error } = await supabase
      .from('scored_props')
      .select('id')
      .gte('scored_at', thirtyMinAgo);

    if (error) {
      return {
        status: 'fail',
        message: `Scoring query failed: ${error.message}`
      };
    }

    if (!data || data.length === 0) {
      return {
        status: 'warn',
        message: 'No props scored in last 30 min - ScoringAgent may be idle'
      };
    }

    return {
      status: 'pass',
      message: `${data.length} props scored in last 30 min`,
      details: { count: data.length }
    };
  } catch (error) {
    return {
      status: 'fail',
      message: `Scoring check error: ${error}`
    };
  }
}

async function checkAlertsBacklog(): Promise<Check> {
  try {
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('promotion_queue')
      .select('id, pick_id, publish_at')
      .eq('status', 'approved')
      .lte('publish_at', now)
      .is('published_at', null);

    if (error) {
      return {
        status: 'fail',
        message: `Alerts query failed: ${error.message}`
      };
    }

    if (data && data.length > 10) {
      return {
        status: 'fail',
        message: `${data.length} stale approved picks not published - AlertAgent may be down`,
        details: { staleCount: data.length }
      };
    }

    if (data && data.length > 0) {
      return {
        status: 'warn',
        message: `${data.length} picks pending publish (normal if < 5 min old)`,
        details: { pendingCount: data.length }
      };
    }

    return {
      status: 'pass',
      message: 'No stale alerts backlog',
      details: { backlog: 0 }
    };
  } catch (error) {
    return {
      status: 'fail',
      message: `Alerts check error: ${error}`
    };
  }
}

async function checkAgentHealth(): Promise<Check> {
  try {
    const twoMinAgo = new Date(Date.now() - 120000).toISOString();

    const { data, error } = await supabase
      .from('agent_health')
      .select('agent_name, last_ping, status')
      .gte('last_ping', twoMinAgo);

    if (error) {
      return {
        status: 'fail',
        message: `Agent health query failed: ${error.message}`
      };
    }

    const requiredAgents = ['FeedAgent', 'ScoringAgent', 'AlertAgent'];
    const healthyAgents = data?.map(a => a.agent_name) || [];
    const missingAgents = requiredAgents.filter(a => !healthyAgents.includes(a));

    if (missingAgents.length > 0) {
      return {
        status: 'fail',
        message: `Agents not healthy: ${missingAgents.join(', ')}`,
        details: { missing: missingAgents, healthy: healthyAgents }
      };
    }

    const unhealthyAgents = data?.filter(a => a.status !== 'healthy') || [];
    if (unhealthyAgents.length > 0) {
      return {
        status: 'warn',
        message: `Some agents degraded: ${unhealthyAgents.map(a => a.agent_name).join(', ')}`,
        details: { degraded: unhealthyAgents.map(a => a.agent_name) }
      };
    }

    return {
      status: 'pass',
      message: `All ${healthyAgents.length} agents healthy`,
      details: { agents: healthyAgents }
    };
  } catch (error) {
    return {
      status: 'fail',
      message: `Agent health check error: ${error}`
    };
  }
}

async function verifyAll(): Promise<VerificationResult> {
  console.log('🔍 Running system verification...\n');

  const checks: Record<string, Check> = {
    boardRows: await checkBoardRows(),
    feedRows: await checkRecentFeed(),
    recentScoring: await checkRecentScoring(),
    alertsBacklog: await checkAlertsBacklog(),
    agentHealth: await checkAgentHealth()
  };

  const summary = {
    pass: Object.values(checks).filter(c => c.status === 'pass').length,
    fail: Object.values(checks).filter(c => c.status === 'fail').length,
    warn: Object.values(checks).filter(c => c.status === 'warn').length
  };

  const allGreen = summary.fail === 0 && summary.warn === 0;

  return {
    allGreen,
    checks,
    timestamp: new Date().toISOString(),
    summary
  };
}

function printResults(result: VerificationResult): void {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('                   VERIFICATION RESULTS');
  console.log('═══════════════════════════════════════════════════════════════\n');

  for (const [name, check] of Object.entries(result.checks)) {
    const icon = check.status === 'pass' ? '✅' : check.status === 'warn' ? '⚠️' : '❌';
    const statusColor = check.status === 'pass' ? '\x1b[32m' : check.status === 'warn' ? '\x1b[33m' : '\x1b[31m';
    const reset = '\x1b[0m';

    console.log(`${icon} ${name.padEnd(20)} ${statusColor}${check.status.toUpperCase()}${reset}`);
    console.log(`   ${check.message}`);
    if (check.details) {
      console.log(`   Details: ${JSON.stringify(check.details)}`);
    }
    console.log();
  }

  console.log('───────────────────────────────────────────────────────────────');
  console.log(`SUMMARY: ${result.summary.pass} pass, ${result.summary.fail} fail, ${result.summary.warn} warn`);
  console.log('───────────────────────────────────────────────────────────────\n');

  if (result.allGreen) {
    console.log('🎉 \x1b[32mALL GREEN - System operating normally\x1b[0m\n');
  } else if (result.summary.fail > 0) {
    console.log('🚨 \x1b[31mCRITICAL ISSUES DETECTED - Immediate attention required\x1b[0m\n');
  } else {
    console.log('⚠️  \x1b[33mWARNINGS PRESENT - Review recommended\x1b[0m\n');
  }

  console.log(`Timestamp: ${result.timestamp}`);
  console.log('═══════════════════════════════════════════════════════════════\n');
}

// Main execution
async function main() {
  try {
    const result = await verifyAll();
    printResults(result);

    // Exit with appropriate code
    process.exit(result.allGreen ? 0 : result.summary.fail > 0 ? 1 : 2);

  } catch (error) {
    console.error('❌ Verification failed with error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

// Export for testing
export { verifyAll, checkBoardRows, checkRecentFeed, checkRecentScoring, checkAlertsBacklog, checkAgentHealth };
