import { proxyActivities, sleep } from '@temporalio/workflow';

const { runAnalyticsAgentActivity } = proxyActivities<{
  runAnalyticsAgentActivity(): Promise<void>;
}>({
  startToCloseTimeout: '10 minutes',
  retry: {
    maximumAttempts: 3,
    initialInterval: '1 second',
    maximumInterval: '1 minute',
  },
});

export async function analyticsWorkflow(): Promise<void> {
  await runAnalyticsAgentActivity();
}

// Schedule-based workflow
export async function scheduledAnalyticsWorkflow(): Promise<void> {
  while (true) {
    await runAnalyticsAgentActivity();
    // Run every hour
    await sleep('1 hour');
  }
}

// Batch analysis workflow
export async function batchAnalyticsWorkflow(
  startDate: string,
  endDate: string
): Promise<void> {
  await runAnalyticsAgentActivity();
}