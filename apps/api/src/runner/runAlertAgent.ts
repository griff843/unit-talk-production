#!/usr/bin/env node
import 'dotenv/config';
import { requireSupabase } from '../utils/supabaseUtils';
import { createLogger } from '../utils/logger';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import fetch from 'node-fetch';

const logger = createLogger('AlertAgent');

interface AlertOptions {
  mode?: 'canary' | 'shadow' | 'production';
  since?: string; // e.g., "60 minutes"
  batch?: number;
  webhook?: string;
}

function parseArgs(): AlertOptions {
  const args = process.argv.slice(2);
  const options: AlertOptions = {
    mode: 'shadow',
    since: '60 minutes',
    batch: 20,
    webhook: process.env.DISCORD_ALERT_WEBHOOK || ''
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--mode' && args[i + 1]) {
      options.mode = args[i + 1] as any;
      i++;
    } else if (args[i] === '--since' && args[i + 1]) {
      options.since = args[i + 1];
      i++;
    } else if (args[i] === '--batch' && args[i + 1]) {
      options.batch = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--webhook' && args[i + 1]) {
      options.webhook = args[i + 1];
      i++;
    }
  }

  return options;
}

async function sendDiscordWebhook(webhook: string, embed: any): Promise<boolean> {
  try {
    const response = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [embed]
      })
    });

    if (!response.ok) {
      const text = await response.text();
      logger.error('Discord webhook failed', {
        status: response.status,
        statusText: response.statusText,
        body: text.substring(0, 200)
      });
      return false;
    }

    return true;
  } catch (error) {
    logger.error('Failed to send Discord webhook', { error });
    return false;
  }
}

function createPickEmbed(pick: any): any {
  // Use score to determine color (higher = better)
  const score = pick.professional_score || 0;
  let color = 0xA9A9A9; // Gray default
  if (score >= 0.9) color = 0xFF215E; // Red (S-tier)
  else if (score >= 0.8) color = 0xFF8C42; // Orange (A-tier)
  else if (score >= 0.7) color = 0xFFD700; // Gold (B-tier)
  else if (score >= 0.6) color = 0x90EE90; // Light green (C-tier)

  const timestamp = new Date(pick.game_date || pick.created_at).toISOString();

  return {
    title: `🎯 ${(score * 100).toFixed(0)}% Pick: ${pick.sport?.toUpperCase() || 'SPORT'}`,
    description: `**${pick.selection || 'Unknown Selection'}**\n${pick.matchup || 'Matchup TBD'}`,
    color,
    fields: [
      {
        name: '📊 Analysis',
        value: `Score: ${(pick.professional_score || 0).toFixed(3)}\nConfidence: ${(pick.confidence || 0).toFixed(1)}%\nEdge: ${(pick.devigged_edge || 0).toFixed(2)}%`,
        inline: true
      },
      {
        name: '💰 Betting Info',
        value: `Odds: ${pick.odds || 'N/A'}\nLine: ${pick.line !== null && pick.line !== undefined ? pick.line : 'N/A'}\nKelly: ${(pick.kelly_fraction || 0).toFixed(3)}`,
        inline: true
      },
      {
        name: '🏷️ Details',
        value: `Market: ${pick.market || 'N/A'}\nBookmaker: ${pick.metadata?.bookmaker || 'N/A'}\nSource: ${pick.source || 'N/A'}`,
        inline: false
      }
    ],
    timestamp,
    footer: {
      text: `Unit Talk Intelligence • Pick ID: ${pick.id?.substring(0, 8) || 'unknown'}`
    }
  };
}

