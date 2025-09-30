#!/usr/bin/env node
import 'dotenv/config';
import { requireSupabase } from '../utils/supabaseUtils';
import { createLogger } from '../utils/logger';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const logger = createLogger('ApprovalAgent');

interface ApprovalOptions {
  mode?: 'canary' | 'shadow' | 'production';
  since?: string; // e.g., "60 minutes"
  batch?: number;
  autoApprove?: boolean;
  minScore?: number;
  minTier?: string;
}

function parseArgs(): ApprovalOptions {
  const args = process.argv.slice(2);
  const options: ApprovalOptions = {
    mode: 'shadow',
    since: '60 minutes',
    batch: 50,
    autoApprove: false,
    minScore: 0.7,
    minTier: 'A'
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
    } else if (args[i] === '--auto-approve') {
      options.autoApprove = true;
    } else if (args[i] === '--min-score' && args[i + 1]) {
      options.minScore = parseFloat(args[i + 1]);
      i++;
    } else if (args[i] === '--min-tier' && args[i + 1]) {
      options.minTier = args[i + 1];
      i++;
    }
  }

  return options;
}

async function runApprovalAgent() {
  const options = parseArgs();
  const startTime = Date.now();
  const runId = `ApprovalAgent-${new Date().toISOString().replace(/[:.]/g, '-')}`;

  logger.info('🚀 Starting ApprovalAgent', { options });

  const report = {
    agentName: 'ApprovalAgent',
    runId,
    startTime: new Date().toISOString(),
    inputs: options,
    summary: {
      processed: 0,
      approved: 0,
      rejected: 0,
      errors: 0,
      success: false
    },
    endTime: '',
    duration: 0
  };

  try {
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

    logger.info(`Fetching unapproved picks since ${timeThreshold.toISOString()}`);

    // Query unified_picks for unapproved picks
    const { data: picks, error } = await supabase
      .from('unified_picks')
      .select('id, sport, selection, professional_score, confidence, created_at, status')
      .gte('created_at', timeThreshold.toISOString())
      .or('status.is.null,status.neq.approved')
      .order('professional_score', { ascending: false, nullsFirst: false })
      .limit(options.batch || 50);

    if (error) {
      logger.error('Failed to fetch picks', { error: error.message });
      throw error;
    }

    logger.info(`Found ${picks?.length || 0} picks needing approval`);
    report.summary.processed = picks?.length || 0;

    if (!picks || picks.length === 0) {
      logger.info('No picks to approve');
      report.summary.success = true;
      report.endTime = new Date().toISOString();
      report.duration = Date.now() - startTime;
      saveReport(report);
      return;
    }

    // In canary mode with auto-approve, approve picks meeting criteria
    if (options.mode === 'canary' && options.autoApprove) {
      for (const pick of picks) {
        try {
          const pickScore = pick.professional_score || 0;

          if (pickScore >= (options.minScore || 0.7)) {
            // Approve the pick
            const { error: updateError } = await supabase
              .from('unified_picks')
              .update({
                status: 'approved',
                approved_at: new Date().toISOString(),
                approved_by: 'system-auto-approval'
              })
              .eq('id', pick.id);

            if (updateError) {
              logger.error(`Failed to approve pick ${pick.id}`, { error: updateError.message });
              report.summary.errors++;
            } else {
              logger.info(`Approved pick ${pick.id}`, {
                sport: pick.sport,
                selection: pick.selection,
                score: pickScore
              });
              report.summary.approved++;
            }
          } else {
            logger.info(`Skipped pick ${pick.id} (score=${pickScore})`);
          }
        } catch (error) {
          logger.error(`Error processing pick ${pick.id}`, { error });
          report.summary.errors++;
        }
      }
    } else {
      logger.info(`Mode=${options.mode}, autoApprove=${options.autoApprove} - no approvals made (dry run)`);
      logger.info(`Would approve ${picks.filter(p => (p.professional_score || 0) >= (options.minScore || 0.7)).length} picks`);
    }

    report.summary.success = true;
    report.endTime = new Date().toISOString();
    report.duration = Date.now() - startTime;

    logger.info('✅ ApprovalAgent completed', {
      processed: report.summary.processed,
      approved: report.summary.approved,
      errors: report.summary.errors,
      duration: `${report.duration}ms`
    });

    saveReport(report);
  } catch (error) {
    logger.error('ApprovalAgent failed', { error });
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
    const reportPath = join(outDir, `approvalagent-${Date.now()}.json`);
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    logger.info(`📋 Run report: ${reportPath}`);
  } catch (error) {
    logger.error('Failed to save report', { error });
  }
}

// Run
runApprovalAgent().catch(error => {
  logger.error('Unhandled error', { error });
  process.exit(1);
});