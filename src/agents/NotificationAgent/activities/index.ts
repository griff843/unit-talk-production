import { BaseAgentConfig, BaseAgentDependencies, AgentStatus, HealthStatus, BaseMetrics } from '../../BaseAgent/types';
import { NotificationAgent } from '..';
import { NotificationPayload } from '../types';

// Mock dependencies for activities
const getDependencies = (): BaseAgentDependencies => {
  // This would be properly injected in production
  return {
    supabase: null as any,
    logger: console as any,
    errorHandler: null as any,
    config: {} as BaseAgentConfig
  };
};

export async function sendNotification(params: NotificationPayload): Promise<void> {
  const agent = NotificationAgent.getInstance(getDependencies());
  await agent.sendNotification(params);
}

export async function sendBatchNotifications(params: NotificationPayload[]): Promise<void> {
  const agent = NotificationAgent.getInstance(getDependencies());
  await agent.sendBatchNotifications(params);
}

export async function processNotificationQueue(): Promise<void> {
  const agent = NotificationAgent.getInstance(getDependencies());
  await agent.processQueue();
}

export async function retryFailedNotifications(): Promise<void> {
  const agent = NotificationAgent.getInstance(getDependencies());
  await agent.retryFailed();
}

// Helper function to send notifications
export async function sendNotifications(params: NotificationPayload[]): Promise<void> {
  const agent = NotificationAgent.getInstance(getDependencies());
  await agent.sendBatchNotifications(params);
}