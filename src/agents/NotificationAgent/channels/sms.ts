import * as twilio from 'twilio';
import { NotificationPayload } from '../types';

interface SMSConfig {
  provider: string;
  apiKey: string;
  accountSid?: string;
  fromNumber?: string;
  enabled: boolean;
}

let twilioClient: twilio.Twilio | null = null;

export async function sendSMSNotification(
  payload: NotificationPayload,
  config: SMSConfig
): Promise<void> {
  if (!config.enabled) {
    throw new Error('SMS notifications are not enabled');
  }

  if (!config.accountSid || !config.apiKey || !config.fromNumber) {
    throw new Error('Incomplete SMS configuration');
  }

  if (!twilioClient) {
    twilioClient = twilio(config.accountSid, config.apiKey);
  }

  if (!payload.to || payload.to.length === 0) {
    throw new Error('No recipients specified for SMS notification');
  }

  const message = formatSMSContent(payload);

  try {
    for (const recipient of payload.to) {
      await twilioClient.messages.create({
        body: message,
        from: config.fromNumber,
        to: recipient
      });
    }
  } catch (error) {
    throw new Error(`Failed to send SMS: ${(error as Error).message}`);
  }
}

function formatSMSContent(payload: NotificationPayload): string {
  const title = payload.title ? `${payload.title}\n` : '';
  const message = payload.message;
  
  // SMS should be concise, so we'll truncate if necessary
  const maxLength = 160 - title.length;
  const truncatedMessage = message.length > maxLength 
    ? `${message.substring(0, maxLength - 3)}...`
    : message;

  return `${title}${truncatedMessage}`;
} 