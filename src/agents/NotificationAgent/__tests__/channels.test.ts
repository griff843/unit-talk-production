import { sendEmailNotification } from '../channels/email';
import { sendSMSNotification } from '../channels/sms';
import { sendSlackNotification } from '../channels/slack';
import { NotificationPayload } from '../types';

// Mock nodemailer
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-id' })
  })
}));

// Mock twilio
jest.mock('twilio', () => () => ({
  messages: {
    create: jest.fn().mockResolvedValue({ sid: 'test-sid' })
  }
}));

// Mock fetch for Slack
global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  statusText: 'OK'
}) as jest.Mock;

describe('Notification Channels', () => {
  const testPayload: NotificationPayload = {
    type: 'test',
    title: 'Test Notification',
    message: 'This is a test notification',
    channels: ['email', 'sms', 'slack'],
    priority: 'low',
    to: ['test@example.com', '+1234567890']
  };

  describe('Email Channel', () => {
    const emailConfig = {
      enabled: true,
      smtpConfig: {
        host: 'smtp.test.com',
        port: 587,
        secure: true,
        auth: {
          user: 'test@test.com',
          pass: 'password'
        }
      }
    };

    it('should send email successfully', async () => {
      await expect(sendEmailNotification(testPayload, emailConfig))
        .resolves.not.toThrow();
    });

    it('should throw error when disabled', async () => {
      await expect(sendEmailNotification(testPayload, { ...emailConfig, enabled: false }))
        .rejects.toThrow('Email notifications are not enabled');
    });
  });

  describe('SMS Channel', () => {
    const smsConfig = {
      enabled: true,
      provider: 'twilio',
      apiKey: 'test-key',
      accountSid: 'test-sid',
      fromNumber: '+1987654321'
    };

    it('should send SMS successfully', async () => {
      await expect(sendSMSNotification(testPayload, smsConfig))
        .resolves.not.toThrow();
    });

    it('should throw error when disabled', async () => {
      await expect(sendSMSNotification(testPayload, { ...smsConfig, enabled: false }))
        .rejects.toThrow('SMS notifications are not enabled');
    });

    it('should throw error with missing config', async () => {
      const { accountSid, ...incompleteConfig } = smsConfig;
      await expect(sendSMSNotification(testPayload, incompleteConfig))
        .rejects.toThrow('Incomplete SMS configuration');
    });
  });

  describe('Slack Channel', () => {
    const slackConfig = {
      enabled: true,
      webhookUrl: 'https://hooks.slack.com/test',
      defaultChannel: 'test-channel'
    };

    it('should send Slack message successfully', async () => {
      await expect(sendSlackNotification(testPayload, slackConfig))
        .resolves.not.toThrow();
    });

    it('should throw error when disabled', async () => {
      await expect(sendSlackNotification(testPayload, { ...slackConfig, enabled: false }))
        .rejects.toThrow('Slack notifications are not enabled');
    });

    it('should throw error with missing webhook URL', async () => {
      const { webhookUrl, ...incompleteConfig } = slackConfig;
      await expect(sendSlackNotification(testPayload, incompleteConfig as any))
        .rejects.toThrow('Slack webhook URL is required');
    });

    it('should format message with blocks', async () => {
      await sendSlackNotification(testPayload, slackConfig);
      expect(fetch).toHaveBeenCalledWith(
        slackConfig.webhookUrl,
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('"type":"header"')
        })
      );
    });
  });
}); 