// src/agents/NotificationAgent/types.ts

/** Allowed notification channels */
export type NotificationChannel =
  | 'discord'
  | 'email'
  | 'notion'
  | 'retool'
  | 'sms'
  | 'slack'
  | 'webhook'
  | 'push'
  // add more as you integrate

/** Notification event types (extend as you grow) */
export type NotificationType =
  | 'system'
  | 'recap'
  | 'incident'
  | 'marketing'
  | 'audit'
  | 'alert'
  | 'custom';

/** NotificationAgent config (for runtime validation and channel/behavior options) */
export interface NotificationAgentConfig {
  agentName: string; // "NotificationAgent"
  enabled: boolean;
  maxRetries?: number;
  allowedChannels?: NotificationChannel[];
  logAll?: boolean; // whether to log even successes
  escalationChannels?: NotificationChannel[];
  // Extend as needed
}

/** Single notification payload */
export interface NotificationPayload {
  id?: string; // Optional, for idempotency or deduplication
  type: NotificationType;
  title?: string;
  message: string;
  description?: string;
  meta?: Record<string, any>;
  channels: NotificationChannel[];
  to?: string[]; // Recipients (email, Discord user, etc.)
  attachments?: any[]; // Files, images, etc.
  createdAt?: string; // ISO string
  priority?: 'low' | 'normal' | 'high' | 'critical';
  // Extend with more fields as needed
}

/** Result structure from sendNotification */
export interface NotificationResult {
  results: Record<NotificationChannel, boolean>;
  errors?: Record<NotificationChannel, string>;
  escalated?: boolean;
  meta?: Record<string, any>;
}

/** Notification log record (as stored in Supabase or elsewhere) */
export interface NotificationLogRecord extends NotificationPayload {
  status: 'success' | 'partial' | 'failed';
  deliveredChannels: NotificationChannel[];
  failedChannels: NotificationChannel[];
  errors?: Record<NotificationChannel, string>;
  createdAt: string; // Always present on log
}
