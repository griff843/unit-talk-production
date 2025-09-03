import { proxyActivities } from '@temporalio/workflow';

// Import your AnalyticsAgent activity
const { runAnalyticsAgent } = proxyActivities<{
  runAnalyticsAgent(): Promise<void>;
}>({
  startToCloseTimeout: '10 minutes',
  retry: {
    maximumAttempts: 3,
    initialInterval: '1s',
  },
});

// The Temporal workflow itself
export async function analyticsWorkflow(): Promise<void> {
  await runAnalyticsAgent();
}
