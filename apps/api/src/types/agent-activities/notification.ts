export interface NotificationPayload {
  id: string;
  type: 'email' | 'sms' | 'discord' | 'push';
  recipient: string;
  subject?: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  metadata?: Record<string, any>;
  scheduledFor?: Date;
  retryCount?: number;
  maxRetries?: number;
}

export interface NotificationResponse {
  success: boolean;
  messageId?: string;
  error?: string;
  retryAfter?: number;
}

export interface NotificationChannel {
  send(payload: NotificationPayload): Promise<NotificationResponse>;
  healthCheck(): Promise<boolean>;
}