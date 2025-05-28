import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '../activities';

const { runAnalyticsAgent } = proxyActivities<typeof activities>({
  startToCloseTimeout: '10 minutes',
  retry: {
    maximumAttempts: 3,
    initialInterval: '1 second',
    maximumInterval: '1 minute',
  },
});

export async function analyticsWorkflow(): Promise<void> {
  await runAnalyticsAgent();
}

// Schedule-based workflow
export async function scheduledAnalyticsWorkflow(): Promise<void> {
  while (true) {
    await runAnalyticsAgent();
    // Run every hour
    await sleep('1 hour');
  }
}

// Batch analysis workflow
export async function batchAnalyticsWorkflow(
  startDate: string,
  endDate: string
): Promise<void> {
  await runAnalyticsAgent();
} 