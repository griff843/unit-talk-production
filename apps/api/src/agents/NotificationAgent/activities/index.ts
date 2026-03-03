import { logger } from '../../../shared/logger';
import { BaseAgentConfig, BaseAgentDependencies } from '../../BaseAgent/types';
import { NotificationAgent, NotificationPayload } from '../NotificationAgent';

const getDependencies = (): BaseAgentDependencies => {
  return {
    logger,
    supabase: null, // Will be set by the agent
    errorHandler: {
      handleError: (error: Error, context?: Record<string, unknown>) => {
        logger.error('Error in NotificationAgent', { error, context });
      },
    },
  };
};

const getConfig = (): BaseAgentConfig => {
  return {
    name: 'NotificationAgent',
    enabled: true,
    metrics: {
      enabled: true,
      interval: 30000,
    },
  };
};

export async function sendNotification(params: NotificationPayload): Promise<void> {
  const agent = NotificationAgent.getInstance(getConfig(), getDependencies());
  await agent.sendNotification(params);
}

export async function sendBatchNotifications(params: NotificationPayload[]): Promise<void> {
  const agent = NotificationAgent.getInstance(getConfig(), getDependencies());
  await agent.sendBatchNotifications(params);
}

// Helper function to send notifications
export async function sendNotifications(params: NotificationPayload[]): Promise<void> {
  const agent = NotificationAgent.getInstance(getConfig(), getDependencies());
  await agent.sendBatchNotifications(params);
}

// Re-export NotificationPayload for convenience
export type { NotificationPayload };
