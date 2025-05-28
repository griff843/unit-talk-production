import { proxyActivities } from '@temporalio/workflow';
import type * as analyticsActivities from '../agents/AnalyticsAgent/activities';
import type * as gradingActivities from '../agents/GradingAgent/activities';
import type * as contestActivities from '../agents/ContestAgent/activities';
import type * as alertActivities from '../agents/AlertAgent/activities';
import type * as promoActivities from '../agents/PromoAgent/activities';
import type * as notificationActivities from '../agents/NotificationAgent/activities';
import type * as feedActivities from '../agents/FeedAgent/activities';
import type * as operatorActivities from '../agents/OperatorAgent/activities';
import type * as auditActivities from '../agents/AuditAgent/activities';

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

// Export all workflows with standardized patterns
export async function analyticsWorkflow(params: any): Promise<void> {
  await analytics.runAnalysis(params);
}

export async function gradingWorkflow(params: any): Promise<void> {
  await grading.processGrades(params);
}

export async function contestWorkflow(params: any): Promise<void> {
  await contest.manageContest(params);
}

export async function alertWorkflow(params: any): Promise<void> {
  await alert.processAlerts(params);
}

export async function promoWorkflow(params: any): Promise<void> {
  await promo.executePromotion(params);
}

export async function notificationWorkflow(params: any): Promise<void> {
  await notification.sendNotifications(params);
}

export async function feedWorkflow(params: any): Promise<void> {
  await feed.processFeed(params);
}

export async function operatorWorkflow(params: any): Promise<void> {
  await operator.executeOperations(params);
}

export async function auditWorkflow(params: any): Promise<void> {
  await audit.performAudit(params);
} 