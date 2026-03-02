import { WebClient } from '@slack/web-api';
import nodemailer from 'nodemailer';
import { Twilio } from 'twilio';

import { createMockPick, createMockCapper } from '../utils/testData';

// Initialize notification clients
const twilio = new Twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);

const emailTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

describe('Notification System Integration', () => {
  describe('SMS Notifications', () => {
    it('should send pick submission SMS', async () => {
      const testPick = createMockPick({
        pick_type: 'single',
        legs: [
          {
            game: 'Lakers vs Warriors',
            selection: 'Lakers -5.5',
          },
        ],
      });

      const message = `New Pick Submitted:
${testPick.legs[0].game}
${testPick.legs[0].selection}`;

      const response = await twilio.messages.create({
        body: message,
        to: process.env.TEST_PHONE_NUMBER!,
        from: process.env.TWILIO_FROM_NUMBER!,
      });

      expect(response.sid).toBeTruthy();
      expect(response.status).toBe('queued');
    });

    it('should send pick grading SMS', async () => {
      const testPick = createMockPick({
        status: 'finalized',
        result: 'win',
      });

      const message = `Pick Result: ${testPick.result.toUpperCase()}`;

      const response = await twilio.messages.create({
        body: message,
        to: process.env.TEST_PHONE_NUMBER!,
        from: process.env.TWILIO_FROM_NUMBER!,
      });

      expect(response.sid).toBeTruthy();
      expect(response.status).toBe('queued');
    });

    it('should handle SMS errors gracefully', async () => {
      try {
        await twilio.messages.create({
          body: 'Test message',
          to: 'invalid-number',
          from: process.env.TWILIO_FROM_NUMBER!,
        });
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeTruthy();
      }
    });
  });

  describe('Email Notifications', () => {
    it('should send welcome email', async () => {
      const testCapper = createMockCapper({
        display_name: 'The Analyst',
        tier: 'pro',
      });

      const mailOptions = {
        from: process.env.SMTP_FROM!,
        to: process.env.TEST_EMAIL!,
        subject: 'Welcome to Unit Talk!',
        html: `
          <h1>Welcome ${testCapper.display_name}!</h1>
          <p>Your ${testCapper.tier.toUpperCase()} account has been activated.</p>
        `,
      };

      const info = await emailTransporter.sendMail(mailOptions);
      expect(info.messageId).toBeTruthy();
    });

    it('should send daily summary email', async () => {
      const testPicks = [createMockPick({ result: 'win' }), createMockPick({ result: 'loss' })];

      const mailOptions = {
        from: process.env.SMTP_FROM!,
        to: process.env.TEST_EMAIL!,
        subject: 'Daily Picks Summary',
        html: `
          <h1>Daily Summary</h1>
          <p>Wins: 1</p>
          <p>Losses: 1</p>
        `,
      };

      const info = await emailTransporter.sendMail(mailOptions);
      expect(info.messageId).toBeTruthy();
    });

    it('should handle email errors gracefully', async () => {
      const invalidTransporter = nodemailer.createTransport({
        host: 'invalid-host',
        port: 587,
        auth: {
          user: 'invalid',
          pass: 'invalid',
        },
      });

      try {
        await invalidTransporter.sendMail({
          from: 'test@example.com',
          to: 'test@example.com',
          subject: 'Test',
          text: 'Test',
        });
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeTruthy();
      }
    });
  });

  describe('Slack Notifications', () => {
    it('should send pick alert to channel', async () => {
      const testPick = createMockPick({
        pick_type: 'single',
        legs: [
          {
            game: 'Lakers vs Warriors',
            selection: 'Lakers -5.5',
          },
        ],
      });

      const response = await slack.chat.postMessage({
        channel: process.env.SLACK_TEST_CHANNEL!,
        text: 'New Pick Alert',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*New Pick Alert*\n${testPick.legs[0].game}\n${testPick.legs[0].selection}`,
            },
          },
        ],
      });

      expect(response.ok).toBe(true);
      expect(response.message).toBeTruthy();
    });

    it('should send system alert to channel', async () => {
      const response = await slack.chat.postMessage({
        channel: process.env.SLACK_TEST_CHANNEL!,
        text: '🚨 System Alert',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '*High API Usage Warning*\nAPI usage has exceeded 80% of quota.',
            },
          },
        ],
      });

      expect(response.ok).toBe(true);
      expect(response.message).toBeTruthy();
    });

    it('should handle Slack errors gracefully', async () => {
      const invalidSlack = new WebClient('invalid-token');

      try {
        await invalidSlack.chat.postMessage({
          channel: 'invalid-channel',
          text: 'Test message',
        });
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeTruthy();
      }
    });
  });

  describe('Multi-Channel Notifications', () => {
    it('should send notifications to all channels', async () => {
      const testPick = createMockPick({
        pick_type: 'single',
        legs: [
          {
            game: 'Lakers vs Warriors',
            selection: 'Lakers -5.5',
          },
        ],
      });

      const message = `New Pick Alert: ${testPick.legs[0].game} - ${testPick.legs[0].selection}`;

      const [smsResponse, emailInfo, slackResponse] = await Promise.all([
        // SMS
        twilio.messages.create({
          body: message,
          to: process.env.TEST_PHONE_NUMBER!,
          from: process.env.TWILIO_FROM_NUMBER!,
        }),

        // Email
        emailTransporter.sendMail({
          from: process.env.SMTP_FROM!,
          to: process.env.TEST_EMAIL!,
          subject: 'New Pick Alert',
          text: message,
        }),

        // Slack
        slack.chat.postMessage({
          channel: process.env.SLACK_TEST_CHANNEL!,
          text: message,
        }),
      ]);

      expect(smsResponse.sid).toBeTruthy();
      expect(emailInfo.messageId).toBeTruthy();
      expect(slackResponse.ok).toBe(true);
    });

    it('should handle channel failures gracefully', async () => {
      const results = await Promise.allSettled([
        // SMS with invalid number
        twilio.messages.create({
          body: 'Test',
          to: 'invalid-number',
          from: process.env.TWILIO_FROM_NUMBER!,
        }),

        // Email (should succeed)
        emailTransporter.sendMail({
          from: process.env.SMTP_FROM!,
          to: process.env.TEST_EMAIL!,
          subject: 'Test',
          text: 'Test',
        }),

        // Slack with invalid channel
        slack.chat.postMessage({
          channel: 'invalid-channel',
          text: 'Test',
        }),
      ]);

      // At least one channel should succeed
      expect(results.some(r => r.status === 'fulfilled')).toBe(true);
      // Some channels should fail
      expect(results.some(r => r.status === 'rejected')).toBe(true);
    });
  });

  describe('Notification Rate Limiting', () => {
    it('should respect SMS rate limits', async () => {
      const startTime = Date.now();
      const messages = Array(5)
        .fill(null)
        .map(() => ({
          body: 'Test message',
          to: process.env.TEST_PHONE_NUMBER!,
          from: process.env.TWILIO_FROM_NUMBER!,
        }));

      const responses = await Promise.all(messages.map(msg => twilio.messages.create(msg)));

      const duration = Date.now() - startTime;
      expect(duration).toBeGreaterThan(1000); // Should take at least 1 second
      responses.forEach(response => {
        expect(response.sid).toBeTruthy();
      });
    });

    it('should respect Slack rate limits', async () => {
      const startTime = Date.now();
      const messages = Array(5)
        .fill(null)
        .map((_, i) => ({
          channel: process.env.SLACK_TEST_CHANNEL!,
          text: `Test message ${i + 1}`,
        }));

      const responses = await Promise.all(messages.map(msg => slack.chat.postMessage(msg)));

      const duration = Date.now() - startTime;
      expect(duration).toBeGreaterThan(1000); // Should take at least 1 second
      responses.forEach(response => {
        expect(response.ok).toBe(true);
      });
    });
  });
});
