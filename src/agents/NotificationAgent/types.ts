// src/agents/NotificationAgent/types.ts

import { BaseAgentConfig } from '../BaseAgent/types';

/** Allowed notification channels */
export type NotificationChannel = 'discord' | 'email' | 'notion' | 'slack' | 'sms';

/** Notification event types (extend as you grow) */
export type NotificationType = 'onboarding' | 'incident' | 'alert' | 'system' | 'test';

/** NotificationAgent config (for runtime validation and channel/behavior options) */
export interface NotificationAgentConfig extends BaseAgentConfig {
  agentName: 'NotificationAgent';
  enabled: boolean;
  metricsConfig: {
    interval: number;
    prefix: string;
  };
  channels: {
    [K in NotificationChannel]?: NotificationChannelConfig;
  };
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
  to?: string[]; // Recipients (email, phone, Discord user, etc.)
  attachments?: any[]; // Files, images, etc.
  createdAt?: string; // ISO string
  priority?: NotificationPriority;
  // Channel-specific options
  channelOptions?: {
    email?: {
      template?: string;
      subject?: string;
      replyTo?: string;
    };
    sms?: {
      urgent?: boolean;
      validUntil?: string;
    };
    slack?: {
      channel?: string;
      thread?: string;
      blocks?: any[];
    };
    discord?: {
      channel?: string;
      embed?: any;
    };
    notion?: {
      pageId?: string;
      tags?: string[];
    };
  };
}

/** Result structure from sendNotification */
export interface NotificationResult {
  success: boolean;
  notificationId: string;
  channels: NotificationChannel[];
  error?: string;
}

/** Notification log record (as stored in Supabase or elsewhere) */
export interface NotificationLogRecord extends NotificationPayload {
  status: 'success' | 'partial' | 'failed';
  deliveredChannels: NotificationChannel[];
  failedChannels: NotificationChannel[];
  errors?: Record<NotificationChannel, string>;
  createdAt: string; // Always present on log
}

export type NotificationPriority = 'low' | 'medium' | 'high' | 'critical';
// DRAGON PATCH: add batchConfig if referenced
export interface NotificationAgentConfig { batchConfig?: { maxBatchSize: number; }; }

export interface NotificationChannelConfig {
  enabled: boolean;
  webhookUrl?: string;
  apiKey?: string;
  smtpConfig?: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
  };
}
