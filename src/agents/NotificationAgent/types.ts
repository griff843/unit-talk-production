// src/agents/NotificationAgent/types.ts

import { AgentConfig } from '../../types/agent';

/** Allowed notification channels */
export type NotificationChannel = 'discord' | 'notion' | 'email' | 'sms' | 'slack';

/** Notification event types (extend as you grow) */
export type NotificationType = 'onboarding' | 'incident' | 'alert' | 'system' | 'test';

/** NotificationAgent config (for runtime validation and channel/behavior options) */
export interface NotificationAgentConfig extends AgentConfig {
  agentName: 'NotificationAgent';
  enabled: boolean;
  metricsConfig: {
    interval: number;
    prefix: string;
  };
  channels: {
    discord?: {
      webhookUrl: string;
      enabled: boolean;
    };
    notion?: {
      apiKey: string;
      databaseId: string;
      enabled: boolean;
    };
    email?: {
      smtpConfig: {
        host: string;
        port: number;
        secure: boolean;
        auth: {
          user: string;
          pass: string;
        };
      };
      enabled: boolean;
    };
    sms?: {
      provider: string;
      apiKey: string;
      accountSid?: string;
      fromNumber?: string;
      enabled: boolean;
    };
    slack?: {
      webhookUrl: string;
      defaultChannel?: string;
      enabled: boolean;
    };
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
