import { proxyActivities } from '@temporalio/workflow';
import type { BaseAgentActivities } from '../types/activities';
import type { AnalyticsAgentActivities } from '../types/activities';
import type { NotificationAgentActivities } from '../types/activities';
import type { FeedAgentActivities } from '../types/activities';
import type { AuditAgentActivities } from '../types/activities';
import type { GradingAgentActivities } from '../types/activities';
import type { AlertAgentActivities } from '../types/activities';
import type { PromoAgentActivities } from '../types/activities';
import type { ContestAgentActivities } from '../types/activities';
import type { OperatorAgentActivities } from '../types/activities';
import type { IngestionAgentActivities } from '../types/activities';
import type { FinalizerAgentActivities } from '../types/activities';
import type { ReferralAgentActivities } from '../types/activities';
import type { RecapAgentActivities } from '../types/activities';
import type { PromotionAgentActivities } from '../types/activities';

// Create proxies for each agent's activities
const baseActivities = proxyActivities<BaseAgentActivities>({
  startToCloseTimeout: '1 minute'
});

const analyticsActivities = proxyActivities<AnalyticsAgentActivities>({
  startToCloseTimeout: '5 minutes'
});

const notificationActivities = proxyActivities<NotificationAgentActivities>({
  startToCloseTimeout: '1 minute'
});

const feedActivities = proxyActivities<FeedAgentActivities>({
  startToCloseTimeout: '5 minutes'
});

const auditActivities = proxyActivities<AuditAgentActivities>({
  startToCloseTimeout: '10 minutes'
});

const gradingActivities = proxyActivities<GradingAgentActivities>({
  startToCloseTimeout: '5 minutes'
});

const alertActivities = proxyActivities<AlertAgentActivities>({
  startToCloseTimeout: '1 minute'
});

const promoActivities = proxyActivities<PromoAgentActivities>({
  startToCloseTimeout: '5 minutes'
});

const contestActivities = proxyActivities<ContestAgentActivities>({
  startToCloseTimeout: '5 minutes'
});

const operatorActivities = proxyActivities<OperatorAgentActivities>({
  startToCloseTimeout: '5 minutes'
});

const ingestionActivities = proxyActivities<IngestionAgentActivities>({
  startToCloseTimeout: '5 minutes'
});

const finalizerActivities = proxyActivities<FinalizerAgentActivities>({
  startToCloseTimeout: '5 minutes'
});

const referralActivities = proxyActivities<ReferralAgentActivities>({
  startToCloseTimeout: '2 minutes'
});

const recapActivities = proxyActivities<RecapAgentActivities>({
  startToCloseTimeout: '5 minutes'
});

const promotionActivities = proxyActivities<PromotionAgentActivities>({
  startToCloseTimeout: '5 minutes'
});

// Export all activities
export {
  baseActivities,
  analyticsActivities,
  notificationActivities,
  feedActivities,
  auditActivities,
  gradingActivities,
  alertActivities,
  promoActivities,
  contestActivities,
  operatorActivities,
  ingestionActivities,
  finalizerActivities,
  referralActivities,
  recapActivities,
  promotionActivities
};

// Standard timeout configurations
const DEFAULT_TIMEOUT = '10 minutes';
const EXTENDED_TIMEOUT = '30 minutes';
const QUICK_TIMEOUT = '5 minutes';

// Proxy all activities with standard configurations
const analytics = proxyActivities<typeof analyticsActivities>({
  startToCloseTimeout: DEFAULT_TIMEOUT,
});

const grading = proxyActivities<typeof gradingActivities>({
  startToCloseTimeout: EXTENDED_TIMEOUT,
});

const contest = proxyActivities<typeof contestActivities>({
  startToCloseTimeout: DEFAULT_TIMEOUT,
});

const alert = proxyActivities<typeof alertActivities>({
  startToCloseTimeout: QUICK_TIMEOUT,
});

