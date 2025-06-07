import { BaseAgentConfig } from '@shared/types/baseAgent';

export const notificationAgentConfig: BaseAgentConfig = {
  name: 'NotificationAgent',
  version: '1.0.0',
  enabled: true,
  logLevel: 'info',
  metrics: {
    enabled: true,
    interval: 60
  },
  health: {
    enabled: true,
    interval: 30
  },
  retry: {
    maxRetries: 3,
    backoffMs: 1000,
    maxBackoffMs: 5000
  },
  logging: {
    prefix: 'notification'
  },
  channels: {
    discord: {
      enabled: true,
      webhookUrl: 'https://discord.com/api/webhooks/test'
    },
    notion: {
      databaseId: 'test-db',
      enabled: true,
      apiKey: 'test-key'
    },
    email: {
      smtpConfig: {
        host: 'smtp.test.com',
        port: 587,
        secure: true,
        auth: {
          user: 'test-user',
          pass: 'test-pass'
        }
      },
      enabled: true
    },
    sms: {
      apiKey: 'test-key',
      accountSid: 'test-sid',
      fromNumber: '+1234567890',
      enabled: true
    },
    slack: {
      webhookUrl: 'https://hooks.slack.com/services/test',
      defaultChannel: '#test',
      enabled: true
    }
  }
}; 