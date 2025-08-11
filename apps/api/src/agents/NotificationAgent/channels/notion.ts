import { NotificationPayload } from '../types';

export interface NotionChannelConfig {
  enabled: boolean;
  apiKey?: string;
  databaseId?: string;
}

export async function sendNotionNotification(
  payload: NotificationPayload,
  config: NotionChannelConfig
): Promise<void> {
  if (!config.enabled || !config.apiKey) {
    return;
  }
  
  // TODO: Implement Notion notification sending
  console.log('[Notion] Would send notification:', payload);
} 