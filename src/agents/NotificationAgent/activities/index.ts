import { BaseAgentConfig, BaseAgentDependencies, AgentStatus, HealthStatus, BaseMetrics } from '../../BaseAgent/types';
import { NotificationAgent } from '..';
import { NotificationPayload, NotificationAgentConfig } from '../types';

// Mock dependencies for activities
const getDependencies = (): BaseAgentDependencies => {
  // This would be properly injected in production
  return {
    supabase: null as any,
    logger: console as any,
    errorHandler: null as any
  };
};

const getConfig = (): NotificationAgentConfig => {
  return {
    name: 'NotificationAgent',
    agentName: 'NotificationAgent',
    enabled: true,
    version: '1.0.0',
    logLevel: 'info',
    metricsConfig: {
      interval: 30000,
      prefix: 'notification_agent'
    },
    channels: {},
    metrics: {
      enabled: true,
      interval: 30000
    }
  } as NotificationAgentConfig;
};

export async function sendNotification(params: NotificationPayload): Promise<void> {
  const agent = NotificationAgent.getInstance(getConfig(), getDependencies());
  await agent.sendNotification(params);
}

export async function sendBatchNotifications(params: NotificationPayload[]): Promise<void> {
  const agent = NotificationAgent.getInstance(getConfig(), getDependencies());
  await agent.sendBatchNotifications(params);
}

export async function processNotificationQueue(): Promise<void> {
  const agent = NotificationAgent.getInstance(getConfig(), getDependencies());
  await agent.processQueue();
}

export async function retryFailedNotifications(): Promise<void> {
  const agent = NotificationAgent.getInstance(getConfig(), getDependencies());
  await agent.retryFailed();
}

// Helper function to send notifications
export async function sendNotifications(params: NotificationPayload[]): Promise<void> {
  const agent = NotificationAgent.getInstance(getConfig(), getDependencies());
  await agent.sendBatchNotifications(params);
}