async function runAlertAgent() {
  const options = parseArgs();
  const startTime = Date.now();
  const runId = `AlertAgent-${new Date().toISOString().replace(/[:.]/g, '-')}`;

  logger.info('🚀 Starting AlertAgent', { options });

  const report = {
    agentName: 'AlertAgent',
    runId,
    startTime: new Date().toISOString(),
    inputs: options,
    summary: {
      processed: 0,
      posted: 0,
      errors: 0,
      success: false
    },
    endTime: '',
    duration: 0
  };

  try {
    if (!options.webhook) {
      logger.warn('⚠️ No webhook configured - set DISCORD_ALERT_WEBHOOK env var or use --webhook');
      report.summary.success = true;
      report.endTime = new Date().toISOString();
      report.duration = Date.now() - startTime;
      saveReport(report);
      return;
    }

    const supabase = requireSupabase();

    // Calculate time threshold
    const sinceMatch = options.since?.match(/(\d+)\s*(minutes?|hours?|days?)/i);
    let timeThreshold = new Date();
    if (sinceMatch) {
      const value = parseInt(sinceMatch[1], 10);
      const unit = sinceMatch[2].toLowerCase();
      if (unit.startsWith('minute')) {
        timeThreshold = new Date(Date.now() - value * 60 * 1000);
      } else if (unit.startsWith('hour')) {
        timeThreshold = new Date(Date.now() - value * 60 * 60 * 1000);
      } else if (unit.startsWith('day')) {
        timeThreshold = new Date(Date.now() - value * 24 * 60 * 60 * 1000);
      }
    }

    logger.info(`Fetching approved picks since ${timeThreshold.toISOString()}`);

    // Query for approved picks that haven't been published yet
    const { data: picks, error } = await supabase
      .from('unified_picks')
      .select('*')
      .gte('created_at', timeThreshold.toISOString())
      .eq('status', 'approved')
      .or('published.is.null,published.eq.false')
      .order('professional_score', { ascending: false, nullsFirst: false })
      .limit(options.batch || 20);

    if (error) {
      logger.error('Failed to fetch picks', { error: error.message });
      throw error;
    }

    logger.info(`Found ${picks?.length || 0} approved picks to publish`);
    report.summary.processed = picks?.length || 0;

    if (!picks || picks.length === 0) {
      logger.info('No picks to publish');
      report.summary.success = true;
      report.endTime = new Date().toISOString();
      report.duration = Date.now() - startTime;
      saveReport(report);
      return;
    }

    // In canary/production mode, actually post to Discord
    if (options.mode === 'canary' || options.mode === 'production') {
      for (const pick of picks) {
        try {
          const embed = createPickEmbed(pick);
          const success = await sendDiscordWebhook(options.webhook, embed);

          if (success) {
            // Mark as published
            const { error: updateError } = await supabase
              .from('unified_picks')
              .update({
                published: true,
                updated_at: new Date().toISOString()
              })
              .eq('id', pick.id);

            if (updateError) {
              logger.error(`Failed to mark pick ${pick.id} as published`, { error: updateError.message });
              report.summary.errors++;
            } else {
              logger.info(`Published pick ${pick.id} to Discord`, {
                score: pick.professional_score,
                sport: pick.sport,
                selection: pick.selection
              });
              report.summary.posted++;
            }

            // Rate limit: wait 1 second between posts
            await new Promise(resolve => setTimeout(resolve, 1000));
          } else {
            logger.error(`Failed to post pick ${pick.id} to Discord`);
            report.summary.errors++;
          }
        } catch (error) {
          logger.error(`Error publishing pick ${pick.id}`, { error });
          report.summary.errors++;
        }
      }
    } else {
      logger.info(`Mode=${options.mode} - no posts made (dry run)`);
      logger.info(`Would post ${picks.length} picks to Discord`);
    }

    report.summary.success = true;
    report.endTime = new Date().toISOString();
    report.duration = Date.now() - startTime;

    logger.info('✅ AlertAgent completed', {
      processed: report.summary.processed,
      posted: report.summary.posted,
      errors: report.summary.errors,
      duration: `${report.duration}ms`
    });

    saveReport(report);
  } catch (error) {
    logger.error('AlertAgent failed', { error });
    report.summary.success = false;
    report.summary.errors++;
    report.endTime = new Date().toISOString();
    report.duration = Date.now() - startTime;
    saveReport(report);
    process.exit(1);
  }
}

function saveReport(report: any) {
  try {
    const outDir = join(process.cwd(), 'apps/api/out/ops/agents');
    mkdirSync(outDir, { recursive: true });
    const reportPath = join(outDir, `alertagent-${Date.now()}.json`);
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    logger.info(`📋 Run report: ${reportPath}`);
  } catch (error) {
    logger.error('Failed to save report', { error });
  }
}

// Run
runAlertAgent().catch(error => {
  logger.error('Unhandled error', { error });
  process.exit(1);
});