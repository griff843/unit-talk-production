import { ActivityResult } from '../shared/activity-results';

export interface NotificationAgentActivities {
  sendNotification(params: {
    type: string;
    message: string;
    recipients: string[];
    priority: 'low' | 'medium' | 'high' | 'critical';
    context?: Record<string, unknown>;
  }): Promise<ActivityResult<{
    sent: boolean;
    recipients: string[];
    timestamp: string;
  }>>;

  sendDiscordMessage(params: {
    channelId: string;
    content: string;
    embeds?: Array<{
      title?: string;
      description?: string;
      fields?: Array<{
        name: string;
        value: string;
        inline?: boolean;
      }>;
      color?: number;
      timestamp?: string;
    }>;
  }): Promise<ActivityResult<{
    messageId: string;
    channelId: string;
    timestamp: string;
  }>>;

  monitorNotifications(params: {
    interval?: number;
    thresholds?: {
      maxPerMinute: number;
      maxPerHour: number;
    };
  }): Promise<ActivityResult<{
    sentLastMinute: number;
    sentLastHour: number;
    status: 'healthy' | 'throttled';
    timestamp: string;
  }>>;
} 