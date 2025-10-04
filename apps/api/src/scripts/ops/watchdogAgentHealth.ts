/**
 * Agent Health Watchdog
 *
 * Monitors agent_health table for stale pings (>2 minutes).
 * Alerts to Discord when agents haven't pinged recently.
 * Always writes JSON report to out/ops/health/watchdog_agent_health.json
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL_HEALTH;
const STALE_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes
const OUT_DIR = path.join(process.cwd(), 'apps/api/out/ops/health');

interface AgentHealthStatus {
  agent: string;
  lastPing: string;
  minutesSinceLastPing: number;
  isStale: boolean;
  details?: any;
}

interface WatchdogReport {
  runId: string;
  timestamp: string;
  staleAgents: string[];
  allAgents: AgentHealthStatus[];
  discordAlertSent: boolean;
  discordWebhookConfigured: boolean;
}

// Ensure output directory exists
function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

// Get latest ping per agent
async function getAgentHealthStatus(): Promise<AgentHealthStatus[]> {
  // Query for latest ping per agent
  const { data, error } = await supabase.rpc('get_latest_agent_pings', {});

  if (error) {
    // Fallback to manual query if RPC doesn't exist
    console.warn('⚠️  RPC get_latest_agent_pings not found, using fallback query');

    const { data: healthData, error: healthError } = await supabase
      .from('agent_health')
      .select('agent, created_at, details')
      .order('created_at', { ascending: false });

    if (healthError) throw healthError;

    // Group by agent and get latest ping
    const latestByAgent = new Map<string, any>();
    healthData?.forEach(row => {
      if (!latestByAgent.has(row.agent)) {
        latestByAgent.set(row.agent, row);
      }
    });

    const statusList: AgentHealthStatus[] = Array.from(
      latestByAgent.values()
    ).map(row => {
      const lastPingTime = new Date(row.created_at).getTime();
      const nowTime = Date.now();
      const minutesSince = (nowTime - lastPingTime) / (1000 * 60);
      const isStale = nowTime - lastPingTime > STALE_THRESHOLD_MS;

      return {
        agent: row.agent,
        lastPing: row.created_at,
        minutesSinceLastPing: Math.round(minutesSince * 10) / 10,
        isStale,
        details: row.details,
      };
    });

    return statusList;
  }

  // Process RPC response
  return (data || []).map((row: any) => {
    const lastPingTime = new Date(row.last_ping).getTime();
    const nowTime = Date.now();
    const minutesSince = (nowTime - lastPingTime) / (1000 * 60);
    const isStale = nowTime - lastPingTime > STALE_THRESHOLD_MS;

    return {
      agent: row.agent,
      lastPing: row.last_ping,
      minutesSinceLastPing: Math.round(minutesSince * 10) / 10,
      isStale,
      details: row.details,
    };
  });
}

// Send Discord alert for stale agents
async function sendDiscordAlert(staleAgents: AgentHealthStatus[]) {
  if (!DISCORD_WEBHOOK_URL) {
    console.warn(
      '⚠️  DISCORD_WEBHOOK_URL_HEALTH not configured, skipping alert'
    );
    return false;
  }

  const embed = {
    title: '🚨 Stale Agent Health Detected',
    description: `${staleAgents.length} agent(s) haven't pinged in >2 minutes`,
    color: 0xff0000, // Red
    fields: staleAgents.map(agent => ({
      name: agent.agent,
      value: `Last ping: ${agent.minutesSinceLastPing} minutes ago`,
      inline: true,
    })),
    timestamp: new Date().toISOString(),
    footer: {
      text: 'Unit Talk Agent Watchdog',
    },
  };

  try {
    const response = await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    });

    if (!response.ok) {
      throw new Error(`Discord webhook failed: ${response.statusText}`);
    }

    console.log('✅ Discord alert sent successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to send Discord alert:', error);
    return false;
  }
}

// Write JSON report
function writeReport(report: WatchdogReport) {
  ensureDir(OUT_DIR);
  const reportPath = path.join(OUT_DIR, 'watchdog_agent_health.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`📝 Report written to: ${reportPath}`);
}

// Main watchdog function
async function runWatchdog() {
  const runId = new Date().toISOString().replace(/[:.]/g, '-');

  console.log('🐕 Agent Health Watchdog');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Run ID: ${runId}`);
  console.log(`Stale threshold: ${STALE_THRESHOLD_MS / 1000}s (2 minutes)`);
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // Get agent health status
    const allAgents = await getAgentHealthStatus();
    const staleAgents = allAgents.filter(a => a.isStale);

    console.log(`\n📊 Health Status:`);
    console.log(`   Total agents: ${allAgents.length}`);
    console.log(`   Stale agents: ${staleAgents.length}`);

    // Log each agent
    allAgents.forEach(agent => {
      const emoji = agent.isStale ? '🔴' : '🟢';
      console.log(
        `   ${emoji} ${agent.agent}: ${agent.minutesSinceLastPing} min ago`
      );
    });

    // Send Discord alert if stale agents detected
    let discordAlertSent = false;
    if (staleAgents.length > 0) {
      console.log('\n🚨 Stale agents detected, sending Discord alert...');
      discordAlertSent = await sendDiscordAlert(staleAgents);
    } else {
      console.log('\n✅ All agents healthy');
    }

    // Write report
    const report: WatchdogReport = {
      runId,
      timestamp: new Date().toISOString(),
      staleAgents: staleAgents.map(a => a.agent),
      allAgents,
      discordAlertSent,
      discordWebhookConfigured: !!DISCORD_WEBHOOK_URL,
    };

    writeReport(report);

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('✅ Watchdog complete');

    // Exit code 0 if all healthy, 1 if stale agents detected
    process.exit(staleAgents.length > 0 ? 1 : 0);
  } catch (error) {
    console.error('\n💥 Watchdog failed:', error);

    // Write error report
    const errorReport: WatchdogReport = {
      runId,
      timestamp: new Date().toISOString(),
      staleAgents: [],
      allAgents: [],
      discordAlertSent: false,
      discordWebhookConfigured: !!DISCORD_WEBHOOK_URL,
    };

    writeReport(errorReport);

    process.exit(1);
  }
}

runWatchdog();
