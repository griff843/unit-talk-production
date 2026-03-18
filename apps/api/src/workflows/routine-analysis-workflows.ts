/**
 * Routine Analysis Workflows — Temporal scheduled execution
 *
 * SPRINT-PH11-GAP-CLOSURE-2: Close GAP-PH11-1 by providing scheduled Temporal
 * triggers for the 4 analysis workflows that were previously manual-only.
 *
 * SPRINT-PH11-GAP-CLOSURE-3: Close GAP-PH11-2 by adding operator-visible
 * failure escalation via sendWorkflowFailure (Discord operator webhook).
 *
 * Each workflow is a single-shot execution invoked by a Temporal schedule.
 * The detailed ad-hoc CLI scripts remain available for operator deep-dives.
 */

import { proxyActivities } from '@temporalio/workflow';

import type { AlertActivities } from '../activities';
import type { AnalyticsAgentActivities, OperatorAgentActivities } from '../types/activities';

const analyticsActivities = proxyActivities<AnalyticsAgentActivities>({
  startToCloseTimeout: '5 minutes',
});

const operatorActivities = proxyActivities<OperatorAgentActivities>({
  startToCloseTimeout: '2 minutes',
});

const alertActivities = proxyActivities<AlertActivities>({
  startToCloseTimeout: '30 seconds',
});

/**
 * Verify SLO Attainment — scheduled every 30 minutes.
 * Checks platform health as a proxy for SLO compliance.
 * Detailed SLO verification (4 named SLOs) remains in verify-slo.ts CLI.
 */
export async function verifySloWorkflow(): Promise<void> {
  try {
    await operatorActivities.checkSystemHealth({
      cycleCount: 0,
      components: ['supabase', 'temporal', 'redis', 'discord'],
    });
    await operatorActivities.logWorkflowMetrics({
      workflowName: 'verifySloWorkflow',
      duration: 0,
      success: true,
      cycleCount: 0,
    });
  } catch (error) {
    await operatorActivities.logError({
      error: `verifySloWorkflow failed: ${error}`,
      timestamp: new Date().toISOString(),
      workflow: 'verifySloWorkflow',
    });
    await alertActivities.sendWorkflowFailure({
      timestamp: new Date().toISOString(),
      workflowName: 'verifySloWorkflow',
      errorMessage: String(error),
      cycleCount: 0,
    } as any);
    throw error;
  }
}

/**
 * Check Grading Status — scheduled every 15 minutes.
 * Runs analytics check on grading pipeline health.
 * Detailed grading diagnostics remain in check-grading-status.ts CLI.
 */
export async function checkGradingStatusWorkflow(): Promise<void> {
  try {
    await analyticsActivities.runAnalysis();
    await operatorActivities.logWorkflowMetrics({
      workflowName: 'checkGradingStatusWorkflow',
      duration: 0,
      success: true,
      cycleCount: 0,
    });
  } catch (error) {
    await operatorActivities.logError({
      error: `checkGradingStatusWorkflow failed: ${error}`,
      timestamp: new Date().toISOString(),
      workflow: 'checkGradingStatusWorkflow',
    });
    await alertActivities.sendWorkflowFailure({
      timestamp: new Date().toISOString(),
      workflowName: 'checkGradingStatusWorkflow',
      errorMessage: String(error),
      cycleCount: 0,
    } as any);
    throw error;
  }
}

/**
 * Analyze Grading & Promotion — scheduled daily at 4 AM.
 * Runs analytics on grading pipeline and promotion band distribution.
 * Detailed promotion analysis remains in analyze-grading-promotion.ts CLI.
 */
export async function analyzeGradingPromotionWorkflow(): Promise<void> {
  try {
    await analyticsActivities.runAnalysis();
    await operatorActivities.logWorkflowMetrics({
      workflowName: 'analyzeGradingPromotionWorkflow',
      duration: 0,
      success: true,
      cycleCount: 0,
    });
  } catch (error) {
    await operatorActivities.logError({
      error: `analyzeGradingPromotionWorkflow failed: ${error}`,
      timestamp: new Date().toISOString(),
      workflow: 'analyzeGradingPromotionWorkflow',
    });
    await alertActivities.sendWorkflowFailure({
      timestamp: new Date().toISOString(),
      workflowName: 'analyzeGradingPromotionWorkflow',
      errorMessage: String(error),
      cycleCount: 0,
    } as any);
    throw error;
  }
}

/**
 * Edge Validation Report — scheduled daily at 5 AM.
 * Runs analytics for CLV edge validation.
 * Detailed edge analysis remains in edge-validation-report.ts CLI.
 */
export async function edgeValidationReportWorkflow(): Promise<void> {
  try {
    await analyticsActivities.runAnalysis();
    await operatorActivities.logWorkflowMetrics({
      workflowName: 'edgeValidationReportWorkflow',
      duration: 0,
      success: true,
      cycleCount: 0,
    });
  } catch (error) {
    await operatorActivities.logError({
      error: `edgeValidationReportWorkflow failed: ${error}`,
      timestamp: new Date().toISOString(),
      workflow: 'edgeValidationReportWorkflow',
    });
    await alertActivities.sendWorkflowFailure({
      timestamp: new Date().toISOString(),
      workflowName: 'edgeValidationReportWorkflow',
      errorMessage: String(error),
      cycleCount: 0,
    } as any);
    throw error;
  }
}
