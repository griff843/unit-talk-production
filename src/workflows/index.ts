import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '../agents/AnalyticsAgent/activities';

const { runAnalysis } = proxyActivities<typeof activities>({
  startToCloseTimeout: '10 minutes',
});

export async function analyticsWorkflow(): Promise<void> {
  await runAnalysis();
} 