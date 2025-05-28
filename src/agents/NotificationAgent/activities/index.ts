import { NotificationAgent } from '..';
import { NotificationParams } from '../types';

export async function sendNotification(params: NotificationParams): Promise<void> {
  const agent = new NotificationAgent();
  await agent.initialize();
  await agent.sendNotification(params);
}

export async function sendBatchNotifications(params: NotificationParams[]): Promise<void> {
  const agent = new NotificationAgent();
  await agent.initialize();
  await agent.sendBatchNotifications(params);
}

export async function processNotificationQueue(): Promise<void> {
  const agent = new NotificationAgent();
  await agent.initialize();
  await agent.processQueue();
}

export async function retryFailedNotifications(): Promise<void> {
  const agent = new NotificationAgent();
  await agent.initialize();
  await agent.retryFailed();
} 