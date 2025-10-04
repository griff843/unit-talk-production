#!/usr/bin/env tsx
/**
 * start-pipeline-agents.ts - Start Core Pipeline Agents
 *
 * Starts the 4 core agents in correct order:
 * 1. FeedAgent - Ingests raw props from Odds API
 * 2. NormalizerAgent - Normalizes raw_props to unified_picks
 * 3. ScoringAgent - Scores unified_picks and writes to scored_props
 * 4. AlertAgent - Monitors v_daily_board and sends alerts
 */

import { FeedAgent } from '../../agents/FeedAgent';
import { NormalizerAgent } from '../../agents/NormalizerAgent';
import { ScoringAgent } from '../../agents/ScoringAgent';
import { AlertAgent } from '../../agents/AlertAgent';
import { createClient } from '@supabase/supabase-js';
import { logger as baseLogger } from '../../shared/logger';
import { config } from 'dotenv';

config();

const logger = baseLogger;

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface AgentRunner {
  name: string;
  instance: any;
  status: 'stopped' | 'starting' | 'running' | 'error';
  error?: string;
}

const agents: AgentRunner[] = [];

async function startAgent(AgentClass: any, name: string, intervalMs: number): Promise<AgentRunner> {
  logger.info(`🚀 Starting ${name}...`);

  const runner: AgentRunner = {
    name,
    instance: null,
    status: 'starting'
  };

  try {
    const agent = new AgentClass(
      {
        name,
        enabled: true,
        intervalMs,
        retryAttempts: 3,
        retryDelayMs: 5000
      },
      {
        supabase,
        logger: baseLogger,
        redis: null
      }
    );

    await agent.start();
    runner.instance = agent;
    runner.status = 'running';

    logger.info(`✅ ${name} started successfully`);

    return runner;

  } catch (error) {
    logger.error(`❌ Failed to start ${name}`, {
      error: error instanceof Error ? error.message : String(error)
    });

    runner.status = 'error';
    runner.error = error instanceof Error ? error.message : String(error);

    return runner;
  }
}

async function registerHealthPing(agentName: string): Promise<void> {
  try {
    await supabase
      .from('agent_health')
      .upsert({
        agent: agentName,
        status: 'healthy',
        last_run: new Date().toISOString(),
        last_error: null
      }, {
        onConflict: 'agent'
      });
  } catch (error) {
    logger.warn(`Failed to register health ping for ${agentName}`, { error });
  }
}

async function startPipeline(): Promise<void> {
  logger.info('═══════════════════════════════════════════════════════════════');
  logger.info('           STARTING PIPELINE AGENTS');
  logger.info('═══════════════════════════════════════════════════════════════\n');

  // Start agents in order with appropriate intervals
  const feedRunner = await startAgent(FeedAgent, 'FeedAgent', 60000);  // 1 min
  agents.push(feedRunner);
  await registerHealthPing('FeedAgent');

  // Wait 5 seconds for feed to ingest first batch
  await new Promise(resolve => setTimeout(resolve, 5000));

  const normalizerRunner = await startAgent(NormalizerAgent, 'NormalizerAgent', 30000);  // 30 sec
  agents.push(normalizerRunner);
  await registerHealthPing('NormalizerAgent');

  // Wait 5 seconds for normalizer to process
  await new Promise(resolve => setTimeout(resolve, 5000));

  const scoringRunner = await startAgent(ScoringAgent, 'ScoringAgent', 60000);  // 1 min
  agents.push(scoringRunner);
  await registerHealthPing('ScoringAgent');

  // Wait 5 seconds for scoring to complete
  await new Promise(resolve => setTimeout(resolve, 5000));

  const alertRunner = await startAgent(AlertAgent, 'AlertAgent', 120000);  // 2 min
  agents.push(alertRunner);
  await registerHealthPing('AlertAgent');

  // Summary
  logger.info('\n───────────────────────────────────────────────────────────────');
  logger.info('AGENT STATUS SUMMARY');
  logger.info('───────────────────────────────────────────────────────────────');

  const running = agents.filter(a => a.status === 'running');
  const failed = agents.filter(a => a.status === 'error');

  for (const agent of agents) {
    const statusIcon = agent.status === 'running' ? '✅' : '❌';
    logger.info(`${statusIcon} ${agent.name.padEnd(20)} ${agent.status.toUpperCase()}`);
    if (agent.error) {
      logger.info(`   Error: ${agent.error}`);
    }
  }

  logger.info('───────────────────────────────────────────────────────────────');
  logger.info(`TOTAL: ${running.length}/${agents.length} agents running`);
  logger.info('───────────────────────────────────────────────────────────────\n');

  if (failed.length === 0) {
    logger.info('🎉 ✅ ALL AGENTS STARTED SUCCESSFULLY\n');
  } else {
    logger.error(`⚠️  ${failed.length} agents failed to start - check logs\n`);
  }

  // Health ping loop
  setInterval(async () => {
    for (const agent of agents) {
      if (agent.status === 'running') {
        await registerHealthPing(agent.name);
      }
    }
  }, 60000);  // Ping every minute
}

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('\n🛑 Shutting down agents...');

  for (const agent of agents) {
    if (agent.instance && agent.status === 'running') {
      try {
        await agent.instance.stop();
        logger.info(`✅ ${agent.name} stopped`);
      } catch (error) {
        logger.error(`Failed to stop ${agent.name}`, { error });
      }
    }
  }

  logger.info('👋 All agents stopped');
  process.exit(0);
});

// Main execution
if (require.main === module) {
  startPipeline().catch(error => {
    logger.error('Pipeline startup failed', { error });
    process.exit(1);
  });
}

export { startPipeline };