const promo = proxyActivities<typeof promoActivities>({
  startToCloseTimeout: DEFAULT_TIMEOUT,
});

const notification = proxyActivities<typeof notificationActivities>({
  startToCloseTimeout: QUICK_TIMEOUT,
});

const feed = proxyActivities<typeof feedActivities>({
  startToCloseTimeout: DEFAULT_TIMEOUT,
});

const operator = proxyActivities<typeof operatorActivities>({
  startToCloseTimeout: DEFAULT_TIMEOUT,
});

const audit = proxyActivities<typeof auditActivities>({
  startToCloseTimeout: EXTENDED_TIMEOUT,
});

const ingestion = proxyActivities<typeof ingestionActivities>({
  startToCloseTimeout: DEFAULT_TIMEOUT,
});

const finalizer = proxyActivities<typeof finalizerActivities>({
  startToCloseTimeout: DEFAULT_TIMEOUT,
});

const referral = proxyActivities<typeof referralActivities>({
  startToCloseTimeout: DEFAULT_TIMEOUT,
});

const recap = proxyActivities<typeof recapActivities>({
  startToCloseTimeout: DEFAULT_TIMEOUT,
});

const promotion = proxyActivities<typeof promotionActivities>({
  startToCloseTimeout: DEFAULT_TIMEOUT,
});

// Export all workflows with standardized patterns
export async function analyticsWorkflow(params: any): Promise<void> {
  await analytics.runAnalysis(params);
}

export async function gradingWorkflow(params: any): Promise<void> {
  await grading.gradeSubmission(params);
}

export async function contestWorkflow(params: any): Promise<void> {
  await contest.manageContest(params);
}

export async function alertWorkflow(params: any): Promise<void> {
  await alert.processAlert(params);
}

export async function promoWorkflow(params: any): Promise<void> {
  await promo.executePromotion(params);
}

export async function notificationWorkflow(params: any): Promise<void> {
  await notification.sendNotification(params);
}

export async function feedWorkflow(params: any): Promise<void> {
  await feed.processFeed(params);
}

export async function operatorWorkflow(params: any): Promise<void> {
  await operator.executeOperation(params);
}

export async function auditWorkflow(params: any): Promise<void> {
  await audit.performAudit(params);
}

export async function ingestionWorkflow(params: any): Promise<void> {
  await ingestion.fetchAndProcessData(params);
}

export async function scheduledIngestionWorkflow(): Promise<void> {
  await ingestion.runScheduledIngestion();
}

export async function ingestionRecoveryWorkflow(params: any): Promise<void> {
  await ingestion.recoverFailedOperations(params);
}

export async function finalizationWorkflow(params: any): Promise<void> {
  await finalizer.finalizePicks(params);
}

export async function scheduledFinalizationWorkflow(params: any): Promise<void> {
  await finalizer.runScheduledFinalization(params);
}

export async function finalizationRecoveryWorkflow(params: any): Promise<void> {
  await finalizer.recoverFailedOperations(params);
}

export async function referralWorkflow(params: any): Promise<any> {
  return await referral.recordReferral(params);
}

export async function referralStatusWorkflow(params: any): Promise<any> {
  return await referral.updateReferralStatus(params.inviteeId, params.status);
}

export async function referralRewardWorkflow(params: any): Promise<any> {
  return await referral.processRewards(params);
}

export async function scheduledReferralProcessingWorkflow(): Promise<void> {
  await referral.runScheduledProcessing();
}

export async function recapWorkflow(params: any): Promise<any> {
  return await recap.generateRecap(params);
}

export async function scheduledRecapWorkflow(): Promise<void> {
  await recap.generateDailyRecap();
}

export async function promotionWorkflow(params: any): Promise<void> {
  await promotion.promoteToDailyPicks(params);
}

export async function scheduledPromotionWorkflow(): Promise<void> {
  await promotion.runScheduledPromotion();
}
